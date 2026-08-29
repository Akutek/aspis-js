/** @typedef {import("../types/templates.js").Blueprint} Blueprint */
/** @typedef {import("../types/templates.js").BlueprintSlotSpec} BlueprintSlotSpec */
import { BaseHydrator } from "./BaseHydrator.js";
import { asRecord } from "./helpers/asRecord.js";

const NAME_TOKEN = /^[a-zA-Z0-9_-]+$/;
const CLASS_TOKEN = /^[a-zA-Z_][a-zA-Z0-9_-]*$/;

/**
 * Ein Hydrator zwischen Blueprint-JSON und TemplateRenderService.
 * Sanitize der Bauplan-Strings (Namen, Klassen, Maps) liegt hier, nicht im Service.
 */
class BlueprintManifestHydrator extends BaseHydrator {
  /**
   * @param {unknown} rawData
   * @returns {Blueprint}
   */
  static transform(rawData) {
    const raw = asRecord(rawData);
    const kind = typeof raw.kind === "string" ? raw.kind.trim() : "";
    if (kind !== "blueprint") {
      throw new Error("Aspis [BlueprintManifestHydrator]: kind muss 'blueprint' sein.");
    }
    const name = this.#token(raw.name);
    const root = this.#token(raw.root);
    if (!root) {
      throw new Error("Aspis [BlueprintManifestHydrator]: root (Stein-Name) fehlt.");
    }
    const branch = this.#token(raw.branch);
    const from = this.#token(raw.from);
    return {
      name,
      kind: "blueprint",
      root,
      ...branch ? { branch } : {},
      ...from ? { from } : {},
      classes: this.#classMap(raw.classes),
      map: this.#tokenMap(raw.map, "map"),
      slots: this.#slotTree(raw.slots)
    };
  }

  /**
   * @param {unknown} value
   * @returns {string}
   */
  static #token(value) {
    const text = String(value || "").trim();
    if (!text) {
      return "";
    }
    if (!NAME_TOKEN.test(text)) {
      throw new Error(`Aspis [BlueprintManifestHydrator]: '${text}' ist kein Name-Token.`);
    }
    return text;
  }

  /**
   * @param {unknown} value
   * @returns {string}
   */
  static #classList(value) {
    if (value == null || value === "") {
      return "";
    }
    if (typeof value !== "string") {
      throw new Error("Aspis [BlueprintManifestHydrator]: Klasse muss ein String sein.");
    }
    const parts = value.trim().split(/\s+/).filter(Boolean);
    const out = [];
    for (let i = 0; i < parts.length; i += 1) {
      if (!CLASS_TOKEN.test(parts[i])) {
        throw new Error(`Aspis [BlueprintManifestHydrator]: ungültige Klasse '${parts[i]}'.`);
      }
      out.push(parts[i]);
    }
    return out.join(" ");
  }

  /**
   * @param {unknown} value
   * @returns {Object<string, string>}
   */
  static #classMap(value) {
    if (value == null) {
      return {};
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("Aspis [BlueprintManifestHydrator]: classes muss ein Objekt sein.");
    }
    const bag = asRecord(value);
    const out = {};
    const keys = Object.keys(bag);
    for (let i = 0; i < keys.length; i += 1) {
      const key = this.#token(keys[i]);
      const text = this.#classList(bag[keys[i]]);
      if (!key || !text) {
        continue;
      }
      out[key] = text;
    }
    return out;
  }

  /**
   * @param {unknown} value
   * @param {string} label
   * @returns {Object<string, string>}
   */
  static #tokenMap(value, label) {
    if (value == null) {
      return {};
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(`Aspis [BlueprintManifestHydrator]: ${label} muss ein Objekt sein.`);
    }
    const bag = asRecord(value);
    const out = {};
    const keys = Object.keys(bag);
    for (let i = 0; i < keys.length; i += 1) {
      const key = this.#token(keys[i]);
      const text = this.#token(bag[keys[i]]);
      if (!key || !text) {
        continue;
      }
      out[key] = text;
    }
    return out;
  }

  /**
   * @param {unknown} value
   * @returns {Object<string, BlueprintSlotSpec>}
   */
  static #slotTree(value) {
    if (value == null) {
      return {};
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("Aspis [BlueprintManifestHydrator]: slots muss ein Objekt sein.");
    }
    const bag = asRecord(value);
    const out = {};
    const keys = Object.keys(bag);
    for (let i = 0; i < keys.length; i += 1) {
      const key = this.#token(keys[i]);
      if (!key) {
        continue;
      }
      out[key] = this.#slotSpec(bag[keys[i]], key);
    }
    return out;
  }

  /**
   * @param {unknown} value
   * @param {string} key
   * @returns {BlueprintSlotSpec}
   */
  static #slotSpec(value, key) {
    if (typeof value === "string" && value.trim()) {
      return { template: this.#token(value) };
    }
    const spec = asRecord(value);
    const template = this.#token(spec.template);
    if (!template) {
      throw new Error(`Aspis [BlueprintManifestHydrator]: slots.${key} braucht template.`);
    }
    const classKey = this.#token(spec.classKey);
    const from = this.#token(spec.from);
    return {
      template,
      loop: spec.loop === true,
      ...from ? { from } : {},
      ...classKey ? { classKey } : {},
      map: this.#tokenMap(spec.map, `slots.${key}.map`),
      slots: this.#slotTree(spec.slots)
    };
  }
}

export {
  BlueprintManifestHydrator
};
