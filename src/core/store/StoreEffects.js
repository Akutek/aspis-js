/** @typedef {import("../../types/store.js").Store} Store */
/** @typedef {import("../../types/store.js").StoreEffectRecord} StoreEffectRecord */
import { StoreReactiveEffect } from "./StoreReactiveEffect.js";
class StoreEffects {
  static hasQueued(store) {
    return store.runtime.effectQueue.size > 0;
  }
  static active(store) {
    const stack = store.runtime.effectStack;
    return stack[stack.length - 1] || null;
  }
  static effect(store, fn) {
    if (typeof fn !== "function") return () => {
    };
    const record = StoreReactiveEffect.create(store, fn);
    StoreReactiveEffect.run(record);
    return () => StoreReactiveEffect.stop(record);
  }
  static push(store, effect) {
    store.runtime.effectStack.push(effect);
  }
  static pop(store) {
    store.runtime.effectStack.pop();
  }
  static track(store, path) {
    const active = this.active(store);
    if (!active) return;
    const listeners = store.runtime.listeners;
    if (!listeners.has(path)) {
      listeners.set(path, /* @__PURE__ */ new Set());
    }
    listeners.get(path)?.add(active);
    StoreReactiveEffect.trackPath(active, path);
  }
  static enqueue(store, path) {
    const pathListeners = store.runtime.listeners.get(path);
    if (!pathListeners) return;
    pathListeners.forEach((effect) => store.runtime.effectQueue.add(effect));
  }
  static runQueue(store) {
    if (store.runtime.effectQueue.size === 0) return;
    store.runtime.effectQueue.forEach((effect) => StoreReactiveEffect.run(effect));
  }
  static clearQueue(store) {
    store.runtime.effectQueue.clear();
  }
  static cleanup(store, effect, paths) {
    paths.forEach((path) => {
      const pathListeners = store.runtime.listeners.get(path);
      if (!pathListeners) return;
      pathListeners.delete(effect);
      if (pathListeners.size === 0) {
        store.runtime.listeners.delete(path);
      }
    });
  }
}
export {
  StoreEffects
};
