/** @typedef {import("../../types/importer.js").ImportRoute} ImportRoute */
/** @typedef {import("../../types/schema.js").SchemaManifest} SchemaManifest */
import { ManifestLoaderService } from "../ManifestLoaderService.js";
import { RouteIndexHydrator } from "../../hydrators/RouteIndexHydrator.js";
import { SchemaManifestHydrator } from "../../hydrators/SchemaManifestHydrator.js";
import { AssetPath } from "../../core/AssetPath.js";
let catalog = {};
class SchemaCatalog {
  static async load(indexPath, registry = null) {
    const channel = registry && typeof registry.has === "function" && registry.has("channel")
      ? registry.get("channel")
      : null;
    const transport = channel && typeof channel.request === "function" ? channel : null;
    const index = await ManifestLoaderService.load(indexPath, RouteIndexHydrator, transport);
    const keys = Object.keys(index);
    if (keys.length === 0) {
      throw new Error("Aspis [SchemaCatalog]: Schema-Index ist leer.");
    }
    const next = {};
    const loaded = await Promise.all(keys.map(async (key) => {
      const route = index[key];
      const path = AssetPath.join(route.directory, route.file);
      const schema = await ManifestLoaderService.load(path, SchemaManifestHydrator, transport);
      const kind = String(schema.kind || key).trim();
      if (!kind) {
        throw new Error(`Aspis [SchemaCatalog]: Eintrag '${key}' ohne kind.`);
      }
      return { key, kind, schema };
    }));
    for (let i = 0; i < loaded.length; i += 1) {
      const row = loaded[i];
      next[row.kind] = row.schema;
      if (row.schema.id && row.schema.id !== row.kind) {
        next[row.schema.id] = row.schema;
      }
    }
    catalog = next;
    return next;
  }
  static get(kind) {
    const key = String(kind || "").trim();
    const hit = catalog[key];
    if (!hit) {
      throw new Error(`Aspis [SchemaCatalog]: Schema '${kind}' fehlt.`);
    }
    return hit;
  }
  static defaults(kind) {
    const defaults = this.get(kind).defaults;
    return defaults && typeof defaults === "object" ? defaults : {};
  }
}
export {
  SchemaCatalog
};
