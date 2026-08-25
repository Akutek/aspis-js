import { BaseHydrator } from "./BaseHydrator.js";
import { asRecord } from "./helpers/asRecord.js";
import { RouteIndexHydrator } from "./RouteIndexHydrator.js";
class SchemaManifestHydrator extends BaseHydrator {
  static transform(rawData) {
    const raw = asRecord(rawData);
    if (typeof raw.kind === "string" || typeof raw.id === "string") {
      const id = String(raw.id || raw.kind || "").trim();
      const kind = String(raw.kind || raw.id || "").trim();
      if (!id || !kind) {
        throw new Error("Aspis [SchemaManifestHydrator]: Schema braucht id und kind.");
      }
      return {
        id,
        kind,
        defaults: raw.defaults && typeof raw.defaults === "object" ? asRecord(raw.defaults) : {},
        row: raw.row && typeof raw.row === "object" ? asRecord(raw.row) : void 0,
        field: raw.field && typeof raw.field === "object" ? asRecord(raw.field) : void 0,
        item: raw.item && typeof raw.item === "object" ? asRecord(raw.item) : void 0,
        option: raw.option && typeof raw.option === "object" ? asRecord(raw.option) : void 0,
        variants: raw.variants && typeof raw.variants === "object" ? asRecord(raw.variants) : void 0
      };
    }
    return RouteIndexHydrator.transform(raw);
  }
}
export {
  SchemaManifestHydrator
};
