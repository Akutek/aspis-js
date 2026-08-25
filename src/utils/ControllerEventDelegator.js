/** @typedef {import("../types/utils.js").ControllerEventDelegatorOptions} ControllerEventDelegatorOptions */
/** @typedef {import("../types/utils.js").ControllerEventDelegatorTarget} ControllerEventDelegatorTarget */
/** @typedef {import("../types/utils.js").DelegateHandler} DelegateHandler */
/** @typedef {import("../types/utils.js").DelegateOptions} DelegateOptions */
/** @typedef {import("../types/utils.js").DispatcherLike} DispatcherLike */
/** @typedef {import("../types/utils.js").FetcherLike} FetcherLike */
import { DebugAgent } from "../agents/DebugAgent.js";
class ControllerEventDelegator {
  /** @type {HTMLElement | null} */
  #container;
  #dispatcher;
  /** @type {any} */
  #target;
  #options;
  #unsubscribeEvents = [];
  constructor(container, dispatcher, target, options = {}) {
    this.#container = container;
    this.#dispatcher = dispatcher;
    this.#target = target || this;
    this.#options = options;
  }
  delegate(eventName, selector, handler, options = {}) {
    const hostName = this.#target?.constructor?.name || "ControllerEventDelegator";
    if (!this.#container) {
      DebugAgent.warn(`[ControllerEventDelegator.delegate()] Aspis [${hostName}]: delegate() abgebrochen \u2014 kein Container vorhanden.`);
      return;
    }
    if (typeof handler !== "function") {
      DebugAgent.warn(`[ControllerEventDelegator.delegate()] Aspis [${hostName}]: Handler f\xFCr Event '${eventName}' ist keine Funktion.`);
      return;
    }
    const candidate = options.signal || (typeof this.#target?.getSignal === "function" ? this.#target.getSignal() : null);
    const listenerOptions = /** @type {any} */ ({ ...options });
    delete listenerOptions.signal;
    const nativeSignal = this.#nativeAbortSignal(candidate);
    if (nativeSignal) {
      listenerOptions.signal = nativeSignal;
    }
    const listener = (event) => {
      const origin = event.target;
      if (!(origin instanceof Element) || !this.#container) {
        return;
      }
      const matched = origin.closest(selector);
      if (matched instanceof HTMLElement && this.#container.contains(matched) && this.#target) {
        handler.call(this.#target, event, matched);
      }
    };
    this.#container.addEventListener(eventName, listener, listenerOptions);
    if (!nativeSignal && candidate && typeof candidate.addEventListener === "function") {
      candidate.addEventListener("abort", () => {
        if (this.#container) {
          this.#container.removeEventListener(eventName, listener, listenerOptions);
        }
      }, { once: true });
    }
  }
  /** Nur Signale der gleichen Realm wie der Container. jsdom lehnt Node-AbortSignal ab. */
  #nativeAbortSignal(signal) {
    if (!signal || typeof signal.aborted !== "boolean") {
      return null;
    }
    const View = this.#container && this.#container.ownerDocument ? this.#container.ownerDocument.defaultView : null;
    const AbortSignalCtor = View && View.AbortSignal;
    if (typeof AbortSignalCtor === "function") {
      return signal instanceof AbortSignalCtor ? signal : null;
    }
    if (typeof AbortSignal !== "undefined") {
      return signal instanceof AbortSignal ? signal : null;
    }
    return null;
  }
  async initEvents(fetcher = null) {
    if (!this.#dispatcher) return;
    let eventMap = {};
    const hostName = this.#target?.constructor?.name || "ControllerEventDelegator";
    if (this.#options?.eventPath) {
      const initSignal = typeof this.#target?.getSignal === "function" ? this.#target.getSignal("initEvents") : null;
      const activeFetcher = fetcher || this.#options?.fetcher || this.#target?.fetcher;
      try {
        if (activeFetcher && typeof activeFetcher.get === "function") {
          const loaded = await activeFetcher.get(this.#options.eventPath, {}, { signal: initSignal }) || {};
          eventMap = loaded && typeof loaded === "object" ? loaded : {};
        }
      } catch (e) {
        const err = e;
        const isAborted = this.#target?.signal?.aborted;
        if (err.name !== "AbortError" && !isAborted) {
          DebugAgent.error(`[ControllerEventDelegator.initEvents()] Aspis [${hostName}]: Fehler beim Laden von '${this.#options.eventPath}':`, e);
        }
      } finally {
        if (typeof this.#target?.clearTask === "function") {
          this.#target.clearTask("initEvents");
        }
      }
    }
    if (this.#target?.signal?.aborted) return;
    if (this.#container?.dataset?.events) {
      try {
        const inlineMap = JSON.parse(this.#container.dataset.events);
        eventMap = { ...eventMap, ...inlineMap };
      } catch (e) {
        DebugAgent.error(`[ControllerEventDelegator.initEvents()] Aspis [${hostName}]: Fehler beim Parsen von data-events an <${hostName}>:`, e);
      }
    }
    Object.entries(eventMap).forEach(([eventName, methodName]) => {
      if (typeof methodName !== "string" || !this.#target || !this.#dispatcher) {
        return;
      }
      const host = this.#target;
      const method = host[methodName];
      if (typeof method === "function") {
        const unsub = this.#dispatcher.on(eventName, (payload) => {
          method(payload);
        });
        this.#unsubscribeEvents.push(unsub);
      } else {
        DebugAgent.warn(`[ControllerEventDelegator.initEvents()] Aspis [${hostName}]: Event '${eventName}' verweist auf nicht existierende Methode '${methodName}' in ${hostName}.`);
      }
    });
  }
  destroy() {
    this.#unsubscribeEvents.forEach((unsub) => unsub());
    this.#unsubscribeEvents = [];
    this.#container = null;
    this.#dispatcher = null;
    this.#target = null;
    this.#options = null;
  }
}
export {
  ControllerEventDelegator
};
