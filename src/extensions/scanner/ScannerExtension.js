/** @typedef {import("../../types/scanner.js").Scanner} Scanner */
/** @typedef {import("../../types/managers.js").ScanResults} ScanResults */
/** @typedef {import("../../types/registry.js").Registry} Registry */
import { BaseExtension } from "../BaseExtension.js";
import { ScannerDOM } from "../../utils/ScannerDOM.js";
import { DebugAgent } from "../../agents/DebugAgent.js";
import { ErrorAgent } from "../../agents/ErrorAgent.js";
import { DebugErrorManager } from "../../managers/DebugErrorManager.js";
import { RegistryManager } from "../../managers/RegistryManager.js";
import { RuntimeEnv } from "../../core/RuntimeEnv.js";
class ScannerExtension extends BaseExtension {
  static prepare(scanner) {
    super.prepare(scanner, {
      lastCount: 0,
      debug: null,
      error: null
    });
    if (scanner.manifest == null) {
      scanner.manifest = {};
    }
    return this;
  }
  static bind(scanner, registry = null) {
    if (!scanner) {
      return this;
    }
    if (!scanner.runtime) {
      this.prepare(scanner);
    }
    if (!scanner.runtime) {
      return this;
    }
    scanner.runtime.debug = this.#debugFrom(registry);
    scanner.runtime.error = this.#errorFrom(registry);
    return this;
  }
  static scan(scanner, rootElement) {
    if (!scanner) {
      return [];
    }
    if (!scanner.runtime) {
      this.prepare(scanner);
    }
    const root = rootElement ?? RuntimeEnv.body();
    if (!root) {
      DebugErrorManager.warn(
        this.#debug(scanner),
        "[ScannerExtension.scan()] Kein Root-Element, Scan abgebrochen."
      );
      return [];
    }
    try {
      const scanResults = ScannerDOM.scan(root);
      if (scanner.runtime) {
        scanner.runtime.lastCount = scanResults.length;
      }
      DebugErrorManager.info(
        this.#debug(scanner),
        `[ScannerExtension.scan()] ${scanResults.length} Controller-Knoten.`
      );
      return scanResults;
    } catch (error) {
      DebugErrorManager.capture(
        this.#error(scanner),
        error,
        "[ScannerExtension.scan()]"
      );
      return [];
    }
  }
  static #debug(scanner) {
    return scanner?.runtime?.debug || DebugAgent.shared();
  }
  static #error(scanner) {
    return scanner?.runtime?.error || ErrorAgent.shared();
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
  ScannerExtension
};
