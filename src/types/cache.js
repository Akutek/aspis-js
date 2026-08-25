/** Typen für Cache und CacheManager. */

/** @typedef {import("./utils.js").CacheMiddleware} CacheMiddleware */

/** @typedef {import("../core/Cache.js").Cache} Cache */

/**
 * @typedef {object} CacheConfig
 * @property {number} [ttl]
 * @property {number} [maxSize]
 */

/**
 * @typedef {object} CacheItem
 * @property {unknown} value
 * @property {number | null} expiresAt
 */

/**
 * @typedef {object} CacheMetrics
 * @property {number} size
 * @property {number} hits
 * @property {number} misses
 * @property {number} evictions
 * @property {number} hitRate
 */

/**
 * @typedef {object} CacheSetOptions
 * @property {number} [ttl]
 * @property {boolean} [override]
 */

/**
 * @typedef {object} CacheGetWithStats
 * @property {unknown} data
 * @property {CacheMetrics} stats
 */

/**
 * @typedef {object} CacheManagerOptions
 * @property {boolean} [withStats]
 * @property {number} [ttl]
 * @property {boolean} [override]
 * @property {CacheMiddleware[]} [pipeline]
 */

/**
 * @typedef {object} CacheSetContext
 * @property {CacheKey | CacheBatchMap} target
 * @property {unknown} val
 * @property {CacheManagerOptions} opts
 */

/** @typedef {string} CacheKey */

/** @typedef {Object<string, unknown>} CacheSearchPattern */

/** @typedef {CacheKey | CacheKey[] | CacheSearchPattern} CacheSelector */

/** @typedef {Object<CacheKey, unknown>} CacheBatchMap */

/** @typedef {unknown | Object<CacheKey, unknown> | CacheGetWithStats | null} CacheGetResult */

export {};
