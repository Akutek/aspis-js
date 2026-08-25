/** @typedef {import("../types/registry.js").Registry} Registry */
import { Importer } from "../core/Importer.js";
import { ImporterExtension } from "../extensions/importer/ImporterExtension.js";
import { BaseManager } from "./BaseManager.js";
import { RegistryManager } from "./RegistryManager.js";
import { ErrorAgent } from "../agents/ErrorAgent.js";
class ImportManager extends BaseManager {
  static init(registry) {
    const cache = this.cache(registry);
    const store = this.store(registry);
    const importer = new Importer(cache, store);
    RegistryManager.register(registry, "importer", importer);
    return importer;
  }
  static apply(registry, manifest) {
    const importer = this.importer(registry);
    if (!importer) return;
    ImporterExtension.apply(importer, manifest);
  }
  /** Lädt eine Klasse über den Katalog. Erst nach ImportManager.init nutzbar. */
  static async import(registry, specifier) {
    const importer = this.importer(registry);
    if (!importer) {
      return ErrorAgent.shared().throw("ImportManager.import(): kein Importer in der Registry.");
    }
    return ImporterExtension.import(importer, specifier);
  }
}
export {
  ImportManager
};
