/** @typedef {import("../../types/store.js").StateManifest} StateManifest */
/** @typedef {import("../../types/store.js").SliceConfig} SliceConfig */
/** @typedef {import("../../types/store.js").StoreSchemaExtractResult} StoreSchemaExtractResult */
import { DebugAgent } from "../../agents/DebugAgent.js";
const DEFAULT_NAMESPACES = Object.freeze(["app", "features", "shared"]);
class StoreSchema {
  static namespaces(manifest) {
    const listed = manifest?.namespaces;
    if (Array.isArray(listed) && listed.length > 0) {
      return listed;
    }
    return DEFAULT_NAMESPACES;
  }
  static extract(manifest = {}) {
    const configs = {};
    const allowed = this.namespaces(manifest);
    const tree = {};
    allowed.forEach((ns) => {
      tree[ns] = {};
    });
    if (!manifest?.slices) {
      return { tree, configs };
    }
    Object.entries(manifest.slices).forEach(([slicePath, sliceContent]) => {
      const parts = slicePath.split(".");
      const namespace = parts[0];
      if (parts.length < 2 || !allowed.includes(namespace)) {
        DebugAgent.warn(
          `[StoreSchema.extract()] Ignoriere ung\xFCltigen Slice-Pfad '${slicePath}'. Erlaubte Namespaces: ${allowed.join(", ")}.`
        );
        return;
      }
      const sliceKey = parts.slice(1).join(".");
      if (!tree[namespace]) tree[namespace] = {};
      const sliceObj = sliceContent.initialState || {};
      Object.defineProperty(sliceObj, "config", {
        value: sliceContent.config || {},
        writable: true,
        enumerable: false,
        configurable: true
      });
      tree[namespace][sliceKey] = sliceObj;
      configs[slicePath] = sliceContent.config || {};
    });
    return { tree, configs };
  }
  static merge(base = {}, extra = {}) {
    const baseNamespaces = Array.isArray(base.namespaces) && base.namespaces.length > 0 ? base.namespaces : this.namespaces(base);
    const extraNamespaces = Array.isArray(extra.namespaces) ? extra.namespaces : [];
    return {
      settings: { ...base.settings || {}, ...extra.settings || {} },
      namespaces: [.../* @__PURE__ */ new Set([...baseNamespaces, ...extraNamespaces])],
      globalStyles: { ...base.globalStyles || {}, ...extra.globalStyles || {} },
      slices: { ...base.slices || {}, ...extra.slices || {} }
    };
  }
  static isPathDeclared(manifest, path) {
    if (!path) return false;
    const parts = path.split(".");
    const allowed = this.namespaces(manifest);
    if (!allowed.includes(parts[0])) return false;
    const slices = manifest?.slices;
    if (!slices) return false;
    const slice = slices[`${parts[0]}.${parts[1]}`];
    if (!slice) return false;
    if (parts.length === 2) return true;
    let cursor = slice.initialState;
    for (let i = 2; i < parts.length; i++) {
      const key = parts[i];
      if (cursor === null || typeof cursor !== "object" || !(key in cursor)) {
        return false;
      }
      cursor = cursor[key];
    }
    return true;
  }
  static getInitialValue(manifest, path) {
    if (!path) return void 0;
    const parts = path.split(".");
    if (parts.length < 2) return void 0;
    const slice = manifest?.slices?.[`${parts[0]}.${parts[1]}`];
    if (!slice?.initialState) return void 0;
    let cursor = slice.initialState;
    for (let i = 2; i < parts.length; i++) {
      const key = parts[i];
      if (cursor === null || typeof cursor !== "object" || !(key in cursor)) {
        return void 0;
      }
      cursor = cursor[key];
    }
    return cursor;
  }
}
export {
  StoreSchema
};
