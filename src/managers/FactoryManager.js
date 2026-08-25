/** @typedef {import("../types/managers.js").Registry} Registry */
/** @typedef {import("../types/managers.js").FactoryPrep} FactoryPrep */
import { BaseManager } from "./BaseManager.js";
import { FactoryManagerExtension } from "../extensions/factory/FactoryManagerExtension.js";
import { SplicerManager } from "./SplicerManager.js";
class FactoryManager extends BaseManager {
  static get extension() {
    return FactoryManagerExtension;
  }
  static get cacheKey() {
    return this.extension.cacheKey;
  }
  static get historyKey() {
    return this.extension.historyKey;
  }
  static async factory(registry, parts) {
    try {
      let assembled = /** @type {any} */ (this.extension.assemble(parts));
      if (!assembled.splicer) {
        assembled = await SplicerManager.splice(registry, assembled);
      }
      assembled.mounted = await this.spawn(registry, assembled);
      this.cacheSet(registry, this.cacheKey, assembled);
      this.cacheSet(registry, this.historyKey, assembled.tailored || {});
      const tailoredCount = Object.keys(assembled.tailored || {}).length;
      this.info(
        registry,
        `spawn ${assembled.mounted} Instanzen aus ${tailoredCount} Klassen. Queue view ${assembled.watchers.queue.view.length}.`
      );
      return assembled;
    } catch (error) {
      this.capture(registry, error);
      const empty = this.extension.empty();
      this.cacheSet(registry, this.cacheKey, empty);
      return empty;
    }
  }
  static last(registry) {
    const stored = this.cacheGet(registry, this.cacheKey, null);
    if (stored && typeof stored === "object" && stored.compared && stored.watchers && stored.compose && stored.controllers) {
      return stored;
    }
    return this.extension.empty();
  }
  static async spawn(registry, parts) {
    return this.extension.mount(registry, parts);
  }
}
export {
  FactoryManager
};
