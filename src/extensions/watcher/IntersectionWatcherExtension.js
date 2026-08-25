/** @typedef {import("../../types/watchers.js").IntersectionWatcher} IntersectionWatcher */
import { BaseWatcherExtension } from "./BaseWatcherExtension.js";
import { IntersectionWatcherDOM } from "../../utils/IntersectionWatcherDOM.js";
import { DebugErrorManager } from "../../managers/DebugErrorManager.js";
import { RegistryManager } from "../../managers/RegistryManager.js";
const DEFAULT_INIT = Object.freeze({
  root: null,
  rootMargin: "100%",
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
    const runtime = watcher.runtime;
    if (!runtime) {
      return this;
    }
    runtime.config = { ...DEFAULT_INIT, ...init || {} };
    this.#ensureObserver(watcher);
    runtime.watching = true;
    const node = this.#element(target);
    if (node) {
      runtime.observer?.observe(node);
      runtime.roots ??= /* @__PURE__ */ new Set();
      runtime.roots.add(node);
    }
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
    const registry = watcher.runtime?.registry ?? null;
    if (!registry || typeof registry.has !== "function") {
      return;
    }
    let pull = false;
    for (let i = 0; i < batch.shown.length; i += 1) {
      const target = batch.shown[i].target;
      if (target instanceof HTMLElement && !registry.has(target)) {
        pull = true;
        break;
      }
    }
    if (pull) {
      void this.#pull(watcher, registry);
    }
  }
  static async #pull(watcher, registry) {
    try {
      await Promise.resolve();
      if (!registry.has("cycle")) {
        DebugErrorManager.warn(
          this.debugOf(watcher),
          "[IntersectionWatcherExtension.#pull()] Kein cycle in der Registry."
        );
        return;
      }
      const cycle = RegistryManager.get(registry, "cycle");
      if (typeof cycle === "function") {
        await cycle();
      }
      this.#releaseMounted(watcher, registry);
    } catch (error) {
      DebugErrorManager.capture(
        this.errorOf(watcher),
        error,
        "[IntersectionWatcherExtension.#pull()]"
      );
    }
  }
  static #releaseMounted(watcher, registry) {
    const observer = watcher.runtime?.observer;
    const roots = watcher.runtime?.roots;
    if (!observer || !(roots instanceof Set)) {
      return;
    }
    for (const root of [...roots]) {
      if (root instanceof HTMLElement && registry.has(root)) {
        observer.unobserve(root);
        roots.delete(root);
      }
    }
  }
  static #element(target) {
    return target instanceof Element ? target : null;
  }
}
export {
  IntersectionWatcherExtension
};
