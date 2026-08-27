/** @typedef {import("../../types/importer.js").ImportRoute} ImportRoute */
/** @typedef {ImportRoute} TemplateRoute */
/** @typedef {import("../../types/templates.js").TemplateConfig} TemplateConfig */
/** @typedef {import("../../types/templates.js").TemplateSource} TemplateSource */
import { ManifestLoaderService } from "../ManifestLoaderService.js";
import { RouteIndexHydrator } from "../../hydrators/RouteIndexHydrator.js";
import { TemplateManifestHydrator } from "../../hydrators/TemplateManifestHydrator.js";
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
        jsonUrl: AssetPath.join(entry.directory, entry.file),
        dir: entry.directory || null
      };
    }
    return {
      jsonUrl: `${basePath}${name}/${name}.json`,
      dir: null
    };
  }
  static partUrl(directory, name, fileName, basePath) {
    const file = String(fileName || "").trim();
    if (!file) {
      return `${basePath}${name}/`;
    }
    if (/^[a-zA-Z][a-zA-Z+\-.]*:/.test(file)) {
      return file;
    }
    if (directory) {
      return AssetPath.join(directory, file);
    }
    return `${basePath}${name}/${file.replace(/^\/+/, "")}`;
  }
  /** Manifest plus HTML-Teile. Wirft, wenn JSON oder eine Teildatei fehlt. */
  static async fetch(catalog, name, basePath) {
    const urls = this.urlsFor(catalog, name, basePath);
    const config = await ManifestLoaderService.load(urls.jsonUrl, TemplateManifestHydrator);
    const files = config.files && typeof config.files === "object" ? config.files : {};
    const loaded = {};
    const keys = Object.keys(files);
    await Promise.all(keys.map(async (key) => {
      const fileName = files[key];
      loaded[key] = await this.#text(
        this.partUrl(urls.dir, name, fileName, basePath),
        `Teil-Datei '${fileName}' f\xFCr '${name}'`
      );
    }));
    const layoutHtml = loaded.layout || loaded.markup || config.html || "";
    if (!String(layoutHtml).trim()) {
      throw new Error(`Aspis [TemplateCatalog]: '${name}' ohne layout/markup.`);
    }
    const parts = {};
    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i];
      if (key === "layout" || key === "markup") {
        continue;
      }
      parts[key] = loaded[key];
    }
    return { name, config, layoutHtml, parts };
  }
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
