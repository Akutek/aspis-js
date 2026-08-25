/** @typedef {import("../types/store.js").StateManifest} StateManifest */
/** @typedef {import("../types/store.js").StateSlice} StateSlice */
import { BaseHydrator } from "./BaseHydrator.js";
import { asRecord } from "./helpers/asRecord.js";
class StateManifestHydrator extends BaseHydrator {
  static transform(rawData) {
    const settings = asRecord(rawData.settings);
    const namespaces = Array.isArray(rawData.namespaces) && rawData.namespaces.length > 0 ? rawData.namespaces.filter((item) => typeof item === "string") : ["app", "features", "shared"];
    const globalStylesRaw = asRecord(rawData.globalStyles);
    const globalStyles = {};
    const styleKeys = Object.keys(globalStylesRaw);
    for (let i = 0; i < styleKeys.length; i += 1) {
      const key = styleKeys[i];
      globalStyles[key] = String(globalStylesRaw[key] ?? "");
    }
    return {
      settings: {
        strictMode: typeof settings.strictMode === "boolean" ? settings.strictMode : true,
        debug: Boolean(settings.debug ?? false)
      },
      namespaces,
      globalStyles: rawData.globalStyles && typeof rawData.globalStyles === "object" ? globalStyles : {},
      slices: rawData.slices && typeof rawData.slices === "object" ? asRecord(rawData.slices) : {}
    };
  }
}
export {
  StateManifestHydrator
};
