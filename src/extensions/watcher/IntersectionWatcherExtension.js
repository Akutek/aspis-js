/** @typedef {import("../../types/watchers.js").IntersectionWatcher} IntersectionWatcher */
import { BaseWatcherExtension } from "./BaseWatcherExtension.js";
import { IntersectionWatcherDOM } from "../../utils/IntersectionWatcherDOM.js";
import { DebugErrorManager } from "../../managers/DebugErrorManager.js";
import { RuntimeEnv } from "../../core/RuntimeEnv.js";
const DEFAULT_INIT = Object.freeze({
  root: null,
  rootMargin: "0px",
  threshold: 0
});
class IntersectionWatcherExtension extends BaseWatcherExtension {
  static start(watcher, target, init) {
    if (!watcher) {
      return this;
    }
    this.prepare(watcher);
    if (typeof IntersectionObserver !== "function") {
      DebugErrorManager.warn(
        this.debugOf(watcher),
        "[IntersectionWatcherExtension.start()] IntersectionObserver fehlt."
      );
      return this;
    }
    const root = this.#element(target);
    if (!root) {
      DebugErrorManager.warn(
        this.debugOf(watcher),
        "[IntersectionWatcherExtension.start()] Kein Zielelement."
      );
      return this;
    }
    const runtime = watcher.runtime;
    if (!runtime) {
      return this;
    }
    runtime.config = { ...DEFAULT_INIT, ...init || {} };
    this.#ensureObserver(watcher);
    const observer = runtime.observer;
    observer?.observe(root);
    runtime.roots ??= /* @__PURE__ */ new Set();
    runtime.roots.add(root);
    runtime.watching = true;
    DebugErrorManager.info(
      this.debugOf(watcher),
      "[IntersectionWatcherExtension.start()] Beobachtung aktiv."
    );
    return this;
  }
  static observe(watcher, target, init) {
    if (!watcher?.runtime?.watching) {
      return this.start(watcher, target, init);
    }
    const root = this.#element(target);
    if (!root) {
      return this;
    }
    const observer = watcher.runtime.observer;
    observer?.observe(root);
    watcher.runtime.roots ??= /* @__PURE__ */ new Set();
    watcher.runtime.roots.add(root);
    return this;
  }
  static stop(watcher) {
    this.disconnect(watcher);
    DebugErrorManager.info(
      this.debugOf(watcher),
      "[IntersectionWatcherExtension.stop()] Beobachtung gestoppt."
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
    watcher.runtime.observer = new IntersectionObserver((entries) => {
      this.#onEntries(watcher, entries);
    }, watcher.runtime.config);
  }
  static #onEntries(watcher, entries) {
    const batch = IntersectionWatcherDOM.split(entries);
    if (watcher.runtime) {
      watcher.runtime.lastEntries = batch;
    }
    DebugErrorManager.log(
      this.debugOf(watcher),
      `[IntersectionWatcherExtension.#onEntries()] sichtbar ${batch.shown.length}, verdeckt ${batch.hidden.length}.`
    );
  }
  static #element(target) {
    if (target instanceof Element) {
      return target;
    }
    return RuntimeEnv.documentElement();
  }
}
export {
  IntersectionWatcherExtension
};
