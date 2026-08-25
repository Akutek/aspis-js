/** @typedef {import("../types/agents.js").ErrorManifest} ErrorManifest */
/** @typedef {import("../types/agents.js").ErrorPipeline} ErrorPipeline */
import { BaseHydrator } from "./BaseHydrator.js";
import { asRecord } from "./helpers/asRecord.js";
import { normalizePipelines } from "./helpers/normalizePipelines.js";
import { normalizeStringList } from "./helpers/normalizeStringList.js";
class ErrorManifestHydrator extends BaseHydrator {
  static transform(rawData) {
    const settings = asRecord(rawData.settings);
    return {
      settings: {
        ...typeof settings.capture === "boolean" ? { capture: settings.capture } : {},
        ...typeof settings.namespace === "string" && settings.namespace.trim() ? { namespace: settings.namespace.trim() } : {},
        areas: normalizeStringList(settings.areas),
        context: normalizeStringList(settings.context)
      },
      pipelines: normalizePipelines(rawData.pipelines)
    };
  }
}
export {
  ErrorManifestHydrator
};
