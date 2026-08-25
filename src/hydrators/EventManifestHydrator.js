/** @typedef {import("../types/events.js").EventManifest} EventManifest */
import { BaseHydrator } from "./BaseHydrator.js";
import { asRecord } from "./helpers/asRecord.js";
class EventManifestHydrator extends BaseHydrator {
  static transform(rawData) {
    const raw = asRecord(rawData);
    const out = {};
    const keys = Object.keys(raw);
    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i];
      if (key === "version") {
        continue;
      }
      const value = raw[key];
      if (typeof value === "string" && value.trim()) {
        out[key] = { events: value.trim() };
        continue;
      }
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error(`Aspis [EventManifestHydrator]: '${key}' braucht { events } oder einen Event-String.`);
      }
      const bag = asRecord(value);
      const events = typeof bag.events === "string" ? bag.events.trim() : "";
      if (!events) {
        throw new Error(`Aspis [EventManifestHydrator]: '${key}' ohne events.`);
      }
      out[key] = { events };
    }
    return out;
  }
}
export {
  EventManifestHydrator
};
