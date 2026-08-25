/** @typedef {import("../../types/managers.js").Registry} Registry */
/** @typedef {import("../../types/tailor.js").Tailor} Tailor */
/** @typedef {import("../../types/factory.js").TailorContext} TailorContext */
import { BaseExtension } from "../BaseExtension.js";
import { DebugAgent } from "../../agents/DebugAgent.js";
import { ErrorAgent } from "../../agents/ErrorAgent.js";
import { RegistryManager } from "../../managers/RegistryManager.js";
import { MixinService } from "../../services/MixinService.js";
import { CompositionService } from "../../services/CompositionService.js";
class TailorExtension extends BaseExtension {
  static prepare(tailor) {
    super.prepare(tailor, {
      debug: null,
      error: null
    });
    if (tailor.manifest == null) {
      tailor.manifest = {};
    }
    return this;
  }
  static bind(tailor, registry = null) {
    if (!tailor) {
      return this;
    }
    if (!tailor.runtime) {
      this.prepare(tailor);
    }
    if (!tailor.runtime) {
      return this;
    }
    tailor.runtime.debug = this.#debugFrom(registry);
    tailor.runtime.error = this.#errorFrom(registry);
    return this;
  }
  /** Hängt Mixin- und Composition-Schritte an, falls die Pipeline leer ist. */
  static wire(tailor, tools = {}) {
    if (!tailor) {
      return this;
    }
    if (!tailor.runtime) {
      this.prepare(tailor);
    }
    const mixinService = tools.mixin || MixinService;
    const compositionService = tools.composition || CompositionService;
    if (this.steps(tailor).length > 0) {
      return this;
    }
    this.use(tailor, (context, next) => {
      const mixins = Array.isArray(context.mixins) ? context.mixins : [];
      context.Class = mixinService.mix(context.Base, mixins);
      return next(context);
    });
    this.use(tailor, (context, next) => {
      if (context.mode === "half") {
        return next(context);
      }
      const parts = Array.isArray(context.compositions) ? context.compositions : [];
      context.Class = compositionService.compose(context.Class || context.Base, parts);
      return next(context);
    });
    return this;
  }
  static strengthen(tailor, context) {
    if (!tailor) {
      return context && context.Base ? context.Base : null;
    }
    if (!tailor.runtime) {
      this.prepare(tailor);
    }
    const seed = context && typeof context === "object" ? { ...context, Class: context.Class || context.Base || null } : { Base: null, mixins: [], compositions: [], mode: "full", Class: null, mixinService: MixinService, compositionService: CompositionService };
    const run = this.#pipeline(this.steps(tailor), (current) => current);
    const result = run(seed);
    return result && typeof result.Class === "function" ? result.Class : null;
  }
  static #pipeline(steps, core) {
    const valid = Array.isArray(steps) ? steps.filter((step) => typeof step === "function" || step && typeof step.handle === "function") : [];
    return function runPipeline(initialContext) {
      const dispatch = (index, currentContext) => {
        if (index >= valid.length) {
          return typeof core === "function" ? core(currentContext) : currentContext;
        }
        const step = valid[index];
        const next = (updatedContext = currentContext) => dispatch(index + 1, updatedContext);
        if (typeof step === "function") {
          return step(currentContext, next);
        }
        return step.handle(currentContext, next);
      };
      return dispatch(0, initialContext);
    };
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
  TailorExtension
};
