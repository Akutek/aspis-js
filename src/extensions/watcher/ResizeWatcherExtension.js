/** @typedef {import("../../types/watchers.js").ResizeWatcher} ResizeWatcher */
import { BaseWatcherExtension } from "./BaseWatcherExtension.js";
import { ResizeWatcherDOM } from "../../utils/ResizeWatcherDOM.js";
import { DebugErrorManager } from "../../managers/DebugErrorManager.js";
import { RuntimeEnv } from "../../core/RuntimeEnv.js";
class ResizeWatcherExtension extends BaseWatcherExtension {
  static start(watcher, target) {
    if (!watcher) {
      return this;
    }
    this.prepare(watcher);
    if (typeof ResizeObserver !== "function") {
      DebugErrorManager.warn(
        this.debugOf(watcher),
        "[ResizeWatcherExtension.start()] ResizeObserver fehlt."
      );
      return this;
    }
    const root = this.#element(target);
    if (!root) {
      DebugErrorManager.warn(
        this.debugOf(watcher),
        "[ResizeWatcherExtension.start()] Kein Zielelement."
      );
      return this;
    }
    this.#ensureObserver(watcher);
    const runtime = watcher.runtime;
    if (!runtime) {
      return this;
    }
    const observer = runtime.observer;
    observer?.observe(root);
    runtime.roots ??= /* @__PURE__ */ new Set();
    runtime.roots.add(root);
    runtime.watching = true;
    DebugErrorManager.info(
      this.debugOf(watcher),
      "[ResizeWatcherExtension.start()] Beobachtung aktiv."
    );
    return this;
  }
  static observe(watcher, target) {
    if (!watcher?.runtime?.watching) {
      return this.start(watcher, target);
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
      "[ResizeWatcherExtension.stop()] Beobachtung gestoppt."
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
    watcher.runtime.observer = new ResizeObserver((entries) => {
      this.#onEntries(watcher, entries);
    });
  }
  static #onEntries(watcher, entries) {
    const sizes = ResizeWatcherDOM.collect(entries);
    if (watcher.runtime) {
      watcher.runtime.lastEntries = sizes;
    }
    DebugErrorManager.log(
      this.debugOf(watcher),
      `[ResizeWatcherExtension.#onEntries()] ${sizes.length} Ma\xDFe.`
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
  ResizeWatcherExtension
};
