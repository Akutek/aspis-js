/** @typedef {import("../types/channel.js").ChannelEnvelope} ChannelEnvelope */
/** @typedef {import("../types/channel.js").ChannelSubscriber} ChannelSubscriber */
/** @typedef {import("../types/channel.js").ChannelTransport} ChannelTransport */
/** @typedef {import("../types/utils.js").UnsubscribeFunction} UnsubscribeFunction */
import { ChannelExtension } from "../extensions/channel/ChannelExtension.js";
import { PipelineWork } from "../workers/PipelineWork.js";
import { DebugAgent } from "../agents/DebugAgent.js";
import { ErrorAgent } from "../agents/ErrorAgent.js";
const PIPELINE_COMMANDS = new Set(["cmd:plan-prep", "cmd:compare-prep"]);
class Channel {
  /** Die ChannelExtension-Klasse (statisch). Kein zweites Objekt. */
  extension;
  manifest;
  /** @type {import("../types/channel.js").ChannelRuntime | null} */
  runtime;
  /** @type {Worker | null} */
  #worker = null;
  /** @type {Map<number, { resolve: (value: unknown) => void, reject: (reason?: unknown) => void }>} */
  #pending = new Map();
  /** @type {Map<string, Set<ChannelSubscriber>>} */
  #subs = new Map();
  #seq = 0;
  #destroyed = false;
  #pipelineHeld = false;
  /** @type {Array<() => void>} */
  #holdWaiters = [];
  constructor() {
    this.manifest = {};
    this.extension = ChannelExtension;
    this.runtime = null;
    ChannelExtension.prepare(this);
  }
  /** @returns {ChannelTransport} */
  get transport() {
    return this.#worker ? "worker" : "loopback";
  }
  /**
   * @param {import("../types/registry.js").Registry | null} [registry]
   */
  bind(registry = null) {
    ChannelExtension.bind(this, registry);
    return this;
  }
  /**
   * Hält plan-/compare-prep-Requests, solange `runCycle` inflight ist.
   * @param {boolean} held
   */
  holdPipeline(held) {
    this.#pipelineHeld = Boolean(held);
    if (!this.#pipelineHeld) {
      const waiters = this.#holdWaiters.splice(0);
      for (let i = 0; i < waiters.length; i += 1) {
        waiters[i]();
      }
    }
  }
  /**
   * @param {string} url
   */
  attachWorker(url) {
    if (this.#destroyed || this.#worker) {
      return;
    }
    if (typeof Worker !== "function") {
      this.#fail("Worker API fehlt, Loopback bleibt.");
      this.#ready();
      return;
    }
    const href = typeof url === "string" ? url.trim() : "";
    if (!href) {
      this.#fail("Worker-URL fehlt, Loopback bleibt.");
      this.#ready();
      return;
    }
    try {
      const worker = new Worker(href, { type: "module" });
      worker.onmessage = (event) => this.#onWorkerMessage(event.data);
      worker.onerror = (event) => {
        this.#fail(event && event.message ? event.message : "Pipeline-Worker-Fehler.");
        this.#dropWorker();
      };
      this.#worker = worker;
      this.#ready();
    } catch (error) {
      this.#fail(error instanceof Error ? error.message : String(error));
      this.#worker = null;
      this.#ready();
    }
  }
  /**
   * @param {string} type
   * @param {unknown} [payload]
   */
  post(type, payload = null) {
    if (this.#destroyed || typeof type !== "string" || !type) {
      return;
    }
    this.#fanout(this.#envelope(type, payload));
  }
  /**
   * @param {string} type
   * @param {unknown} [payload]
   * @returns {Promise<unknown>}
   */
  async request(type, payload = null) {
    if (this.#destroyed) {
      throw new Error("Aspis [Channel.request()] Channel ist zerstört.");
    }
    if (typeof type !== "string" || !type) {
      throw new Error("Aspis [Channel.request()] type fehlt.");
    }
    await this.#awaitPipeline(type);
    if (this.#destroyed) {
      throw new Error("Aspis [Channel.request()] Channel ist zerstört.");
    }
    if (!this.#worker) {
      return PipelineWork.handle(type, payload);
    }
    const id = this.#seq += 1;
    const envelope = this.#envelope(type, payload, id);
    return new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve, reject });
      try {
        this.#worker?.postMessage(envelope);
      } catch (error) {
        this.#pending.delete(id);
        reject(error);
      }
    });
  }
  /**
   * @param {string} type
   * @param {ChannelSubscriber} callback
   * @returns {UnsubscribeFunction}
   */
  subscribe(type, callback) {
    if (this.#destroyed || typeof type !== "string" || !type || typeof callback !== "function") {
      return () => {};
    }
    if (!this.#subs.has(type)) {
      this.#subs.set(type, new Set());
    }
    this.#subs.get(type)?.add(callback);
    return () => {
      const bucket = this.#subs.get(type);
      if (!bucket) {
        return;
      }
      bucket.delete(callback);
      if (bucket.size === 0) {
        this.#subs.delete(type);
      }
    };
  }
  /** Worker terminate, Pending ablehnen, Listener lösen. Idempotent. */
  destroy() {
    if (this.#destroyed) {
      return;
    }
    this.#destroyed = true;
    this.#pipelineHeld = false;
    const waiters = this.#holdWaiters.splice(0);
    for (let i = 0; i < waiters.length; i += 1) {
      waiters[i]();
    }
    const pending = [...this.#pending.entries()];
    this.#pending.clear();
    for (let i = 0; i < pending.length; i += 1) {
      pending[i][1].reject(new Error("Aspis [Channel.destroy()] Channel wurde zerstört."));
    }
    this.#subs.clear();
    this.#dropWorker();
  }
  /**
   * @param {string} type
   * @param {unknown} payload
   * @param {number} [id]
   * @returns {ChannelEnvelope}
   */
  #envelope(type, payload, id) {
    /** @type {ChannelEnvelope} */
    const envelope = { v: 1, type, payload };
    if (typeof id === "number") {
      envelope.id = id;
    }
    return envelope;
  }
  /**
   * @param {ChannelEnvelope} envelope
   */
  #fanout(envelope) {
    const bucket = this.#subs.get(envelope.type);
    if (bucket) {
      const targets = [...bucket];
      for (let i = 0; i < targets.length; i += 1) {
        try {
          targets[i](envelope.payload);
        } catch (error) {
          this.#error().capture(error, `[Channel.fanout()] '${envelope.type}'`);
        }
      }
    }
    const dispatcher = this.runtime?.dispatcher;
    if (dispatcher && typeof dispatcher.emit === "function") {
      dispatcher.emit(envelope.type, envelope.payload);
    }
  }
  /**
   * @param {unknown} data
   */
  #onWorkerMessage(data) {
    if (!data || typeof data !== "object") {
      return;
    }
    const message = /** @type {ChannelEnvelope} */ (data);
    if (typeof message.id === "number" && this.#pending.has(message.id)) {
      const pending = this.#pending.get(message.id);
      this.#pending.delete(message.id);
      if (!pending) {
        return;
      }
      if (message.ok === false) {
        pending.reject(new Error(message.error || "Channel-Worker-Fehler."));
        return;
      }
      pending.resolve(message.payload);
      return;
    }
    if (typeof message.type === "string" && message.type.startsWith("evt:")) {
      this.#fanout(message);
    }
  }
  async #awaitPipeline(type) {
    if (!this.#pipelineHeld || !PIPELINE_COMMANDS.has(type)) {
      return;
    }
    await new Promise((resolve) => {
      this.#holdWaiters.push(resolve);
    });
  }
  #dropWorker() {
    const worker = this.#worker;
    this.#worker = null;
    if (!worker) {
      return;
    }
    worker.onmessage = null;
    worker.onerror = null;
    try {
      worker.terminate();
    } catch (error) {
      this.#error().capture(error, "[Channel.destroy()] Worker terminate.");
    }
  }
  #ready() {
    const dispatcher = this.runtime?.dispatcher;
    if (dispatcher && typeof dispatcher.emit === "function") {
      dispatcher.emit("channel:ready", { transport: this.transport });
    }
  }
  /**
   * @param {string} message
   */
  #fail(message) {
    this.#debug().warn(`[Channel.attachWorker()] ${message}`);
    const dispatcher = this.runtime?.dispatcher;
    if (dispatcher && typeof dispatcher.emit === "function") {
      dispatcher.emit("channel:error", { message });
    }
  }
  #debug() {
    return this.runtime?.debug || DebugAgent.shared();
  }
  #error() {
    return this.runtime?.error || ErrorAgent.shared();
  }
}
export {
  Channel
};
