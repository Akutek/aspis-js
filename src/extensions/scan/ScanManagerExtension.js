/** @typedef {import("../../types/managers.js").Registry} Registry */
/** @typedef {import("../../types/managers.js").ScanResults} ScanResults */
/** @typedef {import("../../types/scanner.js").Scanner} Scanner */
/** @typedef {import("../../types/extensions.js").BaseExpansion} BaseExpansion */
import { ImportManager } from "../../managers/ImportManager.js";
import { RegistryManager } from "../../managers/RegistryManager.js";
class ScanManagerExtension {
  static get cacheKey() {
    return "scan:results";
  }
  static get hostKey() {
    return "scanner";
  }
  static get specifier() {
    return "core.Scanner";
  }
  static async host(registry) {
    if (registry && typeof registry.has === "function" && registry.has(this.hostKey)) {
      return RegistryManager.get(registry, this.hostKey);
    }
    const ScannerClass = await ImportManager.import(registry, this.specifier);
    if (typeof ScannerClass !== "function") {
      return null;
    }
    const scanner = new ScannerClass();
    this.bind(scanner, registry);
    RegistryManager.register(registry, this.hostKey, scanner);
    return scanner;
  }
  static bind(scanner, registry) {
    if (!scanner?.extension) {
      return this;
    }
    scanner.extension.bind(scanner, registry);
    return this;
  }
  static scan(scanner, registry, rootElement) {
    if (!scanner) {
      return [];
    }
    this.bind(scanner, registry);
    return scanner.scan(rootElement);
  }
  /**
   * Hält Scan-Treffer außerhalb von `root` (Scope-Verengung).
   * Getrennte oder tote Knoten fallen raus — Compare sieht sie als `remove`.
   */
  static mergeOutside(previous, scoped, root) {
    const prior = Array.isArray(previous) ? previous : [];
    const fresh = Array.isArray(scoped) ? scoped : [];
    const merged = [];
    for (let i = 0; i < prior.length; i += 1) {
      const item = prior[i];
      const element = item && item.element;
      if (!(element instanceof HTMLElement)) {
        continue;
      }
      if (element.isConnected === false) {
        continue;
      }
      if (element === root || typeof root.contains === "function" && root.contains(element)) {
        continue;
      }
      merged.push(item);
    }
    for (let i = 0; i < fresh.length; i += 1) {
      const item = fresh[i];
      if (item && item.element instanceof HTMLElement) {
        merged.push(item);
      }
    }
    return merged;
  }
  /** Pfropft Manifest, Middleware oder Plugin auf den Scanner-Host. */
  static async expand(registry, expansion = {}) {
    const scanner = await this.host(registry);
    if (!scanner?.extension) {
      return this;
    }
    await scanner.expand(expansion);
    return this;
  }
}
export {
  ScanManagerExtension
};
