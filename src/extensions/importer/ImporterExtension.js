/** @typedef {import("../../types/importer.js").Importer} Importer */
/** @typedef {import("../../types/importer.js").ImportRoute} ImportRoute */
/** @typedef {import("../../types/extensions.js").ExtensionHost} ExtensionHost */
import { BaseExtension } from "../BaseExtension.js";
import { CacheManager } from "../../managers/CacheManager.js";
import { ManifestLoaderService } from "../../services/ManifestLoaderService.js";
import { DebugAgent } from "../../agents/DebugAgent.js";
import { ErrorAgent } from "../../agents/ErrorAgent.js";
import { AssetPath } from "../../core/AssetPath.js";
import { RouteIndexHydrator } from "../../hydrators/RouteIndexHydrator.js";
class ImporterExtension extends BaseExtension {
  static prepare(host, seed = {}) {
    const importer = host;
    super.prepare(host, {
      modules: /* @__PURE__ */ new Map(),
      indexes: /* @__PURE__ */ new Map(),
      pending: /* @__PURE__ */ new Map(),
      loading: [],
      ...seed
    });
    if (importer.manifest == null) {
      importer.manifest = { classRouting: {} };
    }
    return this;
  }
  static apply(host, manifest = {}) {
    const importer = host;
    const bag = manifest;
    super.apply(host, {
      classRouting: bag.classRouting || {},
      boot: bag.boot || {},
      manifestRouting: bag.manifestRouting || {}
    });
    if (importer.cache) {
      CacheManager.set(importer.cache, "manifest:imports", importer.manifest);
    }
    DebugAgent.info("[ImporterExtension.apply()] Import-Katalog gesetzt.", importer.manifest.classRouting);
    return this;
  }
  static graft(host, extraManifest = {}) {
    const importer = host;
    const base = importer.manifest || {};
    const extra = extraManifest;
    const extraRouting = extra.classRouting && typeof extra.classRouting === "object" ? extra.classRouting : {};
    importer.manifest = {
      ...base,
      ...extra,
      classRouting: { ...base.classRouting || {}, ...extraRouting }
    };
    if (importer.cache) {
      CacheManager.set(importer.cache, "manifest:imports", importer.manifest);
    }
    return this;
  }
  /** Lädt eine Klasse anhand eines Katalog-Schlüssels (`gruppe.Klassenname`). */
  static async import(importer, specifier) {
    if (!importer?.runtime) this.prepare(importer);
    const key = typeof specifier === "string" ? specifier.trim() : "";
    if (!key || !key.includes(".")) {
      this.#fail(`Ung\xFCltiger Specifier '${specifier}'. Erwartet: gruppe.Name`);
    }
    const runtime = importer.runtime;
    if (!runtime) {
      this.#fail(`Importer ohne Runtime f\xFCr '${key}'.`);
    }
    const stack = Array.isArray(runtime.loading) ? runtime.loading : [];
    runtime.loading = stack;
    if (stack.includes(key)) {
      this.#fail(`Zyklus ${[...stack, key].join(" \u2192 ")}`);
    }
    if (runtime.modules.has(key)) {
      return runtime.modules.get(key) ?? null;
    }
    if (runtime.pending.has(key)) {
      return runtime.pending.get(key);
    }
    const job = this.#load(importer, key).finally(() => {
      runtime.pending.delete(key);
    });
    runtime.pending.set(key, job);
    return job;
  }
  static async #load(importer, specifier) {
    const runtime = importer.runtime;
    if (!runtime) {
      this.#fail(`Importer ohne Runtime f\xFCr '${specifier}'.`);
    }
    const stack = Array.isArray(runtime.loading) ? runtime.loading : [];
    runtime.loading = stack;
    stack.push(specifier);
    try {
      const dot = specifier.indexOf(".");
      const group = specifier.slice(0, dot);
      const name = specifier.slice(dot + 1);
      const route = importer.manifest?.classRouting?.[group];
      if (!route) {
        this.#fail(`Keine classRouting-Gruppe '${group}'.`);
      }
      const index = await this.#index(importer, group, route);
      const table = index;
      const entry = table[name];
      if (!entry) {
        this.#fail(`'${name}' fehlt im Index '${group}'.`);
      }
      const path = this.#path(entry);
      if (!path) {
        this.#fail(`Kein Pfad f\xFCr '${specifier}'.`);
      }
      let module;
      try {
        module = await this.#module(path);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        this.#fail(`Modul '${path}' nicht geladen (${reason}).`);
      }
      const exported = this.#pick(module, entry.export || "", name, specifier);
      runtime.modules.set(specifier, exported);
      this.#announce(importer, specifier, exported);
      return exported;
    } finally {
      const at = stack.lastIndexOf(specifier);
      if (at >= 0) {
        stack.splice(at, 1);
      }
    }
  }
  static async #index(importer, group, route) {
    const runtime = importer.runtime;
    if (!runtime) {
      this.#fail(`Importer ohne Runtime f\xFCr Index '${group}'.`);
    }
    if (runtime.indexes.has(group)) {
      return runtime.indexes.get(group) ?? {};
    }
    const path = this.#path(route);
    const cacheKey = `manifest:index:${group}`;
    if (importer.cache) {
      const cached = CacheManager.get(importer.cache, cacheKey);
      if (cached && typeof cached === "object") {
        runtime.indexes.set(group, cached);
        return cached;
      }
    }
    const index = await ManifestLoaderService.load(path, RouteIndexHydrator);
    runtime.indexes.set(group, index);
    if (importer.cache) {
      CacheManager.set(importer.cache, cacheKey, index);
    }
    return index;
  }
  /** Nativer dynamischer Import der Asset-URL (gleicher Origin, Browser oder ESM-Host). */
  static async #module(href) {
    return await import(href);
  }
  static #path(entry) {
    if (typeof entry === "string") {
      return AssetPath.resolve(entry);
    }
    if (!entry || typeof entry !== "object") {
      return "";
    }
    return AssetPath.join(entry.directory, entry.file);
  }
  static #pick(module, exportName, className, specifier) {
    if (exportName) {
      if (module[exportName] == null) {
        this.#fail(`Export '${exportName}' fehlt in '${specifier}'.`);
      }
      return module[exportName];
    }
    if (className && module[className] != null) {
      return module[className];
    }
    if (module.default != null) {
      return module.default;
    }
    this.#fail(`Kein Export f\xFCr '${specifier}'.`);
  }
  static #fail(message) {
    return ErrorAgent.shared().throw(`Importer: ${message}`);
  }
  static #announce(importer, specifier, exported) {
    if (!importer.store || typeof importer.store.dispatchEvent !== "function") return;
    importer.store.dispatchEvent(new CustomEvent("import:loaded", {
      detail: { specifier, module: exported }
    }));
  }
}
export {
  ImporterExtension
};
