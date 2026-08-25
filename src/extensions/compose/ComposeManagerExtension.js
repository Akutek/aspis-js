/** @typedef {import("../../types/managers.js").Registry} Registry */
/** @typedef {import("../../types/managers.js").CompareDifference} CompareDifference */
/** @typedef {import("../../types/managers.js").ComposePrep} ComposePrep */
import { CompareManager } from "../../managers/CompareManager.js";
import { ComposeMixinService } from "../../services/ComposeMixinService.js";
import { ComposeCompositionService } from "../../services/ComposeCompositionService.js";
class ComposeManagerExtension {
  static get cacheKey() {
    return "factory:compose";
  }
  static empty() {
    return { items: [], mixin: ComposeMixinService, composition: ComposeCompositionService };
  }
  static prepare(registry, compared) {
    const difference = compared && typeof compared === "object" ? compared : CompareManager.last(registry);
    const add = difference && Array.isArray(difference.add) ? difference.add.filter(Boolean) : [];
    const update = difference && Array.isArray(difference.update) ? difference.update.filter(Boolean) : [];
    return {
      items: add.concat(update),
      mixin: ComposeMixinService,
      composition: ComposeCompositionService
    };
  }
}
export {
  ComposeManagerExtension
};
