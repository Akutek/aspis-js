/** @typedef {import("../types/managers.js").Registry} Registry */
/** @typedef {import("../types/managers.js").FactoryPrep} FactoryPrep */
/** @typedef {import("../types/managers.js").SplicePrep} SplicePrep */
/** @typedef {import("../types/extensions.js").BaseExpansion} BaseExpansion */
import { BaseManager } from "./BaseManager.js";
import { SplicerManagerExtension } from "../extensions/splicer/SplicerManagerExtension.js";
class SplicerManager extends BaseManager {
  static get extension() {
    return SplicerManagerExtension;
  }
  static get cacheKey() {
    return this.extension.cacheKey;
  }
  static get historyKey() {
    return this.extension.historyKey;
  }
  static get splicerSpecifier() {
    return this.extension.specifier;
  }
  static async splice(registry, parts) {
    try {
      const assembled = this.extension.assemble(parts ?? this.#emptyParts());
      const hadHost = this.has(registry, this.extension.hostKey);
      const tailor = assembled.tailor || await this.extension.tailor(registry);
      assembled.tailor = tailor;
      if (!tailor) {
        this.warn(registry, "Tailor nicht geladen.");
      }
      const splicer = await this.extension.host(registry, tailor);
      assembled.splicer = splicer;
      if (!splicer) {
        this.warn(registry, "Splicer nicht geladen.");
      } else if (!hadHost) {
        this.info(registry, "Splicer \xFCber Importer geladen.");
      }
      const history = this.cacheGet(registry, this.historyKey, {});
      assembled.tailored = this.extension.splice(splicer, assembled, history);
      assembled.mounted = typeof assembled.mounted === "number" ? assembled.mounted : 0;
      this.cacheSet(registry, this.cacheKey, this.#snapshot(assembled));
      const tailoredCount = Object.keys(assembled.tailored).length;
      this.info(registry, `${tailoredCount} Klassen gesplei\xDFt.`);
      return assembled;
    } catch (error) {
      this.capture(registry, error);
      const empty = this.#emptyParts();
      empty.tailor = null;
      empty.splicer = null;
      empty.tailored = {};
      this.cacheSet(registry, this.cacheKey, this.extension.empty());
      return empty;
    }
  }
  static last(registry) {
    const stored = this.cacheGet(registry, this.cacheKey, null);
    if (stored && typeof stored === "object") {
      return {
        tailor: stored.tailor || null,
        splicer: stored.splicer || null,
        tailored: stored.tailored && typeof stored.tailored === "object" ? stored.tailored : {}
      };
    }
    return this.extension.empty();
  }
  static async expand(registry, expansion = {}) {
    try {
      return await this.extension.expand(registry, expansion);
    } catch (error) {
      this.capture(registry, error);
      return this.extension;
    }
  }
  static #snapshot(assembled) {
    return {
      tailor: assembled.tailor || null,
      splicer: assembled.splicer || null,
      tailored: assembled.tailored && typeof assembled.tailored === "object" ? assembled.tailored : {}
    };
  }
  static #emptyParts() {
    return {
      compared: { add: [], keep: [], update: [], remove: [] },
      watchers: { skipped: true, specifiers: [], queue: { view: [], near: [], far: [], history: [] } },
      compose: { items: [], mixin: () => void 0, composition: () => void 0 },
      controllers: { specifiers: [], classes: {} },
      tailor: null,
      splicer: null,
      tailored: {}
    };
  }
}
export {
  SplicerManager
};
