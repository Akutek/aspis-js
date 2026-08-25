/** @typedef {import("../types/managers.js").Registry} Registry */
/** @typedef {import("../types/managers.js").ScanResults} ScanResults */
/** @typedef {import("../types/extensions.js").BaseExpansion} BaseExpansion */
import { BaseManager } from "./BaseManager.js";
import { ScanManagerExtension } from "../extensions/scan/ScanManagerExtension.js";
import { RuntimeEnv } from "../core/RuntimeEnv.js";
class ScanManager extends BaseManager {
  static get extension() {
    return ScanManagerExtension;
  }
  static get cacheKey() {
    return this.extension.cacheKey;
  }
  static get scannerSpecifier() {
    return this.extension.specifier;
  }
  static async scan(registry, rootElement) {
    try {
      const hadHost = this.has(registry, this.extension.hostKey);
      const scanner = await this.extension.host(registry);
      if (!scanner) {
        this.warn(registry, "Scanner nicht geladen.");
        return [];
      }
      if (!hadHost) {
        this.info(registry, "Scanner \xFCber Importer geladen.");
      }
      const root = rootElement ?? RuntimeEnv.documentElement();
      if (!root) {
        this.warn(registry, "Kein Root-Element, Scan abgebrochen.");
        return [];
      }
      const previous = this.last(registry);
      const scanResults = this.extension.scan(scanner, registry, root);
      const fullRoot = RuntimeEnv.documentElement();
      const merged = fullRoot && root !== fullRoot ? this.extension.mergeOutside(previous, scanResults, root) : scanResults;
      this.cacheSet(registry, this.cacheKey, merged);
      this.info(
        registry,
        root === fullRoot ? `${merged.length} Controller-Knoten.` : `${merged.length} Controller-Knoten (Scope ${scanResults.length}, rest ${merged.length - scanResults.length}).`
      );
      return merged;
    } catch (error) {
      this.capture(registry, error);
      return [];
    }
  }
  static last(registry) {
    const stored = this.cacheGet(registry, this.cacheKey, []);
    return Array.isArray(stored) ? stored : [];
  }
  static async expand(registry, expansion = {}) {
    try {
      return await this.extension.expand(registry, expansion);
    } catch (error) {
      this.capture(registry, error);
      return this.extension;
    }
  }
}
export {
  ScanManager
};
