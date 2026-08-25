/** @typedef {import("../../types/store.js").Store} Store */
import { DebugAgent } from "../../agents/DebugAgent.js";
import { StoreSchema } from "./StoreSchema.js";
class StoreDependencies {
  static add(store, targetOrPath, childPathOrDataPath) {
    if (!targetOrPath || !childPathOrDataPath) {
      DebugAgent.warn("[StoreDependencies.add()] addDependency() abgebrochen - Parameter d\xFCrfen nicht leer sein.");
      return;
    }
    const runtime = store.runtime;
    if (targetOrPath instanceof HTMLElement) {
      if (typeof childPathOrDataPath !== "string" || !childPathOrDataPath.trim()) {
        DebugAgent.warn("[StoreDependencies.add()] DOM-Abh\xE4ngigkeit ben\xF6tigt einen g\xFCltigen Pfad-String.");
        return;
      }
      const path = childPathOrDataPath.trim();
      let targets = runtime.domDependencies.get(path);
      if (!targets) {
        targets = /* @__PURE__ */ new Set();
        runtime.domDependencies.set(path, targets);
      }
      targets.add(targetOrPath);
      return;
    }
    if (typeof targetOrPath === "string" && typeof childPathOrDataPath === "string") {
      const parentPath = targetOrPath.trim();
      const childPath = childPathOrDataPath.trim();
      if (!parentPath || !childPath) {
        DebugAgent.warn("[StoreDependencies.add()] Pfad-Abh\xE4ngigkeit enth\xE4lt leere Pfad-Strings.");
        return;
      }
      let children = runtime.dependencies.get(parentPath);
      if (!children) {
        children = /* @__PURE__ */ new Set();
        runtime.dependencies.set(parentPath, children);
      }
      children.add(childPath);
      DebugAgent.info(`[StoreDependencies.add()] Logische Kaskade registriert [${parentPath} \u2500\u2500> ${childPath}]`);
      return;
    }
    throw new Error("Aspis [Store]: Ung\xFCltige Signatur in addDependency(). Erlaubt: (HTMLElement, String) oder (String, String).");
  }
  static removeDom(store, targetElement) {
    if (!(targetElement instanceof HTMLElement)) return;
    store.runtime.domDependencies.forEach((elements) => {
      elements.delete(targetElement);
    });
    store.runtime.domDependencies.forEach((elements, path) => {
      if (elements.size === 0) {
        store.runtime.domDependencies.delete(path);
      }
    });
  }
  static collectDomUpdates(store, path) {
    const pending = store.runtime.pendingDomUpdates;
    store.runtime.domDependencies.forEach((elements, registeredDataPath) => {
      if (path !== registeredDataPath && !path.startsWith(`${registeredDataPath}.`)) return;
      elements.forEach((element) => {
        if (!element.isConnected) {
          elements.delete(element);
          return;
        }
        let queued = pending.get(element);
        if (!queued) {
          queued = /* @__PURE__ */ new Set();
          pending.set(element, queued);
        }
        queued.add(path);
      });
    });
  }
  static cascade(store, parentPath) {
    const children = store.runtime.dependencies.get(parentPath);
    if (!children) return;
    children.forEach((childPath) => {
      DebugAgent.info(`[StoreDependencies.cascade()] Parent '${parentPath}' zwingt Child '${childPath}' zum Reset.`);
      const parts = childPath.split(".");
      let current = store.state;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!current || typeof current !== "object") return;
        current = current[parts[i]];
        if (!current) return;
      }
      if (!current || typeof current !== "object") return;
      const record = current;
      const targetKey = parts[parts.length - 1];
      const initialVal = StoreSchema.getInitialValue(store.manifest, childPath);
      let resetValue = null;
      if (Array.isArray(initialVal) || Array.isArray(record[targetKey])) {
        resetValue = [];
      } else if (initialVal !== null && typeof initialVal === "object" || record[targetKey] !== null && typeof record[targetKey] === "object") {
        resetValue = {};
      } else if (initialVal !== void 0) {
        resetValue = initialVal;
      }
      record[targetKey] = resetValue;
    });
  }
}
export {
  StoreDependencies
};
