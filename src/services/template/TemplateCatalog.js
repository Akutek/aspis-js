/** @typedef {import("../../types/importer.js").ImportRoute} ImportRoute */
/** @typedef {ImportRoute} TemplateRoute */
/** @typedef {import("../../types/templates.js").TemplateSource} TemplateSource */
/** @typedef {import("../../types/templates.js").CatalogResource} CatalogResource */
import { ManifestLoaderService } from "../ManifestLoaderService.js";
import { RouteIndexHydrator } from "../../hydrators/RouteIndexHydrator.js";
import { TemplateBrickHydrator } from "../../hydrators/TemplateBrickHydrator.js";
import { BlueprintManifestHydrator } from "../../hydrators/BlueprintManifestHydrator.js";
import { AssetPath } from "../../core/AssetPath.js";

class TemplateCatalog {
  static async load(indexPath, registry = null) {
    const channel = registry && typeof registry.has === "function" && registry.has("channel")
      ? registry.get("channel")
      : null;
    const transport = channel && typeof channel.request === "function" ? channel : null;
    const loaded = await ManifestLoaderService.load(indexPath, RouteIndexHydrator, transport);
    return loaded && typeof loaded === "object" ? loaded : {};
  }

  static entryFor(catalog, name) {
    if (!catalog || typeof catalog !== "object") {
      return null;
    }
    const direct = catalog[name];
    if (direct && typeof direct === "object" && direct.file) {
      return direct;
    }
    return null;
  }

  static urlsFor(catalog, name, basePath) {
    const entry = this.entryFor(catalog, name);
    if (entry?.file) {
      return {
        resourceUrl: AssetPath.join(entry.directory, entry.file),
        dir: entry.directory || null,
        file: entry.file
      };
    }
    return {
      resourceUrl: `${basePath}${name}/${name}.html`,
      dir: null,
      file: `${name}.html`
    };
  }

  /**
   * Stein (HTML → TemplateBrickHydrator) oder Blueprint (JSON → BlueprintManifestHydrator).
   * @param {Object<string, ImportRoute> | null} catalog
   * @param {string} name
   * @param {string} basePath
   * @returns {Promise<CatalogResource>}
   */
  static async fetch(catalog, name, basePath) {
    const urls = this.urlsFor(catalog, name, basePath);
    const file = String(urls.file || urls.resourceUrl || "").toLowerCase();
    if (file.endsWith(".html")) {
      const html = await this.#text(urls.resourceUrl, `Stein '${name}'`);
      const brick = TemplateBrickHydrator.hydrate({ html });
      return { kind: "brick", brick };
    }
    const blueprint = await ManifestLoaderService.load(urls.resourceUrl, BlueprintManifestHydrator);
    return { kind: "blueprint", blueprint };
  }

  /**
   * @param {string} url
   * @param {string} label
   * @returns {Promise<string>}
   */
  static async #text(url, label) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Aspis [TemplateCatalog]: ${label} fehlt (Status ${response.status}).`);
    }
    return response.text();
  }
}

export {
  TemplateCatalog
};
