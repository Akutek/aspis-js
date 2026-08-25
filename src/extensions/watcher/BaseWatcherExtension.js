/** @typedef {import("../../types/registry.js").Registry} Registry */
/** @typedef {import("../../types/watchers.js").BaseWatcher} BaseWatcher */
import { BaseExtension } from "../BaseExtension.js";
import { DebugAgent } from "../../agents/DebugAgent.js";
import { ErrorAgent } from "../../agents/ErrorAgent.js";
import { RegistryManager } from "../../managers/RegistryManager.js";
class BaseWatcherExtension extends BaseExtension {
  static prepare(watcher) {
    const runtime = watcher?.runtime;
    super.prepare(watcher, {
      kind: watcher?.kind || "",
      debug: runtime?.debug ?? null,
      error: runtime?.error ?? null,
      observer: runtime && "observer" in runtime ? runtime.observer : null,
      roots: runtime?.roots instanceof Set ? runtime.roots : /* @__PURE__ */ new Set(),
      watching: typeof runtime?.watching === "boolean" ? runtime.watching : false,
      registry: runtime && "registry" in runtime ? runtime.registry : null,
      config: runtime?.config ?? null,
      lastEntries: Array.isArray(runtime?.lastEntries) ? runtime.lastEntries : []
    });
    if (watcher.manifest == null) {
      watcher.manifest = {};
    }
    return this;
  }
  static bind(watcher, registry = null) {
    if (!watcher) {
      return this;
    }
    if (!watcher.runtime) {
      this.prepare(watcher);
    }
    if (!watcher.runtime) {
      return this;
    }
    watcher.runtime.debug = BaseWatcherExtension.#debugFrom(registry);
    watcher.runtime.error = BaseWatcherExtension.#errorFrom(registry);
    watcher.runtime.registry = registry;
    return this;
  }
  static debugOf(watcher) {
    return watcher?.runtime?.debug || DebugAgent.shared();
  }
  static errorOf(watcher) {
    return watcher?.runtime?.error || ErrorAgent.shared();
  }
  static disconnect(watcher) {
    if (!watcher?.runtime) {
      return this;
    }
    const observer = watcher.runtime.observer;
    if (observer && typeof observer.disconnect === "function") {
      observer.disconnect();
    }
    watcher.runtime.observer = null;
    watcher.runtime.watching = false;
    if (watcher.runtime.roots instanceof Set) {
      watcher.runtime.roots.clear();
    }
    return this;
  }
  static #debugFrom(registry) {
    if (registry && typeof registry.has === "function" && registry.has("debug")) {
      return RegistryManager.get(registry, "debug");
    }
    return DebugAgent.shared();
  }
  static #errorFrom(registry) {
    if (registry && typeof registry.has === "function" && registry.has("error")) {
      return RegistryManager.get(registry, "error");
    }
    return ErrorAgent.shared();
  }
}
export {
  BaseWatcherExtension
};
