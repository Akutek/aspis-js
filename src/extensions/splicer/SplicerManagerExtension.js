/** @typedef {import("../../types/managers.js").Registry} Registry */
/** @typedef {import("../../types/managers.js").FactoryPrep} FactoryPrep */
/** @typedef {import("../../types/managers.js").SplicePrep} SplicePrep */
/** @typedef {import("../../types/splicer.js").Splicer} Splicer */
/** @typedef {import("../../types/tailor.js").Tailor} Tailor */
/** @typedef {import("../../types/extensions.js").BaseExpansion} BaseExpansion */
import { ImportManager } from "../../managers/ImportManager.js";
import { RegistryManager } from "../../managers/RegistryManager.js";
import { FactoryManagerExtension } from "../factory/FactoryManagerExtension.js";
class SplicerManagerExtension {
  static get cacheKey() {
    return "splicer:current";
  }
  static get historyKey() {
    return "factory:history";
  }
  static get hostKey() {
    return "splicer";
  }
  static get specifier() {
    return "core.Splicer";
  }
  static empty() {
    return {
      tailor: null,
      splicer: null,
      tailored: {}
    };
  }
  static async host(registry, tailor = null) {
    if (registry && typeof registry.has === "function" && registry.has(this.hostKey)) {
      const existing = RegistryManager.get(registry, this.hostKey);
      this.bind(existing, registry, tailor);
      return existing;
    }
    const SplicerClass = await ImportManager.import(registry, this.specifier);
    if (typeof SplicerClass !== "function") {
      return null;
    }
    const splicer = new SplicerClass();
    this.bind(splicer, registry, tailor);
    RegistryManager.register(registry, this.hostKey, splicer);
    return splicer;
  }
  static bind(splicer, registry, tailor = null) {
    if (!splicer?.extension) {
      return this;
    }
    splicer.extension.bind(splicer, registry, tailor);
    return this;
  }
  static splice(splicer, parts, history = {}) {
    if (!splicer || typeof splicer.splice !== "function") {
      return { ...history };
    }
    return splicer.splice(parts, history);
  }
  static assemble(parts) {
    return FactoryManagerExtension.assemble(parts);
  }
  static async tailor(registry) {
    return FactoryManagerExtension.host(registry);
  }
  static async expand(registry, expansion = {}) {
    const splicer = await this.host(registry);
    if (!splicer?.extension) {
      return this;
    }
    await splicer.expand(expansion);
    return this;
  }
}
export {
  SplicerManagerExtension
};
