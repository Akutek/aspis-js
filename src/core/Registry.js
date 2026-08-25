/** @typedef {import("../types/registry.js").ControllerInstance} ControllerInstance */
/** @typedef {import("../types/extensions.js").BaseExpansion} BaseExpansion */
import { DebugAgent } from "../agents/DebugAgent.js";
import { RegistryExtension } from "../extensions/registry/RegistryExtension.js";
class Registry {
  #services;
  /**
   * Speicher für DOM-Knoten-zu-Controller Bindings.
   * Nutzt WeakMap, damit nicht mehr genutzte DOM-Elemente vom GC erfasst werden können.
   */
  #elements;
  /**
   * Nachzügler, kein Lifecycle-Vertrag. Garantie bleibt `destroy()` (Registry.delete, Factory remove).
   * Der Finalizer ruft `destroy` nur, wenn die Instanz noch nicht zerstört ist.
   */
  #finalizer;
  /** Die RegistryExtension-Klasse (statisch). Kein zweites Objekt. */
  extension;
  manifest;
  /** Laufzeitbeutel der Extension (Pipeline). */
  runtime;
  /**
   * Initialisiert den Service-Speicher, den WeakMap-Controller-Speicher
   * und bindet den GC-Cleanup-Finalizer.
   */
  constructor() {
    this.#services = /* @__PURE__ */ new Map();
    this.#elements = /* @__PURE__ */ new WeakMap();
    this.manifest = {};
    this.extension = RegistryExtension;
    this.runtime = null;
    this.#finalizer = new FinalizationRegistry((weakController) => {
      try {
        const controller = weakController.deref();
        if (controller && !controller._destroyed && typeof controller.destroy === "function") {
          controller.destroy();
        }
      } catch (error) {
        DebugAgent.error("[Registry.constructor()] Aspis [Registry]: Fehler beim GC-Cleanup:", error);
      }
    });
    RegistryExtension.prepare(this);
  }
  /** Baut die Registry weiter aus. Logik liegt an RegistryExtension.expand. */
  expand(expansion = {}) {
    return RegistryExtension.expand(this, expansion);
  }
  /**
   * Speichert einen Service (String-Key) oder verbindet einen Controller mit einem DOM-Element.
   *
   * Wirft, wenn ein String-Key bereits existiert oder der Key weder String noch HTMLElement ist.
   */
  set(key, value) {
    if (typeof key === "string") {
      if (this.#services.has(key)) {
        throw new Error(`Aspis [Registry]: Key '${key}' ist bereits registriert.`);
      }
      this.#services.set(key, value);
      return;
    }
    if (key instanceof HTMLElement) {
      if (this.#elements.has(key)) {
        this.delete(key);
      }
      const instance = value;
      this.#elements.set(key, instance);
      if (instance && typeof instance.destroy === "function") {
        this.#finalizer.register(key, new WeakRef(instance), key);
      }
      return;
    }
    throw new Error("Aspis [Registry]: Ung\xFCltiger Key-Typ in set().");
  }
  /**
   * Liest einen registrierten Service oder den zugehörigen Controller eines DOM-Elements aus.
   *
   * Wirft, wenn ein angeforderter String-Service nicht existiert.
   */
  get(key) {
    if (typeof key === "string") {
      if (!this.#services.has(key)) {
        throw new Error(`Aspis [Registry]: Service '${key}' existiert nicht im Container.`);
      }
      return this.#services.get(key);
    }
    if (key instanceof HTMLElement) {
      return this.#elements.get(key) || null;
    }
    return null;
  }
  has(key) {
    if (typeof key === "string") {
      return this.#services.has(key);
    }
    if (key instanceof HTMLElement) {
      return this.#elements.has(key);
    }
    return false;
  }
  /**
   * Entfernt einen Service oder deregistriert einen Controller von einem DOM-Element.
   * Erst Finalizer abmelden, dann `destroy()`, dann WeakMap — `destroy` bleibt die Semantik.
   */
  delete(key) {
    if (typeof key === "string") {
      return this.#services.delete(key);
    }
    if (key instanceof HTMLElement) {
      const controller = this.#elements.get(key);
      this.#finalizer.unregister(key);
      if (controller && typeof controller.destroy === "function") {
        try {
          controller.destroy();
        } catch (error) {
          DebugAgent.error("[Registry.delete()] Aspis [Registry]: Fehler beim destroy() Aufruf:", error);
        }
      }
      return this.#elements.delete(key);
    }
    return false;
  }
  /**
   * Leert ausschließlich alle registrierten Singleton-Services.
   * Die WeakMap `#elements` bleibt vom GC unberührt.
   */
  clearServices() {
    this.#services.clear();
  }
}
export {
  Registry
};
