/** @typedef {import("../types/registry.js").Registry} Registry */
/** @typedef {import("../types/store.js").Store} Store */
import { DebugAgent } from "../agents/DebugAgent.js";
import { RegistryManager } from "../managers/RegistryManager.js";
import { StoreDomDependencyScanner } from "../utils/StoreDomDependencyScanner.js";
class ControllerCleaner {
  /**
   * Ohne Host-Instanz: Store-Bindungen lösen, Controller destroy, WeakMap.
   * Liegt ein `cleaner` in der Registry, geht der Aufruf dorthin.
   */
  static clean(registry, element) {
    const hosted = this.#hosted(registry);
    if (hosted) {
      if (element instanceof HTMLElement) {
        hosted.clean(element);
      }
      return;
    }
    this.#cleanBound(registry, element);
  }
  static cleanTree(registry, rootElement) {
    const hosted = this.#hosted(registry);
    if (hosted) {
      if (rootElement instanceof Element) {
        hosted.cleanTree(rootElement);
      }
      return;
    }
    this.#walk(registry, rootElement);
  }
  #registry;
  constructor(registry) {
    this.#registry = registry;
  }
  clean(element) {
    if (!element || !this.#registry) return;
    const store = this.#registry.get("store");
    if (store && typeof store.removeDomDependencies === "function") {
      store.removeDomDependencies(element);
    }
    const controller = this.#registry.get(element);
    if (!controller) return;
    try {
      if (controller.classService && typeof controller.classService.cleanup === "function") {
        controller.classService.cleanup();
      }
      if (typeof controller.destroy === "function") {
        controller.destroy();
      }
    } catch (error) {
      DebugAgent.error(`[ControllerCleaner.clean()] Aspis [ControllerCleaner]: Fehler beim Zerst\xF6ren von ${controller.constructor?.name || "Controller"}:`, error);
    } finally {
      this.#registry.delete(element);
    }
  }
  /**
   * Durchsucht einen DOM-Teilbaum rückwärts (Bottom-Up) nach Elementen mit `data-controller`
   * und führt für jedes gefundene Element (inklusive Root) das Cleanup durch.
   */
  cleanTree(rootElement) {
    if (!rootElement || !(rootElement instanceof Element)) return;
    const targets = [];
    const children = rootElement.querySelectorAll("[data-controller]");
    for (const child of children) {
      if (child instanceof HTMLElement) {
        targets.push(child);
      }
    }
    if (typeof rootElement.matches === "function" && rootElement.matches("[data-controller]") && rootElement instanceof HTMLElement) {
      targets.push(rootElement);
    }
    for (let i = targets.length - 1; i >= 0; i--) {
      this.clean(targets[i]);
    }
  }
  static #hosted(registry) {
    if (!registry || typeof registry.has !== "function" || !registry.has("cleaner")) {
      return null;
    }
    const hosted = RegistryManager.get(registry, "cleaner");
    return hosted instanceof ControllerCleaner ? hosted : null;
  }
  static #walk(registry, rootElement) {
    if (!rootElement || !(rootElement instanceof Element)) {
      return;
    }
    const targets = [];
    const children = rootElement.querySelectorAll("[data-controller]");
    for (const child of children) {
      if (child instanceof HTMLElement) {
        targets.push(child);
      }
    }
    if (typeof rootElement.matches === "function" && rootElement.matches("[data-controller]") && rootElement instanceof HTMLElement) {
      targets.push(rootElement);
    }
    for (let i = targets.length - 1; i >= 0; i -= 1) {
      this.#cleanBound(registry, targets[i]);
    }
  }
  static #cleanBound(registry, element) {
    if (!registry || !(element instanceof HTMLElement)) {
      return;
    }
    if (typeof registry.has === "function" && registry.has("store")) {
      StoreDomDependencyScanner.unregister(element, RegistryManager.get(registry, "store"));
    }
    RegistryManager.unbind(registry, element);
  }
}
export {
  ControllerCleaner
};
