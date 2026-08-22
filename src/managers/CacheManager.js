/**
 * @file CacheManager.js
 * @description Zustandsloser Orchestrator für Cache-Operationen. Verknüpft Cache, Suchmuster-Service und Middleware-Pipelines.
 * @module Aspis/Core/CacheManager
 */

import { Cache } from './Cache.js';
import { CacheSearchPatternService } from './CacheSearchPatternService.js';
import { CachePipeline } from './CachePipeline.js';

/**
 * @typedef {import('./Cache.js').CacheConfig} CacheConfig
 */

/**
 * @typedef {Object} CacheManagerOptions
 * @property {boolean} [withStats=false] - Gibt an, ob Leistungs-Metriken im Ergebnis enthalten sein sollen.
 * @property {number} [ttl] - Individuelle Lebensdauer in Millisekunden.
 * @property {boolean} [override=true] - Bestimmt, ob bereits existierende Schlüssel überschrieben werden dürfen.
 * @property {Function[]} [pipeline=[]] - Eine Kette von Middleware-Funktionen zur Verarbeitung.
 */

/**
 * @class CacheManager
 * @classdesc Zustandslose Klasse, die den Datenfluss zwischen Cache-Instanz, Pipeline-Logik und Suchmustern steuert.
 */
export class CacheManager {
    /**
     * Initialisiert und erzeugt eine neue, konfiguriert instanziierte Cache-Instanz.
     * 
     * @public
     * @static
     * @param {CacheConfig} [config={}] - Konfigurationsoptionen für die Cache-Instanz.
     * @returns {Cache} Die neu erstellte Cache-Instanz.
     */
    static ini(config = {}) {
        return new Cache(config);
    }

    /**
     * Ruft Daten ab. Unterstützt Key, Array, Query-Objekte und Middleware-Pipelines.
     * 
     * @public
     * @static
     * @param {Cache} cacheInstance - Die zu nutzende Cache-Instanz.
     * @param {string|string[]|Object<string, any>} selector - Exakter Schlüssel, Array oder Suchmuster.
     * @param {CacheManagerOptions} [options={}] - Optionen inklusive optionaler Pipeline.
     * @returns {any|Object<string, any>|null}
     */
    static get(cacheInstance, selector, options = {}) {
        if (!cacheInstance || !selector) return null;

        const performQuery = (query) => {
            if (typeof query === 'string') return cacheInstance.get(query);

            if (Array.isArray(query)) {
                const result = {};
                let found = false;
                for (const key of query) {
                    const value = cacheInstance.get(key);
                    if (value !== null) { result[key] = value; found = true; }
                }
                return found ? result : null;
            }

            if (typeof query === 'object') {
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
            return CachePipeline.create(options.pipeline, coreOp)(selector);
        }

        return coreOp(selector);
    }

    /**
     * Schreibt Daten. Unterstützt Einzelwerte, Batch-Maps und Middleware-Pipelines.
     * 
     * @public
     * @static
     * @param {Cache} cacheInstance - Die zu nutzende Cache-Instanz.
     * @param {string|Object<string, any>} keyOrBatch - Schlüssel oder Map.
     * @param {any|CacheManagerOptions} [valueOrOptions] - Wert oder Batch-Optionen.
     * @param {CacheManagerOptions} [options={}] - Optionen.
     * @returns {void}
     */
    static set(cacheInstance, keyOrBatch, valueOrOptions = undefined, options = {}) {
        if (!cacheInstance || !keyOrBatch) return;

        const coreOp = (ctx) => {
            const { target, val, opts } = ctx;
            if (typeof target === 'object') {
                for (const [k, v] of Object.entries(target)) cacheInstance.set(k, v, val || {});
            } else {
                cacheInstance.set(target, val, opts);
            }
        };

        const pipeline = options.pipeline || [];
        const context = { target: keyOrBatch, val: valueOrOptions, opts: options };

        if (pipeline.length > 0) {
            CachePipeline.create(pipeline, coreOp)(context);
        } else {
            coreOp(context);
        }
    }

    /**
     * Löscht Einträge basierend auf dem Selektor oder via Pipeline.
     * 
     * @public
     * @static
     * @param {Cache} cacheInstance - Die zu nutzende Cache-Instanz.
     * @param {string|string[]|Object<string, any>|null} [selector=null] - Zu löschendes Ziel.
     * @param {CacheManagerOptions} [options={}] - Optionen inklusive Pipeline.
     * @returns {void}
     */
    static delete(cacheInstance, selector = null, options = {}) {
        if (!cacheInstance) return;

        const coreOp = (s) => {
            if (s === null) cacheInstance.delete(null);
            else if (typeof s === 'string') cacheInstance.delete(s);
            else if (Array.isArray(s)) s.forEach(k => cacheInstance.delete(k));
            else if (typeof s === 'object') {
                for (const [k, item] of cacheInstance.entries()) {
                    if (CacheSearchPatternService.matches(item.value, s)) cacheInstance.delete(k);
                }
            }
        };

        const pipeline = options.pipeline || [];
        if (pipeline.length > 0) {
            CachePipeline.create(pipeline, coreOp)(selector);
        } else {
            coreOp(selector);
        }
    }
}