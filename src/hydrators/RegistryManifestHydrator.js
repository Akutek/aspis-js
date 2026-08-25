import { BaseHydrator } from "./BaseHydrator.js";
import { asRecord } from "./helpers/asRecord.js";
import { RouteIndexHydrator } from "./RouteIndexHydrator.js";
class RegistryManifestHydrator extends BaseHydrator {
  static transform(rawData) {
    const raw = asRecord(rawData);
    if (!raw.classRouting || typeof raw.classRouting !== "object" || Array.isArray(raw.classRouting)) {
      throw new Error("Aspis [RegistryManifestHydrator]: classRouting fehlt oder ist kein Objekt.");
    }
    if (!raw.manifestRouting || typeof raw.manifestRouting !== "object" || Array.isArray(raw.manifestRouting)) {
      throw new Error("Aspis [RegistryManifestHydrator]: manifestRouting fehlt oder ist kein Objekt.");
    }
    return {
      ...typeof raw.version === "string" && raw.version.trim() ? { version: raw.version.trim() } : {},
      boot: raw.boot && typeof raw.boot === "object" ? asRecord(raw.boot) : {},
      classRouting: RouteIndexHydrator.transform(asRecord(raw.classRouting)),
      manifestRouting: RouteIndexHydrator.transform(asRecord(raw.manifestRouting)),
      errorAndDebug: this.#errorAndDebug(raw.errorAndDebug),
      indices: raw.indices && typeof raw.indices === "object" ? asRecord(raw.indices) : {}
    };
  }
  static #errorAndDebug(value) {
    const bag = asRecord(value);
    const out = {};
    if (bag.debug) {
      out.debug = RouteIndexHydrator.route(bag.debug, "errorAndDebug.debug");
    }
    if (bag.error) {
      out.error = RouteIndexHydrator.route(bag.error, "errorAndDebug.error");
    }
    return out;
  }
}
export {
  RegistryManifestHydrator
};
