/** @typedef {import("../../types/store.js").Store} Store */
/** @typedef {import("../../types/store.js").StoreEffectRecord} StoreEffectRecord */
class StoreReactiveEffect {
  static create(store, fn) {
    return { store, fn, trackedPaths: /* @__PURE__ */ new Set() };
  }
  static run(effect) {
    try {
      effect.store.pushEffect(effect);
      return effect.fn();
    } finally {
      effect.store.popEffect();
    }
  }
  static trackPath(effect, path) {
    effect.trackedPaths.add(path);
  }
  static stop(effect) {
    effect.store._cleanupEffect(effect, effect.trackedPaths);
    effect.trackedPaths.clear();
  }
}
export {
  StoreReactiveEffect
};
