/** @typedef {import("../../types/watchers.js").ReportingWatcher} ReportingWatcher */
import { BaseWatcherExtension } from "./BaseWatcherExtension.js";
import { DebugErrorManager } from "../../managers/DebugErrorManager.js";
const DEFAULT_TYPES = Object.freeze(["deprecation", "intervention"]);
class ReportingWatcherExtension extends BaseWatcherExtension {
  static start(watcher, init) {
    if (!watcher) {
      return this;
    }
    this.prepare(watcher);
    if (typeof ReportingObserver !== "function") {
      DebugErrorManager.warn(
        this.debugOf(watcher),
        "[ReportingWatcherExtension.start()] ReportingObserver fehlt."
      );
      return this;
    }
    const options = init && typeof init === "object" ? init : {};
    const types = Array.isArray(options.types) && options.types.length > 0 ? options.types : DEFAULT_TYPES.slice();
    if (!watcher.runtime) {
      return this;
    }
    watcher.runtime.config = { types };
    this.#ensureObserver(watcher, types);
    try {
      const observer = watcher.runtime.observer;
      observer?.observe();
      watcher.runtime.watching = true;
      DebugErrorManager.info(
        this.debugOf(watcher),
        `[ReportingWatcherExtension.start()] Beobachtung aktiv (${types.join(", ")}).`
      );
    } catch (error) {
      DebugErrorManager.capture(
        this.errorOf(watcher),
        error,
        "[ReportingWatcherExtension.start()]"
      );
    }
    return this;
  }
  static stop(watcher) {
    this.disconnect(watcher);
    DebugErrorManager.info(
      this.debugOf(watcher),
      "[ReportingWatcherExtension.stop()] Beobachtung gestoppt."
    );
    return this;
  }
  static #ensureObserver(watcher, types) {
    if (watcher.runtime?.observer) {
      return;
    }
    if (!watcher.runtime) {
      return;
    }
    watcher.runtime.observer = new ReportingObserver((reports) => {
      if (!watcher.runtime) {
        return;
      }
      watcher.runtime.lastEntries = Array.isArray(reports) ? reports.slice() : [];
      DebugErrorManager.warn(
        this.debugOf(watcher),
        `[ReportingWatcherExtension] ${watcher.runtime.lastEntries.length} Reports.`
      );
    }, { types, buffered: true });
  }
}
export {
  ReportingWatcherExtension
};
