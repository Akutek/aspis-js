/** @typedef {import("../../types/watchers.js").PerformanceWatcher} PerformanceWatcher */
import { BaseWatcherExtension } from "./BaseWatcherExtension.js";
import { DebugErrorManager } from "../../managers/DebugErrorManager.js";
const DEFAULT_TYPES = Object.freeze(["navigation", "paint"]);
class PerformanceWatcherExtension extends BaseWatcherExtension {
  static start(watcher, init) {
    if (!watcher) {
      return this;
    }
    this.prepare(watcher);
    if (typeof PerformanceObserver !== "function") {
      DebugErrorManager.warn(
        this.debugOf(watcher),
        "[PerformanceWatcherExtension.start()] PerformanceObserver fehlt."
      );
      return this;
    }
    const options = init && typeof init === "object" ? init : {};
    const requested = Array.isArray(options.entryTypes) && options.entryTypes.length > 0 ? options.entryTypes : DEFAULT_TYPES.slice();
    const supported = typeof PerformanceObserver.supportedEntryTypes !== "undefined" ? requested.filter((type) => PerformanceObserver.supportedEntryTypes.includes(type)) : requested;
    if (supported.length === 0) {
      DebugErrorManager.warn(
        this.debugOf(watcher),
        "[PerformanceWatcherExtension.start()] Keine unterst\xFCtzten entryTypes."
      );
      return this;
    }
    if (!watcher.runtime) {
      return this;
    }
    watcher.runtime.config = { entryTypes: supported };
    this.#ensureObserver(watcher);
    try {
      const observer = watcher.runtime.observer;
      observer?.observe({ entryTypes: supported, buffered: true });
      watcher.runtime.watching = true;
      DebugErrorManager.info(
        this.debugOf(watcher),
        `[PerformanceWatcherExtension.start()] Beobachtung aktiv (${supported.join(", ")}).`
      );
    } catch (error) {
      DebugErrorManager.capture(
        this.errorOf(watcher),
        error,
        "[PerformanceWatcherExtension.start()]"
      );
    }
    return this;
  }
  static stop(watcher) {
    this.disconnect(watcher);
    DebugErrorManager.info(
      this.debugOf(watcher),
      "[PerformanceWatcherExtension.stop()] Beobachtung gestoppt."
    );
    return this;
  }
  static #ensureObserver(watcher) {
    if (watcher.runtime?.observer) {
      return;
    }
    if (!watcher.runtime) {
      return;
    }
    watcher.runtime.observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      if (watcher.runtime) {
        watcher.runtime.lastEntries = entries.slice();
      }
      DebugErrorManager.log(
        this.debugOf(watcher),
        `[PerformanceWatcherExtension] ${entries.length} Eintr\xE4ge.`
      );
    });
  }
}
export {
  PerformanceWatcherExtension
};
