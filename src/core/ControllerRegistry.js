/** @typedef {import("../types/registry.js").ControllerConstructor} ControllerConstructor */
/** @typedef {import("../types/registry.js").ControllerRegistryCache} ControllerRegistryCache */
import { DebugAgent } from "../agents/DebugAgent.js";
class ControllerRegistry {
  /** Statischer Cache für bereits geladene Controller-Klassen über alle Instanzen hinweg. */
  static #sharedCache = /* @__PURE__ */ new Map();
  #resolvedControllers = /* @__PURE__ */ new Map();
  #basePath;
  constructor(basePath = "./controllers") {
    this.#basePath = basePath;
  }
  /** Lädt eine Controller-Klasse statisch und asynchron über eine Standard-Instanz. */
  static async getAsync(controllerName) {
    const instance = new ControllerRegistry("./controllers");
    return instance.getAsync(controllerName);
  }
  async getAsync(typeOrName) {
    if (!typeOrName || typeof typeOrName !== "string") {
      DebugAgent.error(`[ControllerRegistry.getAsync()] Aspis [ControllerRegistry]: Ung\xFCltiger Typ '${typeof typeOrName}'.`);
      return null;
    }
    const trimmed = typeOrName.trim();
    const safeNameRegex = /^[A-Za-z0-9_-]+$/;
    if (!safeNameRegex.test(trimmed)) {
      DebugAgent.error(`[ControllerRegistry.getAsync()] Aspis [ControllerRegistry]: Sicherheitsfehler - Ung\xFCltiger Name '${trimmed}'.`);
      return null;
    }
    if (this.#resolvedControllers.has(trimmed)) {
      return this.#resolvedControllers.get(trimmed) ?? null;
    }
    if (ControllerRegistry.#sharedCache.has(trimmed)) {
      const cachedClass = ControllerRegistry.#sharedCache.get(trimmed);
      if (!cachedClass) {
        return null;
      }
      this.#resolvedControllers.set(trimmed, cachedClass);
      return cachedClass;
    }
    const isFullClassName = trimmed.toLowerCase().startsWith("controller");
    const className = isFullClassName ? trimmed.charAt(0).toUpperCase() + trimmed.slice(1) : `Controller${trimmed.charAt(0).toUpperCase() + trimmed.slice(1)}`;
    const fileUrl = `${this.#basePath}/${className}.js`;
    try {
      const module = await import(fileUrl);
      const ControllerClass = module[className] || module.default || module[trimmed];
      if (!ControllerClass) {
        DebugAgent.error(`[ControllerRegistry.getAsync()] Aspis [ControllerRegistry]: Klasse '${className}' konnte in '${fileUrl}' nicht gefunden werden.`);
        return null;
      }
      this.#resolvedControllers.set(trimmed, ControllerClass);
      ControllerRegistry.#sharedCache.set(trimmed, ControllerClass);
      return ControllerClass;
    } catch (error) {
      DebugAgent.error(`[ControllerRegistry.getAsync()] Aspis [ControllerRegistry]: Fehler beim dynamischen Laden von '${fileUrl}':`, error);
      return null;
    }
  }
}
export {
  ControllerRegistry
};
