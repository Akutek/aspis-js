/** @typedef {import("../types/importer.js").Cache} Cache */
/** @typedef {import("../types/importer.js").Store} Store */
/** @typedef {import("../types/importer.js").ImporterManifest} ImporterManifest */
/** @typedef {import("../types/importer.js").ImporterRuntime} ImporterRuntime */
/** @typedef {import("../types/importer.js").BaseExpansion} BaseExpansion */
import { ImporterExtension } from "../extensions/importer/ImporterExtension.js";
class Importer {
  extension;
  manifest;
  runtime;
  cache;
  store;
  constructor(cache = null, store = null) {
    this.extension = ImporterExtension;
    this.manifest = { classRouting: {} };
    this.runtime = null;
    this.cache = cache;
    this.store = store;
    ImporterExtension.prepare(this);
  }
  apply(manifest = {}) {
    return ImporterExtension.apply(this, manifest);
  }
  expand(expansion = {}) {
    return ImporterExtension.expand(this, expansion);
  }
  import(specifier) {
    return ImporterExtension.import(this, specifier);
  }
}
export {
  Importer
};
