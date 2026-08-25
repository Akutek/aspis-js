/** @typedef {import("../../types/store.js").Store} Store */
/** @typedef {import("../../types/store.js").StateManifest} StateManifest */
/** @typedef {import("../../types/store.js").StoreEffectRecord} StoreEffectRecord */
/** @typedef {import("../../types/extensions.js").ExtensionHost} ExtensionHost */
import { DebugAgent } from "../../agents/DebugAgent.js";
import { BaseExtension } from "../BaseExtension.js";
import { StoreDeclareShield } from "../../core/store/StoreDeclareShield.js";
import { StoreDependencies } from "../../core/store/StoreDependencies.js";
import { StoreEffects } from "../../core/store/StoreEffects.js";
import { StoreFlush } from "../../core/store/StoreFlush.js";
import { StoreProxy } from "../../core/store/StoreProxy.js";
import { StoreSchema } from "../../core/store/StoreSchema.js";
class StoreExtension extends BaseExtension {
  static get pipelineKey() {
    return "setPipeline";
  }
  /** Legt die Runtime am Store an und hängt eager Middlewares. */
  static prepare(host, seed = {}) {
    const store = host;
    store.runtime = {
      data: seed,
      configs: {},
      strictMode: true,
      tree: {},
      stateProxy: {},
      setPipeline: [],
      listeners: /* @__PURE__ */ new Map(),
      dependencies: /* @__PURE__ */ new Map(),
      domDependencies: /* @__PURE__ */ new Map(),
      proxyCache: /* @__PURE__ */ new WeakMap(),
      effectQueue: /* @__PURE__ */ new Set(),
      pendingDomUpdates: /* @__PURE__ */ new Map(),
      isFlushPending: false,
      flushTimerId: null,
      effectStack: []
    };
    this.use(host, StoreDeclareShield.handle);
    return this;
  }
  static apply(host, manifest = {}) {
    const store = host;
    const stateManifest = manifest;
    store.manifest = stateManifest || {};
    store.runtime.strictMode = store.manifest.settings?.strictMode ?? true;
    const { tree, configs } = StoreSchema.extract(store.manifest);
    store.runtime.tree = tree;
    store.runtime.configs = configs;
    store.runtime.stateProxy = StoreProxy.wrap(store, tree, "");
    DebugAgent.info("[StoreExtension.apply()] State-Baum aus Schema aufgebaut.", tree);
    return this;
  }
  /**
   * Merged ein Teil-Manifest in den bestehenden Store und legt neue Namespaces/Slices auf den Rohbaum.
   * Schreibt nicht durch den Proxy — der Declare-Shield bleibt für App-Mutationen geschlossen.
   */
  static graft(host, extraManifest = {}) {
    const store = host;
    const merged = StoreSchema.merge(store.manifest, extraManifest);
    store.manifest = merged;
    store.runtime.strictMode = merged.settings?.strictMode ?? store.runtime.strictMode ?? true;
    const { tree, configs } = StoreSchema.extract(merged);
    store.runtime.configs = { ...store.runtime.configs, ...configs };
    const root = store.runtime.tree;
    if (!root || typeof root !== "object") {
      store.runtime.tree = tree;
      store.runtime.stateProxy = StoreProxy.wrap(store, tree, "");
      DebugAgent.info("[StoreExtension.graft()] State-Baum neu aufgebaut.", tree);
      return this;
    }
    const rootBag = root;
    const treeBag = tree;
    Object.keys(treeBag).forEach((namespace) => {
      const existing = rootBag[namespace];
      const incoming = treeBag[namespace];
      if (!existing || typeof existing !== "object") {
        rootBag[namespace] = incoming;
        return;
      }
      if (!incoming || typeof incoming !== "object") {
        return;
      }
      const existingBag = existing;
      const incomingBag = incoming;
      Object.keys(incomingBag).forEach((sliceKey) => {
        if (!(sliceKey in existingBag)) {
          existingBag[sliceKey] = incomingBag[sliceKey];
        }
      });
    });
    store.runtime.stateProxy = StoreProxy.wrap(store, rootBag, "");
    DebugAgent.info("[StoreExtension.graft()] Manifest in bestehenden Baum gepfropft.", extraManifest);
    return this;
  }
  static namespaces(manifest) {
    return StoreSchema.namespaces(manifest);
  }
  static isPathDeclared(store, path) {
    return StoreSchema.isPathDeclared(store.manifest, path);
  }
  static effect(store, fn) {
    return StoreEffects.effect(store, fn);
  }
  static pushEffect(store, effect) {
    StoreEffects.push(store, effect);
  }
  static popEffect(store) {
    StoreEffects.pop(store);
  }
  static track(store, path) {
    StoreEffects.track(store, path);
  }
  static trigger(store, path, value) {
    StoreEffects.enqueue(store, path);
    StoreDependencies.collectDomUpdates(store, path);
    store.dispatchEvent(new CustomEvent(`store:${path}`, { detail: { path, value } }));
    store.dispatchEvent(new CustomEvent("store:mutation", { detail: { path, value } }));
    if (StoreEffects.hasQueued(store) || StoreFlush.hasPendingDom(store)) {
      StoreFlush.schedule(store);
    }
  }
  static cascade(store, parentPath) {
    StoreDependencies.cascade(store, parentPath);
  }
  static addDependency(store, targetOrPath, childPathOrDataPath) {
    StoreDependencies.add(store, targetOrPath, childPathOrDataPath);
  }
  static removeDomDependencies(store, targetElement) {
    StoreDependencies.removeDom(store, targetElement);
  }
  static flush(store) {
    StoreFlush.flushNow(store);
  }
  static cleanupEffect(store, effect, paths) {
    StoreEffects.cleanup(store, effect, paths);
  }
}
export {
  StoreExtension
};
