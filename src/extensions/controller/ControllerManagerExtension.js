/** @typedef {import("../../types/managers.js").Registry} Registry */
/** @typedef {import("../../types/managers.js").CompareDifference} CompareDifference */
/** @typedef {import("../../types/managers.js").WatcherPrep} WatcherPrep */
/** @typedef {import("../../types/managers.js").ControllerPrep} ControllerPrep */
import { CompareManager } from "../../managers/CompareManager.js";
import { PlanManager } from "../../managers/PlanManager.js";
import { ObserverManagerExtension } from "../observer/ObserverManagerExtension.js";
import { ControllerService } from "../../services/ControllerService.js";
class ControllerManagerExtension {
  static get cacheKey() {
    return "factory:controllers";
  }
  static get historyKey() {
    return "factory:history";
  }
  static empty() {
    return { specifiers: [], classes: {} };
  }
  static async prepare(registry, compared, watchers, history = {}) {
    const difference = compared && typeof compared === "object" ? compared : CompareManager.last(registry);
    const queue = watchers && watchers.queue ? watchers.queue : ObserverManagerExtension.queue(difference);
    const fromQueue = ObserverManagerExtension.specifiersToLoad(queue, history);
    const unique = new Set(fromQueue);
    if (unique.size === 0) {
      const plan = difference.plan || PlanManager.last(registry);
      const fromPlan = plan && Array.isArray(plan.specifiers) ? plan.specifiers : [];
      for (let i = 0; i < fromPlan.length; i += 1) {
        if (fromPlan[i]) {
          unique.add(fromPlan[i]);
        }
      }
    }
    const loaded = await ControllerService.load(registry, [...unique]);
    if (!loaded) {
      return { specifiers: [], classes: {} };
    }
    return {
      specifiers: loaded.specifiers,
      classes: loaded.classes
    };
  }
}
export {
  ControllerManagerExtension
};
