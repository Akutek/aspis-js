import { BaseHydrator } from "./BaseHydrator.js";
import { asRecord } from "./helpers/asRecord.js";
import { normalizeStringList } from "./helpers/normalizeStringList.js";
import { ControllerTrigger } from "../utils/ControllerTrigger.js";
import { assertPlanNeeds } from "./helpers/assertPlanNeeds.js";
class PlanManifestHydrator extends BaseHydrator {
  static transform(rawData) {
    const raw = asRecord(rawData);
    if (this.#isPortion(raw)) {
      return this.#portion(raw);
    }
    const entries = {};
    const keys = Object.keys(raw);
    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i];
      if (key === "version" || key === "kind") {
        continue;
      }
      if (!raw[key] || typeof raw[key] !== "object" || Array.isArray(raw[key])) {
        throw new Error(`Aspis [PlanManifestHydrator]: Eintrag '${key}' ist kein Objekt.`);
      }
      const value = asRecord(raw[key]);
      const type = ControllerTrigger.normalize(key) || this.#token(key);
      if (!type) {
        throw new Error(`Aspis [PlanManifestHydrator]: Eintrag '${key}' hat keinen Trigger-Typ.`);
      }
      entries[type] = this.#isPortion(value) ? this.#portion(value, type) : {
        directory: this.#routeField(value.directory, `${key}.directory`),
        file: this.#routeField(value.file, `${key}.file`)
      };
    }
    return { kind: "index", entries };
  }
  static #isPortion(raw) {
    return Boolean(raw.trigger || raw.specifiers || raw.needs || raw.watchers || raw.mixins || raw.compositions);
  }
  static #portion(raw, fallbackType = "") {
    const triggerRaw = asRecord(raw.trigger);
    const type = ControllerTrigger.normalize(triggerRaw.type) || this.#token(triggerRaw.type) || this.#token(fallbackType);
    const specifiers = normalizeStringList(raw.specifiers);
    if (specifiers.length === 0) {
      throw new Error("Aspis [PlanManifestHydrator]: Portion ohne specifiers.");
    }
    const needs = assertPlanNeeds(normalizeStringList(raw.needs), "PlanManifestHydrator");
    return {
      kind: "portion",
      trigger: {
        type,
        layout: this.#token(triggerRaw.layout)
      },
      specifiers,
      needs,
      watchers: normalizeStringList(raw.watchers),
      mixins: normalizeStringList(raw.mixins),
      compositions: normalizeStringList(raw.compositions)
    };
  }
  static #routeField(value, label) {
    const text = typeof value === "string" ? value.trim() : "";
    if (!text) {
      throw new Error(`Aspis [PlanManifestHydrator]: '${label}' fehlt.`);
    }
    return text;
  }
  static #token(value) {
    return typeof value === "string" ? value.trim().toLowerCase() : "";
  }
}
export {
  PlanManifestHydrator
};
