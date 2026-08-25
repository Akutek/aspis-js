/** @typedef {import("../types/store.js").Store} Store */
/** @typedef {import("../types/store.js").SliceConfig} SliceConfig */
/** @typedef {import("../types/store.js").TargetConfig} TargetConfig */
/** @typedef {import("../types/utils.js").ResolvedTargetsMap} ResolvedTargetsMap */
/** @typedef {import("../types/utils.js").UnsubscribeFunction} UnsubscribeFunction */
import { DebugAgent } from "../agents/DebugAgent.js";
import { ManifestTargetResolver } from "./ManifestTargetResolver.js";
import { ModifierDOM } from "./ModifierDOM.js";
class ManifestBinder {
  #container;
  #store;
  #sliceKey;
  #resolvedTargets;
  #unsubscribeEffects = [];
  constructor(container, store, sliceKey) {
    this.#container = container;
    this.#store = store;
    this.#sliceKey = sliceKey;
    this.#resolvedTargets = /* @__PURE__ */ new Map();
  }
  bind() {
    const slice = this.#store.getSlice(this.#sliceKey);
    const targetsConfig = slice?.config?.targets;
    const stylesConfig = slice?.config?.styles;
    if (!targetsConfig || !stylesConfig) return;
    this.#resolvedTargets = ManifestTargetResolver.resolve(this.#container, targetsConfig);
    Object.entries(targetsConfig).forEach(([targetName, targetConfig]) => {
      const element = this.#resolvedTargets.get(targetName);
      if (!element || !targetConfig.bindClasses) return;
      Object.entries(targetConfig.bindClasses).forEach(([stateProp, styleKey]) => {
        const className = stylesConfig[styleKey];
        if (!className) return;
        const unsub = this.#store.effect(() => {
          const currentSlice = this.#store.getSlice(this.#sliceKey);
          const isConditionMet = !!currentSlice[stateProp];
          ModifierDOM.toggleClass(element, className, isConditionMet);
        });
        this.#unsubscribeEffects.push(unsub);
      });
    });
    DebugAgent.info(`[ManifestBinder.bind()] Auto-Bindings f\xFCr '${this.#sliceKey}' erfolgreich etabliert.`);
  }
  unbind() {
    this.#unsubscribeEffects.forEach((unsub) => unsub());
    this.#unsubscribeEffects = [];
    this.#resolvedTargets.clear();
    DebugAgent.info(`[ManifestBinder.unbind()] Auto-Bindings f\xFCr '${this.#sliceKey}' sauber gel\xF6st.`);
  }
}
export {
  ManifestBinder
};
