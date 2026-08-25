/** @typedef {import("../types/cache.js").Cache} Cache */
/** @typedef {import("../types/store.js").StateManifest} StateManifest */
/** @typedef {import("../types/store.js").StoreRuntime} StoreRuntime */
/** @typedef {import("../types/store.js").StoreEffectRecord} StoreEffectRecord */
/** @typedef {import("../types/store.js").StoreExpansion} StoreExpansion */
/** @typedef {import("../types/store.js").SliceConfig} SliceConfig */
import { DebugAgent } from "../agents/DebugAgent.js";
import { StoreExtension } from "../extensions/store/StoreExtension.js";
class Store extends EventTarget {
  static get ALLOWED_NAMESPACES() {
    return StoreExtension.namespaces({});
  }
  manifest;
  cache;
  /** Die StoreExtension-Klasse (statisch). Kein zweites Objekt. */
  extension;
  /** Laufzeitbeutel: Maps, Pipeline, Proxy — geführt am Store, genutzt von den Store*-Helfern. */
  runtime;
  constructor(manifest = {}, initialData = {}, cache = null) {
    super();
    this.manifest = {};
    this.cache = cache;
    this.extension = StoreExtension;
    StoreExtension.prepare(this, initialData);
    if (manifest.slices) {
      StoreExtension.apply(this, manifest);
    } else {
      DebugAgent.info("[Store.constructor()] Store vorbereitet, Schema folgt \xFCber StoreExtension.apply().");
    }
  }
  get strictMode() {
    return this.runtime.strictMode;
  }
  get _activeEffect() {
    const stack = this.runtime.effectStack;
    return stack[stack.length - 1] || null;
  }
  get state() {
    return this.runtime.stateProxy;
  }
  get data() {
    return Object.freeze({ ...this.runtime.data });
  }
  getSlice(path) {
    if (!path || typeof path !== "string") {
      throw new Error("Aspis [Store-Schutzschild]: getSlice verlangt einen g\xFCltigen Pfad-String.");
    }
    const parts = path.split(".");
    let current = this.runtime.stateProxy;
    for (const part of parts) {
      if (current && typeof current === "object" && part in current) {
        current = current[part];
      } else {
        throw new Error(
          `Aspis [Store-Schutzschild]: Zugriff verweigert! Das Feature/Slice "${path}" ist nicht im state-manifest.json deklariert.`
        );
      }
    }
    return current;
  }
  getConfig(path) {
    return this.runtime.configs[path] || {};
  }
  updateData(newData) {
    this.runtime.data = newData;
    this.trigger("data", this.runtime.data);
  }
  /** Baut den Store weiter aus (Schema, Middleware, Plugins). Logik liegt an StoreExtension.expand. */
  expand(expansion = {}) {
    return StoreExtension.expand(this, expansion);
  }
  effect(fn) {
    return StoreExtension.effect(this, fn);
  }
  pushEffect(effect) {
    StoreExtension.pushEffect(this, effect);
  }
  popEffect() {
    StoreExtension.popEffect(this);
  }
  addDependency(targetOrPath, childPathOrDataPath) {
    StoreExtension.addDependency(this, targetOrPath, childPathOrDataPath);
  }
  removeDomDependencies(targetElement) {
    StoreExtension.removeDomDependencies(this, targetElement);
  }
  flush() {
    StoreExtension.flush(this);
  }
  isPathDeclared(path) {
    return StoreExtension.isPathDeclared(this, path);
  }
  track(path) {
    StoreExtension.track(this, path);
  }
  trigger(path, value) {
    StoreExtension.trigger(this, path, value);
  }
  cascade(parentPath) {
    StoreExtension.cascade(this, parentPath);
  }
  _cleanupEffect(effect, paths) {
    StoreExtension.cleanupEffect(this, effect, paths);
  }
}
export {
  Store
};
