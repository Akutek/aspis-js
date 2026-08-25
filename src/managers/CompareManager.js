/** @typedef {import("../types/managers.js").Registry} Registry */
/** @typedef {import("../types/managers.js").Plan} Plan */
/** @typedef {import("../types/managers.js").ScanResults} ScanResults */
/** @typedef {import("../types/managers.js").CompareDifference} CompareDifference */
/** @typedef {import("../types/managers.js").PlanItem} PlanItem */
import { BaseManager } from "./BaseManager.js";
import { PlanManager } from "./PlanManager.js";
import { PriorityQueueManager } from "./PriorityQueueManager.js";
import { CompareManagerExtension } from "../extensions/compare/CompareManagerExtension.js";
class CompareManager extends BaseManager {
  static get extension() {
    return CompareManagerExtension;
  }
  static get cacheKey() {
    return this.extension.cacheKey;
  }
  static get liveKey() {
    return this.extension.liveKey;
  }
  static async compare(registry) {
    const plan = PlanManager.last(registry);
    try {
      const raw = this.extension.compare(plan, this.live(registry));
      const difference = this.#order(registry, raw);
      this.cacheSet(registry, this.cacheKey, difference);
      this.info(
        registry,
        `add ${difference.add.length}, keep ${difference.keep.length}, update ${difference.update.length}, remove ${difference.remove.length}.`
      );
      return difference;
    } catch (error) {
      this.capture(registry, error);
      return this.empty(plan);
    }
  }
  static last(registry) {
    const stored = this.cacheGet(registry, this.cacheKey, null);
    if (stored && typeof stored === "object" && Array.isArray(stored.add) && Array.isArray(stored.keep) && Array.isArray(stored.remove)) {
      return {
        add: stored.add,
        keep: stored.keep,
        update: Array.isArray(stored.update) ? stored.update : [],
        remove: stored.remove,
        plan: stored.plan
      };
    }
    return this.empty(PlanManager.last(registry));
  }
  static live(registry) {
    const stored = this.cacheGet(registry, this.liveKey, []);
    return Array.isArray(stored) ? stored : [];
  }
  static empty(plan) {
    return this.extension.empty(plan);
  }
  static #order(registry, difference) {
    return {
      add: PriorityQueueManager.sort(registry, difference.add),
      keep: PriorityQueueManager.sort(registry, difference.keep),
      update: PriorityQueueManager.sort(registry, difference.update),
      remove: PriorityQueueManager.sort(registry, difference.remove),
      plan: difference.plan
    };
  }
}
export {
  CompareManager
};
