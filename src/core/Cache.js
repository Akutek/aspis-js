/** @typedef {import("../types/cache.js").CacheConfig} CacheConfig */
/** @typedef {import("../types/cache.js").CacheItem} CacheItem */
/** @typedef {import("../types/cache.js").CacheMetrics} CacheMetrics */
/** @typedef {import("../types/cache.js").CacheSetOptions} CacheSetOptions */
class Cache {
  #storage = /* @__PURE__ */ new Map();
  #metrics = { hits: 0, misses: 0, evictions: 0 };
  #config;
  constructor(config = {}) {
    this.#config = { ttl: 0, maxSize: 1e3, ...config };
  }
  getMetrics() {
    const total = this.#metrics.hits + this.#metrics.misses;
    return {
      size: this.#storage.size,
      ...this.#metrics,
      hitRate: total > 0 ? Number((this.#metrics.hits / total * 100).toFixed(2)) : 0
    };
  }
  resetMetrics() {
    this.#metrics = { hits: 0, misses: 0, evictions: 0 };
  }
  /** Prüft, ob ein bestimmter Schlüssel im Cache existiert und noch nicht abgelaufen ist. */
  has(key, _options = {}) {
    const item = this.#storage.get(key);
    if (!item) return false;
    if (item.expiresAt !== null && Date.now() > item.expiresAt) {
      this.#storage.delete(key);
      return false;
    }
    return true;
  }
  /**
   * Schreibt einen Wert. Volle Cache-Größe verdrängt den ältesten Eintrag.
   * `override: false` lässt vorhandene Schlüssel unangetastet. TTL kommt aus den Optionen oder der Instanz.
   */
  set(key, value, options = {}) {
    if (!key || typeof key !== "string") return;
    if (options.override === false && this.#storage.has(key)) return;
    if (this.#config.maxSize > 0 && this.#storage.size >= this.#config.maxSize && !this.#storage.has(key)) {
      const firstKey = this.#storage.keys().next().value;
      if (firstKey !== void 0) {
        this.#storage.delete(firstKey);
        this.#metrics.evictions++;
      }
    }
    const currentTtl = options.ttl ?? this.#config.ttl;
    const expiresAt = currentTtl > 0 ? Date.now() + currentTtl : null;
    this.#storage.set(key, { value, expiresAt });
  }
  /** Ruft einen einzelnen Rohwert über seinen exakten Schlüssel ab und prüft die Gültigkeit. */
  get(key) {
    const item = this.#storage.get(key);
    const now = Date.now();
    if (!item) {
      this.#metrics.misses++;
      return null;
    }
    if (item.expiresAt !== null && now > item.expiresAt) {
      this.#storage.delete(key);
      this.#metrics.misses++;
      return null;
    }
    this.#metrics.hits++;
    return item.value;
  }
  /** Gibt den gesamten internen Map-Speicher zurück und bereinigt abgelaufene Einträge im Vorfeld. */
  entries() {
    const now = Date.now();
    for (const [key, item] of this.#storage.entries()) {
      if (item.expiresAt !== null && now > item.expiresAt) {
        this.#storage.delete(key);
      }
    }
    return this.#storage;
  }
  /** `key === null` leert den Cache und setzt die Metriken zurück. */
  delete(key = null) {
    if (key === null) {
      this.#storage.clear();
      this.#metrics = { hits: 0, misses: 0, evictions: 0 };
      return;
    }
    this.#storage.delete(key);
  }
}
export {
  Cache
};
