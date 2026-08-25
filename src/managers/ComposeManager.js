/** @typedef {import("../types/managers.js").Registry} Registry */
/** @typedef {import("../types/managers.js").ComposePrep} ComposePrep */
/** @typedef {import("../types/managers.js").CompareDifference} CompareDifference */
import { BaseManager } from "./BaseManager.js";
import { ComposeManagerExtension } from "../extensions/compose/ComposeManagerExtension.js";
class ComposeManager extends BaseManager {
  static get extension() {
    return ComposeManagerExtension;
  }
  static get cacheKey() {
    return this.extension.cacheKey;
  }
  static async compose(registry, compared) {
    try {
      const prepared = this.extension.prepare(registry, compared ?? { add: [], keep: [], update: [], remove: [] });
      this.cacheSet(registry, this.cacheKey, prepared);
      this.info(registry, `${prepared.items.length} Compose-Ziele; Mixin- und Composition-Dienst bereit.`);
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
    if (stored && typeof stored === "object" && Array.isArray(stored.items)) {
      const empty = this.extension.empty();
      return {
        items: stored.items,
        mixin: typeof stored.mixin === "function" ? stored.mixin : empty.mixin,
        composition: typeof stored.composition === "function" ? stored.composition : empty.composition
      };
    }
    return this.extension.empty();
  }
}
export {
  ComposeManager
};
