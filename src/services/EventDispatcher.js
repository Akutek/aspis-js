/** @typedef {import("../types/utils.js").UnsubscribeFunction} UnsubscribeFunction */
/** @typedef {import("../types/events.js").EventManifest} EventManifest */
/** @typedef {import("../types/events.js").EventListenerCallback} EventListenerCallback */
/** @typedef {import("../types/events.js").ClickOutsideCallback} ClickOutsideCallback */
/** @typedef {import("../types/events.js").ListenersMap} ListenersMap */
/** @typedef {import("../types/events.js").GlobalClickHandler} GlobalClickHandler */
import { ErrorAgent } from "../agents/ErrorAgent.js";
class EventDispatcher {
  #listeners = /* @__PURE__ */ new Map();
  #eventManifest;
  #clickTrackerHandler = null;
  constructor(eventManifest = {}) {
    this.#eventManifest = eventManifest;
    this.#initGlobalClickTracker();
  }
  get manifest() {
    return this.#eventManifest;
  }
  on(eventName, callback) {
    if (typeof callback !== "function") return () => {
    };
    if (!this.#listeners.has(eventName)) {
      this.#listeners.set(eventName, /* @__PURE__ */ new Set());
    }
    this.#listeners.get(eventName)?.add(callback);
    return () => this.off(eventName, callback);
  }
  /** Einmaliger Listener: nach der ersten Ausführung automatisch entfernt. */
  once(eventName, callback) {
    if (typeof callback !== "function") return () => {
    };
    const unsubscribe = this.on(eventName, (data) => {
      unsubscribe();
      callback(data);
    });
    return unsubscribe;
  }
  off(eventName, callback) {
    const eventListeners = this.#listeners.get(eventName);
    if (eventListeners) {
      eventListeners.delete(callback);
      if (eventListeners.size === 0) {
        this.#listeners.delete(eventName);
      }
    }
  }
  /** Löst ein Event asynchron über Microtasks aus und übergibt Daten an alle registrierten Listener. */
  emit(eventName, data = null) {
    const eventListeners = this.#listeners.get(eventName);
    if (!eventListeners) return;
    const targets = Array.from(eventListeners);
    targets.forEach((callback) => {
      Promise.resolve().then(() => callback(data)).catch((error) => {
        ErrorAgent.shared().capture(
          error,
          `[EventDispatcher.emit()] Fehler bei '${eventName}'.`
        );
      });
    });
  }
  /** Registriert einen Callback, der ausgeführt wird, sobald ein Klick außerhalb des angegebenen HTML-Elements erfolgt. */
  onClickOutside(element, callback) {
    if (!(element instanceof HTMLElement) || typeof callback !== "function") {
      return () => {
      };
    }
    return this.on("document:click", (clickedElement) => {
      if (clickedElement instanceof Node && !element.contains(clickedElement)) {
        callback();
      }
    });
  }
  clear() {
    this.#listeners.clear();
  }
  /** Leert Listener und entfernt den globalen Document-Click-Tracker. */
  destroy() {
    this.clear();
    if (this.#clickTrackerHandler) {
      document.removeEventListener("click", this.#clickTrackerHandler);
      this.#clickTrackerHandler = null;
    }
  }
  #initGlobalClickTracker() {
    this.#clickTrackerHandler = (event) => {
      this.emit("document:click", event.target);
    };
    document.addEventListener("click", this.#clickTrackerHandler);
  }
}
export {
  EventDispatcher
};
