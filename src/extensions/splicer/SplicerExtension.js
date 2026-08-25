/** @typedef {import("../../types/managers.js").Registry} Registry */
/** @typedef {import("../../types/managers.js").FactoryPrep} FactoryPrep */
/** @typedef {import("../../types/splicer.js").Splicer} Splicer */
/** @typedef {import("../../types/tailor.js").Tailor} Tailor */
/** @typedef {import("../../types/factory.js").LoadTask} LoadTask */
import { BaseExtension } from "../BaseExtension.js";
import { DebugAgent } from "../../agents/DebugAgent.js";
import { ErrorAgent } from "../../agents/ErrorAgent.js";
import { RegistryManager } from "../../managers/RegistryManager.js";
import { ControllerService } from "../../services/ControllerService.js";
import { ObserverManagerExtension } from "../observer/ObserverManagerExtension.js";
class SplicerExtension extends BaseExtension {
  static prepare(splicer) {
    super.prepare(splicer, {
      debug: null,
      error: null,
      tailor: null
    });
    if (splicer.manifest == null) {
      splicer.manifest = {};
    }
    return this;
  }
  static bind(splicer, registry = null, tailor = null) {
    if (!splicer) {
      return this;
    }
    if (!splicer.runtime) {
      this.prepare(splicer);
    }
    if (!splicer.runtime) {
      return this;
    }
    splicer.runtime.debug = this.#debugFrom(registry);
    splicer.runtime.error = this.#errorFrom(registry);
    if (tailor) {
      splicer.runtime.tailor = tailor;
    }
    return this;
  }
  static splice(splicer, parts, history = {}) {
    const tailored = { ...history };
    const tailor = splicer && splicer.runtime ? splicer.runtime.tailor : null;
    if (!tailor || typeof tailor.strengthen !== "function" || !parts) {
      return tailored;
    }
    if (tailor.extension && typeof tailor.extension.wire === "function") {
      tailor.extension.wire(tailor, {
        mixin: parts.compose.mixin,
        composition: parts.compose.composition
      });
    }
    const queue = parts.watchers && parts.watchers.queue ? parts.watchers.queue : ObserverManagerExtension.emptyQueue();
    this.#band(tailor, parts, queue.view, "full", tailored);
    this.#band(tailor, parts, queue.near, "half", tailored);
    this.#history(tailor, parts, queue.history, tailored);
    const debug = splicer.runtime?.debug || DebugAgent.shared();
    debug.info(`[SplicerExtension.splice()] ${Object.keys(tailored).length} Klassen gesplei\xDFt.`);
    return tailored;
  }
  static #band(tailor, parts, tasks, mode, tailored) {
    if (!Array.isArray(tasks)) {
      return;
    }
    for (let i = 0; i < tasks.length; i += 1) {
      const task = tasks[i];
      const key = this.#key(task);
      if (!key || tailored[key]) {
        continue;
      }
      const Class = this.#strengthen(tailor, parts, task, mode);
      if (typeof Class === "function") {
        tailored[key] = Class;
      }
    }
  }
  static #history(tailor, parts, tasks, tailored) {
    if (!Array.isArray(tasks)) {
      return;
    }
    for (let i = 0; i < tasks.length; i += 1) {
      const key = this.#key(tasks[i]);
      if (!key || tailored[key]) {
        continue;
      }
      const Class = this.#strengthen(tailor, parts, tasks[i], "full");
      if (typeof Class === "function") {
        tailored[key] = Class;
      }
    }
  }
  static #strengthen(tailor, parts, task, mode) {
    const classes = parts.controllers.classes || {};
    const Base = classes[ControllerService.baseSpecifier];
    if (typeof Base !== "function") {
      const fallback = this.#firstClass(task, classes);
      return typeof fallback === "function" ? fallback : null;
    }
    return tailor.strengthen({
      Base,
      mixins: this.#mixins(task, classes),
      compositions: this.#compositions(task, classes),
      mode,
      Class: null,
      mixinService: parts.compose.mixin,
      compositionService: parts.compose.composition
    });
  }
  static #mixins(task, classes) {
    const list = [];
    const seen = /* @__PURE__ */ new Set([ControllerService.baseSpecifier]);
    const specifiers = [];
    if (task && Array.isArray(task.specifiers)) {
      specifiers.push(...task.specifiers);
    }
    const extra = task && task.item && Array.isArray(task.item.mixins) ? task.item.mixins : [];
    specifiers.push(...extra);
    for (let i = 0; i < specifiers.length; i += 1) {
      const specifier = specifiers[i];
      if (!specifier || seen.has(specifier)) {
        continue;
      }
      seen.add(specifier);
      if (typeof classes[specifier] !== "function") {
        ErrorAgent.shared().throw(`Unbekanntes Mixin '${specifier}'.`);
      }
      list.push(classes[specifier]);
    }
    return list;
  }
  static #compositions(task, classes) {
    const list = [];
    const names = task && task.item && Array.isArray(task.item.compositions) ? task.item.compositions : [];
    for (let i = 0; i < names.length; i += 1) {
      const part = classes[names[i]];
      if (part && typeof part === "object" && typeof part !== "function") {
        list.push(part);
      }
    }
    return list;
  }
  static #firstClass(task, classes) {
    const specifiers = task && Array.isArray(task.specifiers) ? task.specifiers : [];
    for (let i = 0; i < specifiers.length; i += 1) {
      if (typeof classes[specifiers[i]] === "function") {
        return classes[specifiers[i]];
      }
    }
    return null;
  }
  static #key(task) {
    if (!task) {
      return "";
    }
    if (task.item && typeof task.item.type === "string" && task.item.type) {
      return task.item.type;
    }
    if (Array.isArray(task.specifiers) && task.specifiers[0]) {
      return task.specifiers[0];
    }
    return "";
  }
  static #debugFrom(registry) {
    if (registry && typeof registry.has === "function" && registry.has("debug")) {
      return RegistryManager.get(registry, "debug");
    }
    return DebugAgent.shared();
  }
  static #errorFrom(registry) {
    if (registry && typeof registry.has === "function" && registry.has("error")) {
      return RegistryManager.get(registry, "error");
    }
    return ErrorAgent.shared();
  }
}
export {
  SplicerExtension
};
