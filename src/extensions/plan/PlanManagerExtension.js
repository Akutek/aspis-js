/** @typedef {import("../../types/managers.js").Registry} Registry */
/** @typedef {import("../../types/managers.js").ScanResults} ScanResults */
/** @typedef {import("../../types/managers.js").Plan} Plan */
/** @typedef {import("../../types/managers.js").PlanItem} PlanItem */
/** @typedef {import("../../types/managers.js").ControllerScanResult} ControllerScanResult */
/** @typedef {import("../../types/cache.js").Cache} Cache */
import { CacheManager } from "../../managers/CacheManager.js";
import { ImportManager } from "../../managers/ImportManager.js";
import { RegistryManager } from "../../managers/RegistryManager.js";
import { DebugErrorManager } from "../../managers/DebugErrorManager.js";
import { DebugAgent } from "../../agents/DebugAgent.js";
import { ControllerTrigger } from "../../utils/ControllerTrigger.js";
import { AssetPath } from "../../core/AssetPath.js";
function isPlanBag(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function stringList(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item) => typeof item === "string");
}
class PlanManagerExtension {
  static get cacheKey() {
    return "plan:current";
  }
  static get indexCacheKey() {
    return "manifest:index:plan";
  }
  static get hydratorSpecifier() {
    return "hydrators.PlanManifestHydrator";
  }
  static empty(scanResults) {
    const list = Array.isArray(scanResults) ? scanResults : [];
    return { scanResults: list, items: [], specifiers: [], needs: [], watchers: [] };
  }
  static async build(registry, scanResults) {
    const list = Array.isArray(scanResults) ? scanResults : [];
    const catalog = await this.#catalog(registry);
    const entries = catalog.entries && typeof catalog.entries === "object" ? catalog.entries : {};
    const items = [];
    const specifiers = /* @__PURE__ */ new Set();
    const needs = /* @__PURE__ */ new Set();
    const watchers = /* @__PURE__ */ new Set();
    const portions = /* @__PURE__ */ new Map();
    for (let i = 0; i < list.length; i += 1) {
      const scan = list[i];
      const type = ControllerTrigger.normalize(scan?.type);
      const layout = this.#token(scan?.layout);
      const resolved = this.#resolveEntry(entries, type, layout);
      if (!type || !resolved.entry) {
        continue;
      }
      let portion = portions.get(resolved.key);
      if (!portion) {
        portion = await this.#portion(registry, type, resolved.entry, resolved.key);
        portions.set(resolved.key, portion);
      }
      if (!this.#matches(portion, scan)) {
        continue;
      }
      const itemSpecifiers = stringList(portion.specifiers);
      const itemNeeds = stringList(portion.needs);
      const itemWatchers = stringList(portion.watchers);
      const itemMixins = stringList(portion.mixins);
      const itemCompositions = stringList(portion.compositions);
      for (let s = 0; s < itemSpecifiers.length; s += 1) {
        specifiers.add(itemSpecifiers[s]);
      }
      for (let n = 0; n < itemNeeds.length; n += 1) {
        needs.add(itemNeeds[n]);
      }
      for (let w = 0; w < itemWatchers.length; w += 1) {
        watchers.add(itemWatchers[w]);
      }
      for (let m = 0; m < itemMixins.length; m += 1) {
        specifiers.add(itemMixins[m]);
      }
      items.push({
        type,
        layout: this.#token(scan.layout) || "default",
        element: scan.element,
        sliceKey: typeof scan.sliceKey === "string" && scan.sliceKey ? scan.sliceKey : null,
        specifiers: itemSpecifiers.slice(),
        needs: itemNeeds.slice(),
        watchers: itemWatchers.slice(),
        mixins: itemMixins.slice(),
        compositions: itemCompositions.slice()
      });
    }
    if (list.length > 0 && items.length === 0) {
      const types = list.map((scan) => ControllerTrigger.normalize(scan?.type)).filter(Boolean);
      const debug = registry && typeof registry.has === "function" && registry.has("debug") ? RegistryManager.get(registry, "debug") : DebugAgent.shared();
      DebugErrorManager.warn(
        debug,
        `[PlanManagerExtension.build()] ${list.length} Scan(s), 0 Plan-Treffer. Typen: ${types.join(", ") || "\u2014"}. Erwartet Keys: accordion, table, form, dropdown, modal.`
      );
    }
    return {
      scanResults: list,
      items,
      specifiers: [...specifiers],
      needs: [...needs],
      watchers: [...watchers]
    };
  }
  static async #catalog(registry) {
    const cached = this.#cacheGet(registry, this.indexCacheKey);
    if (isPlanBag(cached) && cached.kind === "index") {
      return cached;
    }
    const route = this.#planRoute(registry);
    const path = this.#path(route);
    if (!path) {
      throw new Error("Aspis [PlanManagerExtension]: manifestRouting.plan fehlt oder ist unvollst\xE4ndig.");
    }
    const hydrator = await this.#hydrator(registry);
    const loaded = await RegistryManager.load(path, hydrator);
    const catalog = this.#asIndex(isPlanBag(loaded) ? loaded : {});
    this.#cacheSet(registry, this.indexCacheKey, catalog);
    return catalog;
  }
  static async #portion(registry, type, entry, cacheId = type) {
    if (entry && entry.kind === "portion") {
      return entry;
    }
    const cacheKey = `manifest:plan:${cacheId || type}`;
    const cached = this.#cacheGet(registry, cacheKey);
    if (isPlanBag(cached) && cached.kind === "portion") {
      return cached;
    }
    const path = this.#path(entry);
    if (!path) {
      throw new Error(`Aspis [PlanManagerExtension]: Kein Pfad f\xFCr Plan-Portion '${type}'.`);
    }
    const hydrator = await this.#hydrator(registry);
    const loaded = await RegistryManager.load(path, hydrator);
    const portion = this.#asPortion(loaded, type);
    this.#cacheSet(registry, cacheKey, portion);
    return portion;
  }
  /** Layout-spezifische Portion vor dem Typ: `form.simple`, dann `form-simple`, dann `form`. */
  static #resolveEntry(entries, type, layout) {
    const keys = this.#entryKeys(type, layout);
    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i];
      if (entries[key]) {
        return { key, entry: entries[key] };
      }
    }
    return { key: type, entry: null };
  }
  static #entryKeys(type, layout) {
    const keys = [];
    if (type && layout && layout !== "default") {
      keys.push(`${type}.${layout}`, `${type}-${layout}`);
    }
    if (type) {
      keys.push(type);
    }
    return keys;
  }
  static #matches(portion, scan) {
    const trigger = portion?.trigger && typeof portion.trigger === "object" ? portion.trigger : {};
    const scanType = ControllerTrigger.normalize(scan?.type);
    if (typeof trigger.type === "string" && trigger.type && trigger.type !== scanType) {
      return false;
    }
    if (typeof trigger.layout === "string" && trigger.layout && trigger.layout !== this.#token(scan?.layout)) {
      return false;
    }
    return true;
  }
  static async #hydrator(registry) {
    const loaded = await ImportManager.import(registry, this.hydratorSpecifier);
    return typeof loaded?.hydrate === "function" ? loaded : null;
  }
  static #planRoute(registry) {
    const manifest = RegistryManager.get(registry, "registryManifest");
    const routing = manifest?.manifestRouting && typeof manifest.manifestRouting === "object" ? manifest.manifestRouting : {};
    return routing.plan && typeof routing.plan === "object" ? routing.plan : {};
  }
  static #asIndex(loaded) {
    if (loaded?.kind === "index" && loaded.entries && typeof loaded.entries === "object") {
      return loaded;
    }
    if (!loaded || typeof loaded !== "object" || loaded.kind === "portion") {
      return { kind: "index", entries: {} };
    }
    const entries = loaded.entries && typeof loaded.entries === "object" ? loaded.entries : loaded;
    return { kind: "index", entries };
  }
  static #asPortion(loaded, type) {
    if (loaded?.kind === "portion") {
      return loaded;
    }
    const trigger = loaded?.trigger && typeof loaded.trigger === "object" ? loaded.trigger : {};
    return {
      kind: "portion",
      trigger: {
        type: ControllerTrigger.normalize(trigger.type) || type,
        layout: this.#token(trigger.layout)
      },
      specifiers: Array.isArray(loaded?.specifiers) ? loaded.specifiers : [],
      needs: Array.isArray(loaded?.needs) ? loaded.needs : [],
      watchers: Array.isArray(loaded?.watchers) ? loaded.watchers : [],
      mixins: Array.isArray(loaded?.mixins) ? loaded.mixins : [],
      compositions: Array.isArray(loaded?.compositions) ? loaded.compositions : []
    };
  }
  static #path(entry) {
    if (!entry || typeof entry !== "object") {
      return "";
    }
    const directory = typeof entry.directory === "string" ? entry.directory : null;
    const file = typeof entry.file === "string" ? entry.file : null;
    return AssetPath.join(directory, file);
  }
  static #token(value) {
    return typeof value === "string" ? value.trim().toLowerCase() : "";
  }
  static #cacheGet(registry, key) {
    const cache = RegistryManager.get(registry, "cache");
    if (!cache) {
      return null;
    }
    return CacheManager.get(cache, key);
  }
  static #cacheSet(registry, key, value) {
    const cache = RegistryManager.get(registry, "cache");
    if (!cache) {
      return;
    }
    CacheManager.set(cache, key, value);
  }
}
export {
  PlanManagerExtension
};
