/** @typedef {import("../types/registry.js").AppConfig} AppConfig */
/** @typedef {import("../types/registry.js").CardinalRoute} CardinalRoute */
import { BaseHydrator } from "./BaseHydrator.js";
import { asRecord } from "./helpers/asRecord.js";
import { RouteIndexHydrator } from "./RouteIndexHydrator.js";
class AppConfigHydrator extends BaseHydrator {
  static transform(rawData) {
    const raw = asRecord(rawData);
    const settings = asRecord(raw.settings);
    const cardinals = this.#cardinals(raw.cardinals);
    const registryRoute = cardinals["registry-manifest"];
    if (!registryRoute?.directory || !registryRoute?.file) {
      throw new Error("Aspis [AppConfigHydrator]: cardinals['registry-manifest'] braucht directory und file.");
    }
    return {
      debug: Boolean(raw.debug ?? settings.debug ?? false),
      settings,
      cardinals,
      publicPaths: this.#publicPaths(raw.publicPaths),
      components: raw.components && typeof raw.components === "object" ? asRecord(raw.components) : {}
    };
  }
  /** Cardinals bleiben lesbar: Name → `{ directory, file }`. */
  static #cardinals(value) {
    const out = {};
    const bag = asRecord(value);
    const keys = Object.keys(bag);
    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i];
      out[key] = RouteIndexHydrator.route(bag[key], `cardinals.${key}`);
    }
    return out;
  }
  static #publicPaths(value) {
    const raw = asRecord(value);
    return {
      controllers: "controllers",
      templates: "templates",
      events: "events",
      ...raw,
      base: typeof raw.base === "string" || raw.base == null ? raw.base ?? null : String(raw.base)
    };
  }
}
export {
  AppConfigHydrator
};
