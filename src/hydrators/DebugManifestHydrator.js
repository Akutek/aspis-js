/** @typedef {import("../types/agents.js").DebugManifest} DebugManifest */
/** @typedef {import("../types/agents.js").DebugPipeline} DebugPipeline */
import { BaseHydrator } from "./BaseHydrator.js";
import { asRecord } from "./helpers/asRecord.js";
import { normalizePipelines } from "./helpers/normalizePipelines.js";
import { normalizeStringList } from "./helpers/normalizeStringList.js";
class DebugManifestHydrator extends BaseHydrator {
  static transform(rawData) {
    const settings = asRecord(rawData.settings);
    return {
      settings: {
        ...typeof settings.debug === "boolean" ? { debug: settings.debug } : {},
        ...typeof settings.namespace === "string" && settings.namespace.trim() ? { namespace: settings.namespace.trim() } : {},
        levels: normalizeStringList(settings.levels),
        areas: normalizeStringList(settings.areas),
        context: normalizeStringList(settings.context)
      },
      pipelines: normalizePipelines(rawData.pipelines)
    };
  }
}
export {
  DebugManifestHydrator
};
