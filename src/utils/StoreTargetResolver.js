/** @typedef {import("../types/utils.js").TargetsConfig} TargetsConfig */
/** @typedef {import("../types/utils.js").ResolvedTargetsMap} ResolvedTargetsMap */
import { DebugAgent } from "../agents/DebugAgent.js";
class StoreTargetResolver {
  static resolve(container, targetsConfig) {
    const resolvedTargets = /* @__PURE__ */ new Map();
    if (!targetsConfig || !(container instanceof HTMLElement)) return resolvedTargets;
    Object.entries(targetsConfig).forEach(([targetName, config]) => {
      /** @type {Element | null} */
      let element = null;
      if (config.selector === ":scope") {
        element = container;
      } else {
        element = container.querySelector(config.selector);
      }
      if (element instanceof HTMLElement) {
        resolvedTargets.set(targetName, element);
      } else {
        DebugAgent.warn(`[StoreTargetResolver.resolve()] Element f\xFCr Selektor '${config.selector}' nicht im DOM gefunden.`);
      }
    });
    return resolvedTargets;
  }
}
export {
  StoreTargetResolver
};
