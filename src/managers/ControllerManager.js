/** @typedef {import("../types/managers.js").Registry} Registry */
/** @typedef {import("../types/managers.js").ControllerPrep} ControllerPrep */
/** @typedef {import("../types/managers.js").CompareDifference} CompareDifference */
/** @typedef {import("../types/managers.js").WatcherPrep} WatcherPrep */
import { BaseManager } from "./BaseManager.js";
import { ControllerManagerExtension } from "../extensions/controller/ControllerManagerExtension.js";
class ControllerManager extends BaseManager {
  static get extension() {
    return ControllerManagerExtension;
  }
  static get cacheKey() {
    return this.extension.cacheKey;
  }
  static async control(registry, compared, watchers) {
    try {
      const history = this.cacheGet(registry, this.extension.historyKey, {});
      const prepared = await this.extension.prepare(
        registry,
        compared ?? { add: [], keep: [], update: [], remove: [] },
        watchers ?? { skipped: true, specifiers: [], queue: { view: [], near: [], far: [], history: [] } },
        history
      );
      this.cacheSet(registry, this.cacheKey, prepared);
      this.info(registry, `${Object.keys(prepared.classes).length} Controller-Klassen geladen.`);
      return prepared;
    } catch (error) {
      this.capture(registry, error);
      const empty = this.extension.empty();
      this.cacheSet(registry, this.cacheKey, empty);
      return empty;
    }
  }
  static last(registry) {
    const stored = this.cacheGet(registry, this.cacheKey, null);
    if (stored && typeof stored === "object" && Array.isArray(stored.specifiers)) {
      return {
        specifiers: stored.specifiers,
        classes: stored.classes && typeof stored.classes === "object" ? stored.classes : {}
      };
    }
    return this.extension.empty();
  }
}
export {
  ControllerManager
};
