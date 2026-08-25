/** @typedef {import("../types/registry.js").RegistryKey} RegistryKey */
/** @typedef {import("../types/registry.js").RegistryService} RegistryService */
/** @typedef {import("../types/registry.js").RegistryEntries} RegistryEntries */
/** @typedef {import("../types/registry.js").ManifestData} ManifestData */
/** @typedef {import("../types/cache.js").Cache} Cache */
import { Registry } from "../core/Registry.js";
import { Store } from "../core/Store.js";
import { ManifestLoaderService } from "../services/ManifestLoaderService.js";
import { DebugAgent } from "../agents/DebugAgent.js";
class RegistryManager {
  static init(cache = null) {
    const registry = new Registry();
    const store = new Store({}, {}, cache);
    this.register(registry, { store });
    DebugAgent.info("[RegistryManager.init()] Registry und Store angelegt.");
    return registry;
  }
  static register(registry, keyOrMap, instance) {
    if (!registry || keyOrMap == null) return;
    if (typeof keyOrMap === "string") {
      registry.set(keyOrMap, instance);
      return;
    }
    for (const [key, value] of Object.entries(keyOrMap)) {
      registry.set(key, value);
    }
  }
  static get(registry, key) {
    return registry.get(key);
  }
  /** Bindet eine Controller-Instanz an ein DOM-Element (WeakMap). */
  static bind(registry, element, instance) {
    if (!registry || !(element instanceof HTMLElement)) {
      return;
    }
    registry.set(element, instance);
  }
  static unbind(registry, element) {
    if (!registry || !(element instanceof HTMLElement)) {
      return false;
    }
    return registry.delete(element);
  }
  static async load(path, hydrator = null) {
    return ManifestLoaderService.load(path, hydrator);
  }
}
export {
  RegistryManager
};
