/** @typedef {import("../types/importer.js").ImportRoute} ImportRoute */
import { BaseHydrator } from "./BaseHydrator.js";
import { asRecord } from "./helpers/asRecord.js";
const SKIP = /* @__PURE__ */ new Set(["version", "kind"]);
class RouteIndexHydrator extends BaseHydrator {
  static transform(rawData) {
    const raw = asRecord(rawData);
    const nested = raw.entries && typeof raw.entries === "object" && !Array.isArray(raw.entries) ? asRecord(raw.entries) : null;
    const source = nested || raw;
    const out = {};
    const keys = Object.keys(source);
    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i];
      if (SKIP.has(key) || key === "entries") {
        continue;
      }
      out[key] = this.route(source[key], key);
    }
    return out;
  }
  /** Einzelne Route. Wirft, wenn `directory` oder `file` fehlt. */
  static route(entry, label) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(`Aspis [RouteIndexHydrator]: '${label}' ist keine Route ({ directory, file }).`);
    }
    const bag = asRecord(entry);
    const directory = String(bag.directory || "").trim();
    const file = String(bag.file || "").trim();
    if (!directory || !file) {
      throw new Error(`Aspis [RouteIndexHydrator]: '${label}' braucht directory und file.`);
    }
    const exportName = typeof bag.export === "string" ? bag.export.trim() : "";
    if (exportName) {
      return { directory, file, export: exportName };
    }
    return { directory, file };
  }
}
export {
  RouteIndexHydrator
};
