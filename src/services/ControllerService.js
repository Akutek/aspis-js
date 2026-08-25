/** @typedef {import("../types/managers.js").Registry} Registry */
import { ImportManager } from "../managers/ImportManager.js";
import { ErrorAgent } from "../agents/ErrorAgent.js";
class ControllerService {
  static get baseSpecifier() {
    return "controllers.BaseController";
  }
  static async load(registry, specifiers = []) {
    const unique = /* @__PURE__ */ new Set();
    unique.add(this.baseSpecifier);
    const list = Array.isArray(specifiers) ? specifiers : [];
    for (let i = 0; i < list.length; i += 1) {
      if (list[i]) {
        unique.add(list[i]);
      }
    }
    const classes = {};
    const keys = [...unique];
    for (let i = 0; i < keys.length; i += 1) {
      const specifier = keys[i];
      const loaded = await ImportManager.import(registry, specifier);
      if (typeof loaded !== "function") {
        return ErrorAgent.shared().throw(`Unbekanntes Mixin oder keine Klasse: '${specifier}'.`);
      }
      classes[specifier] = loaded;
    }
    return { specifiers: keys, classes };
  }
}
export {
  ControllerService
};
