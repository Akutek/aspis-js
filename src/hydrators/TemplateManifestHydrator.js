/** @typedef {import("../types/templates.js").TemplateConfig} TemplateConfig */
/** @typedef {import("../types/templates.js").TemplateLoopSpec} TemplateLoopSpec */
import { BaseHydrator } from "./BaseHydrator.js";
import { asRecord } from "./helpers/asRecord.js";
class TemplateManifestHydrator extends BaseHydrator {
  static transform(rawData) {
    const raw = asRecord(rawData);
    const files = this.#stringMap(raw.files, "files");
    const html = typeof raw.html === "string" ? raw.html : "";
    if (Object.keys(files).length === 0 && !html.trim()) {
      throw new Error("Aspis [TemplateManifestHydrator]: Template braucht files oder html.");
    }
    const name = typeof raw.name === "string" ? raw.name.trim() : "";
    return {
      ...name ? { name } : {},
      ...html ? { html } : {},
      files,
      placeholder: this.#stringMap(raw.placeholder, "placeholder"),
      slots: this.#stringMap(raw.slots, "slots"),
      attributes: this.#stringMap(raw.attributes, "attributes"),
      loops: this.#loops(raw.loops),
      partial: raw.partial === true,
      events: raw.events && typeof raw.events === "object" ? asRecord(raw.events) : {},
      styles: raw.styles && typeof raw.styles === "object" ? asRecord(raw.styles) : {},
      targets: raw.targets && typeof raw.targets === "object" ? asRecord(raw.targets) : {},
      bindings: raw.bindings && typeof raw.bindings === "object" ? asRecord(raw.bindings) : {}
    };
  }
  static #stringMap(value, label) {
    if (value == null) {
      return {};
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(`Aspis [TemplateManifestHydrator]: '${label}' muss ein Objekt sein.`);
    }
    const bag = asRecord(value);
    const out = {};
    const keys = Object.keys(bag);
    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i];
      const text = typeof bag[key] === "string" ? bag[key].trim() : "";
      if (!text) {
        throw new Error(`Aspis [TemplateManifestHydrator]: '${label}.${key}' braucht einen String.`);
      }
      out[key] = text;
    }
    return out;
  }
  static #loops(value) {
    if (value == null) {
      return {};
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("Aspis [TemplateManifestHydrator]: 'loops' muss ein Objekt sein.");
    }
    const bag = asRecord(value);
    const out = {};
    const keys = Object.keys(bag);
    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i];
      const spec = bag[key];
      if (typeof spec === "string" && spec.trim()) {
        out[key] = spec.trim();
        continue;
      }
      const loop = asRecord(spec);
      const placeholder = typeof loop.placeholder === "string" ? loop.placeholder.trim() : "";
      const from = typeof loop.from === "string" ? loop.from.trim() : "";
      const part = typeof loop.part === "string" ? loop.part.trim() : "";
      if (!placeholder && !from && !part) {
        throw new Error(`Aspis [TemplateManifestHydrator]: loops.${key} braucht placeholder, from oder part.`);
      }
      out[key] = {
        ...placeholder ? { placeholder } : {},
        ...from ? { from } : {},
        ...part ? { part } : {}
      };
    }
    return out;
  }
}
export {
  TemplateManifestHydrator
};
