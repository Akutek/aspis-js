/** @typedef {import("../../agents/DebugAgent.js").DebugAgent} DebugAgent */
/** @typedef {import("../../agents/ErrorAgent.js").ErrorAgent} ErrorAgent */
/** @typedef {import("../../types/watchers.js").MutationWatcher} MutationWatcher */
/** @typedef {import("../../types/registry.js").Registry} Registry */
import { BaseWatcherExtension } from "./BaseWatcherExtension.js";
import { MutationWatcherDOM } from "../../utils/MutationWatcherDOM.js";
import { ControllerCleaner } from "../../services/ControllerCleaner.js";
import { RegistryManager } from "../../managers/RegistryManager.js";
import { DebugErrorManager } from "../../managers/DebugErrorManager.js";
import { RuntimeEnv } from "../../core/RuntimeEnv.js";
const DEFAULT_INIT = Object.freeze({
  childList: true,
  subtree: true
});
class MutationWatcherExtension extends BaseWatcherExtension {
  static prepare(watcher) {
    super.prepare(watcher);
    if (!watcher?.runtime) {
      return this;
    }
    if (watcher.runtime.observer == null) {
      watcher.runtime.observer = null;
    }
    if (!(watcher.runtime.roots instanceof Set)) {
      watcher.runtime.roots = /* @__PURE__ */ new Set();
    }
    if (typeof watcher.runtime.watching !== "boolean") {
      watcher.runtime.watching = false;
    }
    if (watcher.runtime.registry === void 0) {
      watcher.runtime.registry = null;
    }
    if (!watcher.runtime.config) {
      watcher.runtime.config = { ...DEFAULT_INIT };
    }
    return this;
  }
  static bind(watcher, registry = null) {
    super.bind(watcher, registry);
    return this;
  }
  static start(watcher, target, init) {
    if (!watcher) {
      return this;
    }
    this.prepare(watcher);
    const root = this.#root(target);
    if (!root) {
      DebugErrorManager.warn(
        this.#debug(watcher),
        "[MutationWatcherExtension.start()] Kein Zielknoten."
      );
      return this;
    }
    const config = this.#config(watcher, init);
    this.#ensureObserver(watcher);
    const runtime = watcher.runtime;
    if (!runtime) {
      return this;
    }
    const observer = runtime.observer;
    observer?.observe(root, config);
    runtime.roots ??= /* @__PURE__ */ new Set();
    runtime.roots.add(root);
    runtime.watching = true;
    DebugErrorManager.info(
      this.#debug(watcher),
      "[MutationWatcherExtension.start()] Beobachtung aktiv."
    );
    return this;
  }
  static observe(watcher, target, init) {
    if (!watcher?.runtime?.watching) {
      return this.start(watcher, target, init);
    }
    const root = this.#root(target);
    if (!root) {
      return this;
    }
    const config = this.#config(watcher, init);
    const observer = watcher.runtime.observer;
    observer?.observe(root, config);
    watcher.runtime.roots ??= /* @__PURE__ */ new Set();
    watcher.runtime.roots.add(root);
    return this;
  }
  static stop(watcher) {
    if (!watcher?.runtime) {
      return this;
    }
    if (watcher.runtime.observer) {
      watcher.runtime.observer.disconnect();
      watcher.runtime.observer = null;
    }
    if (watcher.runtime.roots instanceof Set) {
      watcher.runtime.roots.clear();
    }
    watcher.runtime.watching = false;
    DebugErrorManager.info(
      this.#debug(watcher),
      "[MutationWatcherExtension.stop()] Beobachtung gestoppt."
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
    watcher.runtime.observer = new MutationObserver((records) => {
      this.#onRecords(watcher, records);
    });
  }
  static #onRecords(watcher, records) {
    const batch = MutationWatcherDOM.collect(records);
    const registry = watcher.runtime?.registry ?? null;
    for (let i = 0; i < batch.removed.length; i += 1) {
      ControllerCleaner.cleanTree(registry, batch.removed[i]);
    }
    if (batch.added.length === 0) {
      return;
    }
    if (!registry) {
      DebugErrorManager.warn(
        this.#debug(watcher),
        "[MutationWatcherExtension.#onRecords()] Keine Registry, Scan \xFCbersprungen."
      );
      return;
    }
    void this.#rescan(watcher, registry, batch.added);
  }
  static async #rescan(watcher, registry, added) {
    if (!Array.isArray(added) || added.length === 0) {
      return;
    }
    try {
      const cycle = RegistryManager.get(registry, "cycle");
      if (typeof cycle === "function") {
        const root = this.#scanRoot(added);
        if (root) {
          await cycle(root);
        } else {
          await cycle();
        }
        return;
      }
      DebugErrorManager.warn(
        this.#debug(watcher),
        "[MutationWatcherExtension.#rescan()] Kein cycle in der Registry \u2014 DOM-\xC4nderung ohne Re-Plan."
      );
    } catch (error) {
      DebugErrorManager.capture(
        this.#error(watcher),
        error,
        "[MutationWatcherExtension.#rescan()]"
      );
    }
  }
  static #scanRoot(added) {
    if (!Array.isArray(added) || added.length === 0) {
      return null;
    }
    const first = added[0];
    if (!(first instanceof HTMLElement)) {
      return RuntimeEnv.documentElement();
    }
    if (added.length === 1) {
      return first;
    }
    const parent = first.parentElement;
    if (!(parent instanceof Element)) {
      return first;
    }
    for (let i = 1; i < added.length; i += 1) {
      const node = added[i];
      if (!(node instanceof HTMLElement) || !parent.contains(node)) {
        return RuntimeEnv.documentElement();
      }
    }
    return parent;
  }
  static #root(target) {
    if (target instanceof Node) {
      return target;
    }
    return RuntimeEnv.body();
  }
  static #config(watcher, init) {
    if (init && typeof init === "object" && watcher.runtime) {
      watcher.runtime.config = { ...DEFAULT_INIT, ...init };
    }
    return watcher.runtime?.config || { ...DEFAULT_INIT };
  }
  static #debug(watcher) {
    return this.debugOf(watcher);
  }
  static #error(watcher) {
    return this.errorOf(watcher);
  }
}
export {
  MutationWatcherExtension
};
