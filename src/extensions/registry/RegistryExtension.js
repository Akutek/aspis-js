/** @typedef {import("../../types/registry.js").Registry} Registry */
import { BaseExtension } from "../BaseExtension.js";
function asRecord(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value;
  }
  return {};
}
class RegistryExtension extends BaseExtension {
  static prepare(registry) {
    super.prepare(registry, {});
    if (registry.manifest == null) {
      registry.manifest = {};
    }
    return this;
  }
  static graft(registry, extraManifest = {}) {
    const base = registry.manifest || {};
    const extra = extraManifest || {};
    registry.manifest = {
      ...base,
      ...extra,
      indices: {
        ...asRecord(base.indices),
        ...asRecord(extra.indices)
      },
      classRouting: {
        ...asRecord(base.classRouting),
        ...asRecord(extra.classRouting)
      }
    };
    return this;
  }
}
export {
  RegistryExtension
};
