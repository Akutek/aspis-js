/** @typedef {import("../types/cache.js").CacheConfig} CacheConfig */
/** @typedef {import("../types/cache.js").CacheKey} CacheKey */
/** @typedef {import("../types/cache.js").CacheSelector} CacheSelector */
/** @typedef {import("../types/cache.js").CacheBatchMap} CacheBatchMap */
/** @typedef {import("../types/cache.js").CacheGetResult} CacheGetResult */
/** @typedef {import("../types/cache.js").CacheManagerOptions} CacheManagerOptions */
/** @typedef {import("../types/utils.js").CacheMiddleware} CacheMiddleware */
import { Cache } from "../core/Cache.js";
import { CacheSearchPatternService } from "../services/CacheSearchPatternService.js";
import { CachePipelineHelper } from "../utils/CachePipelineHelper.js";
class CacheManager {
  static init(config = {}) {
    return new Cache(config);
  }
  /** Ruft Daten ab. Unterstützt Key, Array, Query-Objekte und Middleware-Pipelines. */
  static get(cacheInstance, selector, options = {}) {
    if (!cacheInstance || !selector) return null;
    const performQuery = (query) => {
      if (typeof query === "string") return cacheInstance.get(query);
      if (Array.isArray(query)) {
        const result = {};
        let found = false;
        for (const key of query) {
          const value = cacheInstance.get(key);
          if (value !== null) {
            result[key] = value;
            found = true;
          }
        }
        return found ? result : null;
      }
      if (typeof query === "object") {
        const result = {};
        let found = false;
        for (const [sKey, item] of cacheInstance.entries()) {
          if (CacheSearchPatternService.matches(item.value, query)) {
            result[sKey] = item.value;
            found = true;
          }
        }
        return found ? result : null;
      }
      return null;
    };
    const coreOp = (query) => {
      const data = performQuery(query);
      if (!options.withStats) return data;
      return { data, stats: cacheInstance.getMetrics() };
    };
    if (Array.isArray(options.pipeline) && options.pipeline.length > 0) {
      return CachePipelineHelper.create(options.pipeline, coreOp)(selector);
    }
    return coreOp(selector);
  }
  /** Schreibt Daten. Unterstützt Einzelwerte, Batch-Maps und Middleware-Pipelines. */
  static set(cacheInstance, keyOrBatch, valueOrOptions = void 0, options = {}) {
    if (!cacheInstance || !keyOrBatch) return;
    const coreOp = (ctx) => {
      const { target, val, opts } = ctx;
      if (target !== null && typeof target === "object" && !Array.isArray(target)) {
        for (const [k, v] of Object.entries(target)) cacheInstance.set(k, v, val || {});
      } else if (typeof target === "string") {
        cacheInstance.set(target, val, opts);
      }
    };
    const pipeline = options.pipeline || [];
    const context = { target: keyOrBatch, val: valueOrOptions, opts: options };
    if (pipeline.length > 0) {
      CachePipelineHelper.create(pipeline, coreOp)(context);
    } else {
      coreOp(context);
    }
  }
  /** Löscht Einträge basierend auf dem Selektor oder via Pipeline. */
  static delete(cacheInstance, selector = null, options = {}) {
    if (!cacheInstance) return;
    const coreOp = (s) => {
      if (s === null) cacheInstance.delete(null);
      else if (typeof s === "string") cacheInstance.delete(s);
      else if (Array.isArray(s)) s.forEach((k) => cacheInstance.delete(k));
      else if (typeof s === "object") {
        for (const [k, item] of cacheInstance.entries()) {
          if (CacheSearchPatternService.matches(item.value, s)) cacheInstance.delete(k);
        }
      }
    };
    const pipeline = options.pipeline || [];
    if (pipeline.length > 0) {
      CachePipelineHelper.create(pipeline, coreOp)(selector);
    } else {
      coreOp(selector);
    }
  }
}
export {
  CacheManager
};
