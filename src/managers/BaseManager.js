/** @typedef {import("../types/registry.js").Registry} Registry */
/** @typedef {import("../types/cache.js").Cache} Cache */
/** @typedef {import("../types/store.js").Store} Store */
/** @typedef {import("../types/importer.js").Importer} Importer */
import { CacheManager } from "./CacheManager.js";
import { DebugErrorManager } from "./DebugErrorManager.js";
import { RegistryManager } from "./RegistryManager.js";
import { DebugAgent } from "../agents/DebugAgent.js";
import { ErrorAgent } from "../agents/ErrorAgent.js";
class BaseManager {
  static has(registry, key) {
    return Boolean(registry && typeof registry.has === "function" && registry.has(key));
  }
  static service(registry, key, fallback = null) {
    if (!this.has(registry, key)) {
      return fallback;
    }
    return RegistryManager.get(registry, key);
  }
  static cache(registry) {
    return this.service(registry, "cache");
  }
  static store(registry) {
    return this.service(registry, "store");
  }
  static importer(registry) {
    return this.service(registry, "importer");
  }
  static debug(registry) {
    return this.service(registry, "debug", DebugAgent.shared());
  }
  static error(registry) {
    return this.service(registry, "error", ErrorAgent.shared());
  }
  static cacheGet(registry, key, fallback) {
    const cache = this.cache(registry);
    if (!cache) {
      return fallback;
    }
    const stored = CacheManager.get(cache, key);
    return stored == null ? fallback : stored;
  }
  static cacheSet(registry, key, value) {
    const cache = this.cache(registry);
    if (!cache) {
      return;
    }
    CacheManager.set(cache, key, value);
  }
  static origin() {
    const className = this.name || "BaseManager";
    const stack = new Error().stack || "";
    const skip = /^(origin|tag|log|info|warn|capture|locate)$/;
    const lines = stack.split("\n");
    for (let i = 0; i < lines.length; i += 1) {
      const match = lines[i].match(/at (?:async )?([A-Za-z0-9_]+)\.([A-Za-z0-9_#]+)/);
      if (!match) {
        continue;
      }
      if (match[1] === "BaseManager" || skip.test(match[2])) {
        continue;
      }
      return { className: match[1], method: match[2] };
    }
    return { className, method: "" };
  }
  static tag(message = "") {
    const { className, method } = this.origin();
    const prefix = method ? `[${className}.${method}()]` : `[${className}]`;
    const text = typeof message === "string" ? message.trim() : String(message ?? "");
    if (!text) {
      return prefix;
    }
    if (text.startsWith("[")) {
      return text;
    }
    return `${prefix} ${text}`;
  }
  static locate(registry) {
    const { className, method } = this.origin();
    return {
      className,
      method,
      keys: {
        debug: this.has(registry, "debug"),
        error: this.has(registry, "error"),
        cache: this.has(registry, "cache"),
        store: this.has(registry, "store"),
        importer: this.has(registry, "importer")
      }
    };
  }
  static log(registry, message, ...args) {
    DebugErrorManager.log(this.debug(registry), this.tag(message), ...args);
  }
  static info(registry, message, ...args) {
    DebugErrorManager.info(this.debug(registry), this.tag(message), ...args);
  }
  static warn(registry, message, ...args) {
    DebugErrorManager.warn(this.debug(registry), this.tag(message), ...args);
  }
  static capture(registry, error, message = "") {
    DebugErrorManager.capture(this.error(registry), error, this.tag(message));
  }
}
export {
  BaseManager
};
