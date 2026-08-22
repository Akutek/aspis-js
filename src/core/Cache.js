/**
 * @file Cache.js
 * @description Die radikal reduzierte, hochperformante Daten-Instanz des Aspis-Frameworks.
 * @module Aspis/Core/Cache
 */

/**
 * @typedef {Object} CacheConfig
 * @property {number} [ttl=0] - Standard-Lebensdauer für Einträge in Millisekunden (0 = unendlich).
 * @property {number} [maxSize=1000] - Maximale Anzahl an Elementen vor Einsetzen des Memory Guards.
 */

/**
 * @typedef {Object} CacheItem
 * @property {any} value - Der im Cache hinterlegte Wert.
 * @property {number|null} expiresAt - Exakter Ablaufzeitpunkt als Timestamp in Millisekunden (null = unendlich).
 */

/**
 * @typedef {Object} CacheMetrics
 * @property {number} size - Aktuelle Anzahl der im Speicher befindlichen Elemente.
 * @property {number} hits - Gesamtzahl erfolgreicher Cache-Treffer.
 * @property {number} misses - Gesamtzahl verfehlter Cache-Abfragen.
 * @property {number} evictions - Anzahl verdrängter Einträge durch den Memory Guard.
 * @property {number} hitRate - Trefferquote in Prozent (gerundet auf zwei Dezimalstellen).
 */

/**
 * @typedef {Object} CacheSetOptions
 * @property {number} [ttl] - Individuelle Lebensdauer in Millisekunden für diesen Schreibvorgang.
 * @property {boolean} [override=true] - Bestimmt, ob bereits existierende Schlüssel überschrieben werden dürfen.
 */

/**
 * @class Cache
 * @classdesc Verwaltet ausschließlich die Rohdaten und den direkten Speicherzugriff mit Memory-Protection,
 * streng getrennt von jeglicher Such-, Query- oder Orchestrierungs-Logik.
 */
export class Cache {
    /**
     * Der interne Speicher für alle Cache-Einträge, gekapselt durch Private Fields.
     * @internal
     * @type {Map<string, CacheItem>}
     */
    #storage = new Map();

    /**
     * Interne Telemetrie- und Leistungs-Metriken des Caches.
     * @internal
     * @type {{ hits: number, misses: number, evictions: number }}
     */
    #metrics = { hits: 0, misses: 0, evictions: 0 };

    /**
     * Die globale Cache-Konfiguration für TTL und Kapazitätsgrenzen.
     * @internal
     * @type {CacheConfig}
     */
    #config;

    /**
     * Erstellt eine neue, schlanke Cache-Instanz zur reinen Datenhaltung.
     * 
     * @public
     * @param {CacheConfig} [config={}] - Konfigurationsoptionen für TTL und maximale Größe.
     */
    constructor(config = {}) {
        this.#config = { ttl: 0, maxSize: 1000, ...config };
    }

    /**
     * Ermittelt die aktuellen Leistungs- und Telemetriedaten des Caches inklusive Trefferquote.
     * 
     * @public
     * @returns {CacheMetrics} Die aggregierten Metriken.
     */
    getMetrics() {
        const total = this.#metrics.hits + this.#metrics.misses;
        return {
            size: this.#storage.size,
            ...this.#metrics,
            hitRate: total > 0 ? Number((this.#metrics.hits / total * 100).toFixed(2)) : 0
        };
    }

    /**
     * Setzt die internen Telemetrie-Zähler (Hits, Misses, Evictions) auf Anfangswerte zurück.
     * 
     * @public
     * @returns {void}
     */
    resetMetrics() {
        this.#metrics = { hits: 0, misses: 0, evictions: 0 };
    }

    /**
     * Prüft, ob ein bestimmter Schlüssel im Cache existiert und noch nicht abgelaufen ist.
     * 
     * @public
     * @param {string} key - Der zu prüfende Schlüssel.
     * @param {CacheSetOptions} [options={}] - Optionale Parameter für den Abgleich.
     * @returns {boolean} True, wenn der Schlüssel existiert und gültig ist, ansonsten false.
     */
    has(key, options = {}) {
        const item = this.#storage.get(key);
        if (!item) return false;
        if (item.expiresAt !== null && Date.now() > item.expiresAt) {
            this.#storage.delete(key);
            return false;
        }
        return true;
    }

    /**
     * Schreibt einen Einzelwert unter einem Schlüssel in den Speicher und wendet den Memory Guard an.
     * 
     * @public
     * @param {string} key - Der eindeutige Zielschlüssel.
     * @param {any} value - Der zu speichernde Wert.
     * @param {CacheSetOptions} [options={}] - Schreiboptionen wie individuelle TTL oder Überschreibschutz.
     * @returns {void}
     */
    set(key, value, options = {}) {
        if (!key || typeof key !== 'string') return;

        if (options.override === false && this.#storage.has(key)) return;

        if (this.#config.maxSize > 0 && this.#storage.size >= this.#config.maxSize && !this.#storage.has(key)) {
            const firstKey = this.#storage.keys().next().value;
            if (firstKey !== undefined) {
                this.#storage.delete(firstKey);
                this.#metrics.evictions++;
            }
        }

        const currentTtl = options.ttl ?? this.#config.ttl;
        const expiresAt = currentTtl > 0 ? Date.now() + currentTtl : null;
        this.#storage.set(key, { value, expiresAt });
    }

    /**
     * Ruft einen einzelnen Rohwert über seinen exakten Schlüssel ab und prüft die Gültigkeit.
     * 
     * @public
     * @param {string} key - Der abzufragende Schlüssel.
     * @returns {any|null} Der gespeicherte Wert oder null bei Verfehlung/Ablauf.
     */
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

    /**
     * Gibt den gesamten internen Map-Speicher zurück und bereinigt abgelaufene Einträge im Vorfeld.
     * 
     * @public
     * @returns {Map<string, CacheItem>} Die bereinigte Rohdaten-Map.
     */
    entries() {
        const now = Date.now();
        for (const [key, item] of this.#storage.entries()) {
            if (item.expiresAt !== null && now > item.expiresAt) {
                this.#storage.delete(key);
            }
        }
        return this.#storage;
    }

    /**
     * Löscht einen spezifischen Schlüssel oder leert den gesamten Cache inklusive Metriken-Reset.
     * 
     * @public
     * @param {string|null} [key=null] - Der zu löschende Schlüssel oder null für einen Komplett-Reset.
     * @returns {void}
     */
    delete(key = null) {
        if (key === null) {
            this.#storage.clear();
            this.#metrics = { hits: 0, misses: 0, evictions: 0 };
            return;
        }

        this.#storage.delete(key);
    }
}