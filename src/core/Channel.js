/** @typedef {import("../types/channel.js").ChannelEnvelope} ChannelEnvelope */
/** @typedef {import("../types/channel.js").ChannelSubscriber} ChannelSubscriber */
/** @typedef {import("../types/channel.js").ChannelTransport} ChannelTransport */
/** @typedef {import("../types/utils.js").UnsubscribeFunction} UnsubscribeFunction */
import { ChannelExtension } from "../extensions/channel/ChannelExtension.js";
import { PipelineWork } from "../workers/PipelineWork.js";
import { DebugAgent } from "../agents/DebugAgent.js";
import { ErrorAgent } from "../agents/ErrorAgent.js";
const PIPELINE_COMMANDS = new Set(["cmd:plan-prep", "cmd:compare-prep"]);
const DEFAULT_TIMEOUT_MS = 8000;
class Channel {
  /** Die ChannelExtension-Klasse (statisch). Kein zweites Objekt. */
  extension;
  manifest;
  /** @type {import("../types/channel.js").ChannelRuntime | null} */
  runtime;
  /** @type {Worker | null} */
  #worker = null;
  #workerUrl = "";
  #attachAttempted = false;
  /** @type {Map<number, { resolve: (value: unknown) => void, reject: (reason?: unknown) => void, timer: ReturnType<typeof setTimeout> | null }>} */
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
   * Merkt die Worker-URL. Spawn erst beim ersten `request` (lazy).
   * @param {string} url
   */
  attachWorker(url) {
    if (this.#destroyed) {
      return;
    }
    const href = typeof url === "string" ? url.trim() : "";
    if (!href) {
      return;
    }
    this.#workerUrl = href;
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
    this.#ensureWorker();
    const started = this.#now();
    try {
      const result = this.#worker
        ? await this.#workerRequest(type, payload)
        : await this.#loopbackRequest(type, payload);
      this.#logTiming(type, started);
      return result;
    } catch (error) {
      this.#logTiming(type, started);
      throw error;
    }
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
    this.#rejectPending("Aspis [Channel.destroy()] Channel wurde zerstört.");
    this.#subs.clear();
    this.#dropWorker();
  }
  /**
   * @param {string} type
   * @param {unknown} payload
   * @returns {Promise<unknown>}
   */
  #workerRequest(type, payload) {
    const id = this.#seq += 1;
    const envelope = this.#envelope(type, payload, id);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (!this.#pending.has(id)) {
          return;
        }
        this.#pending.delete(id);
        reject(new Error("Aspis [Channel.request()] Timeout."));
      }, this.#timeoutMs());
      this.#pending.set(id, { resolve, reject, timer });
      try {
        this.#worker?.postMessage(envelope);
      } catch (error) {
        this.#clearPending(id);
        reject(error);
      }
    });
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
   * Subs immer. Dispatcher nur für `evt:*` — Lifecycle (`channel:ready` / `channel:error`) geht direkt.
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
    if (typeof envelope.type !== "string" || !envelope.type.startsWith("evt:")) {
      return;
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
      this.#clearPending(message.id);
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
  #ensureWorker() {
    if (this.#destroyed || this.#worker || this.#attachAttempted) {
      return;
    }
    this.#attachAttempted = true;
    if (typeof Worker !== "function") {
      this.#fail("Worker API fehlt, Loopback bleibt.");
      this.#ready();
      return;
    }
    if (!this.#workerUrl) {
      this.#fail("Worker-URL fehlt, Loopback bleibt.");
      this.#ready();
      return;
    }
    try {
      const worker = new Worker(this.#workerUrl, { type: "module" });
      worker.onmessage = (event) => this.#onWorkerMessage(event.data);
      worker.onerror = (event) => {
        this.#fail(event && event.message ? event.message : "Pipeline-Worker-Fehler.");
        this.#rejectPending("Aspis [Channel.request()] Pipeline-Worker-Fehler.");
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
   * Loopback mit demselben Timeout-Cap wie der Worker (sync-Arbeit bricht nur bei Hänger).
   * @param {string} type
   * @param {unknown} payload
   * @returns {Promise<unknown>}
   */
  #loopbackRequest(type, payload) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error("Aspis [Channel.request()] Timeout."));
      }, this.#timeoutMs());
      try {
        const result = PipelineWork.handle(type, payload);
        clearTimeout(timer);
        resolve(result);
      } catch (error) {
        clearTimeout(timer);
        reject(error);
      }
    });
  }
  #dropWorker() {
    if (this.#pending.size) {
      this.#rejectPending("Aspis [Channel.request()] Pipeline-Worker-Fehler.");
    }
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
  #clearPending(id) {
    const pending = this.#pending.get(id);
    this.#pending.delete(id);
    if (pending?.timer) {
      clearTimeout(pending.timer);
    }
    return pending;
  }
  /**
   * @param {string} message
   */
  #rejectPending(message) {
    const pending = [...this.#pending.entries()];
    this.#pending.clear();
    for (let i = 0; i < pending.length; i += 1) {
      const entry = pending[i][1];
      if (entry.timer) {
        clearTimeout(entry.timer);
      }
      entry.reject(new Error(message));
    }
  }
  #timeoutMs() {
    const registry = this.runtime?.registry;
    const config = registry && typeof registry.has === "function" && registry.has("config")
      ? registry.get("config")
      : null;
    const raw = config && config.settings && typeof config.settings === "object"
      ? config.settings.channel && typeof config.settings.channel === "object"
        ? config.settings.channel.timeoutMs
        : null
      : null;
    const n = Number(raw);
    if (!Number.isFinite(n)) {
      return DEFAULT_TIMEOUT_MS;
    }
    return Math.max(250, Math.min(60000, Math.floor(n)));
  }
  #logTiming(type, started) {
    const ms = Math.max(0, Math.round(this.#now() - started));
    this.#debug().info(`[Channel.request()] ${type} ${ms}ms ${this.transport}`);
  }
  #now() {
    return typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
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
