/** @typedef {import("../types/managers.js").Registry} Registry */
/** @typedef {import("../types/managers.js").Plan} Plan */
import { BaseManager } from "./BaseManager.js";
import { ScanManager } from "./ScanManager.js";
import { PlanManagerExtension } from "../extensions/plan/PlanManagerExtension.js";
class PlanManager extends BaseManager {
  static get extension() {
    return PlanManagerExtension;
  }
  static get cacheKey() {
    return this.extension.cacheKey;
  }
  static async plan(registry) {
    const scanResults = ScanManager.last(registry);
    try {
      const plan = await this.extension.build(registry, scanResults);
      this.cacheSet(registry, this.cacheKey, plan);
      this.info(
        registry,
        `${plan.items?.length ?? 0} Treffer, ${plan.specifiers?.length ?? 0} Specifier, Needs: ${(plan.needs ?? []).join(", ") || "\u2014"}.`
      );
      return plan;
    } catch (error) {
      this.capture(registry, error);
      return this.extension.empty(scanResults);
    }
  }
  static last(registry) {
    const stored = this.cacheGet(registry, this.cacheKey, null);
    if (stored && typeof stored === "object" && Array.isArray(stored.scanResults)) {
      return stored;
    }
    return this.extension.empty(ScanManager.last(registry));
  }
}
export {
  PlanManager
};
