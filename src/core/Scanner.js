/** @typedef {import("../types/extensions.js").BaseExpansion} BaseExpansion */
/** @typedef {import("../types/managers.js").ScanResults} ScanResults */
import { ScannerExtension } from "../extensions/scanner/ScannerExtension.js";
class Scanner {
  extension;
  manifest;
  runtime;
  constructor() {
    this.extension = ScannerExtension;
    this.manifest = {};
    this.runtime = null;
    ScannerExtension.prepare(this);
  }
  scan(rootElement) {
    return ScannerExtension.scan(this, rootElement);
  }
  expand(expansion = {}) {
    return ScannerExtension.expand(this, expansion);
  }
}
export {
  Scanner
};
