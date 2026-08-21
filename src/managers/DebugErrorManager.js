/**
 * @file DebugErrorManager.js
 * @description Völlig zustandsfreie, reine Routing- und Ablaufklasse für das Diagnose- und Fehlersystem des Aspis-Frameworks.
 */

import { DebugAgent } from '../agents/DebugAgent.js';
import { ErrorAgent } from '../agents/ErrorAgent.js';

/**
 * @typedef {Object} Registry
 * @property {(key: string, service: any) => void} register - Registriert einen Service in der Registry.
 * @property {(key: string) => any} get - Ruft einen Service aus der Registry ab.
 * @property {(key: string) => boolean} [has] - Prüft, ob ein Key in der Registry existiert.
 */

/**
 * @typedef {Object} Store
 * @property {() => boolean} [isDebugEnabled] - Gibt den globalen Debug-Status zurück.
 */

/**
 * @typedef {Object} CacheService
 * @property {(key: string, value: any, ttl?: number) => void} [set] - Speichert einen Wert mit optionaler TTL.
 * @property {(key: string) => any} [get] - Ruft einen Wert aus dem Cache ab.
 * @property {(key: string) => boolean} [has] - Prüft auf Existenz im Cache.
 */

/**
 * @class DebugErrorManager
 * @classdesc Reiner, zustandsloser Router und Dirigent. Besitzt keine internen Variablen oder States.
 */
export class DebugErrorManager {
    /**
     * Registriert den Manager selbst in der Registry (nimmt die Registry von außen entgegen).
     * 
     * @public
     * @static
     * @param {Registry} registry - Die globale Registry des Frameworks.
     * @returns {void}
     */
    static init(registry) {
        if (registry && typeof registry.register === 'function') {
            registry.register('DebugErrorManager', this);
        }
    }

    /**
     * Holt einen existierenden DebugAgent über die Registry/Cache oder erstellt ihn frisch.
     * 
     * @public
     * @static
     * @param {Registry} registry - Die globale Registry des Frameworks.
     * @param {string} namespace - Der Name des Kontexts (z. B. "ScanManager").
     * @returns {DebugAgent}
     */
    static getDebug(registry, namespace) {
        if (!registry || typeof registry.get !== 'function') {
            throw new Error('[Aspis][DebugErrorManager] A valid Registry instance must be provided to getDebug().');
        }

        const registryKey = `debug:${namespace}`;
        let agent = registry.get(registryKey);

        if (!agent) {
            const cache = /** @type {CacheService} */ (registry.get('CacheService'));
            if (cache && typeof cache.get === 'function' && cache.has && cache.has(registryKey)) {
                agent = cache.get(registryKey);
            }

            if (!agent) {
                agent = new DebugAgent(namespace);
                
                const store = /** @type {Store} */ (registry.get('Store'));
                if (store && typeof store.isDebugEnabled === 'function') {
                    agent.setDebugState(store.isDebugEnabled());
                }
            }

            registry.register(registryKey, agent);

            if (cache && typeof cache.set === 'function') {
                cache.set(registryKey, agent);
            }
        }

        return agent;
    }

    /**
     * Holt einen existierenden ErrorAgent über die Registry/Cache oder erstellt ihn frisch.
     * 
     * @public
     * @static
     * @param {Registry} registry - Die globale Registry des Frameworks.
     * @param {string} namespace - Der Name des Kontexts (z. B. "ScanManager").
     * @returns {ErrorAgent}
     */
    static getError(registry, namespace) {
        if (!registry || typeof registry.get !== 'function') {
            throw new Error('[Aspis][DebugErrorManager] A valid Registry instance must be provided to getError().');
        }

        const registryKey = `error:${namespace}`;
        let agent = registry.get(registryKey);

        if (!agent) {
            const cache = /** @type {CacheService} */ (registry.get('CacheService'));
            if (cache && typeof cache.get === 'function' && cache.has && cache.has(registryKey)) {
                agent = cache.get(registryKey);
            }

            if (!agent) {
                agent = new ErrorAgent(namespace);
            }

            registry.register(registryKey, agent);

            if (cache && typeof cache.set === 'function') {
                cache.set(registryKey, agent);
            }
        }

        return agent;
    }

    /**
     * Dirigiert die Ablauf-Phase (Post-Boot): Hydriert Agenten über eintreffende Modul-Manifeste.
     * 
     * @public
     * @static
     * @param {Registry} registry - Die globale Registry des Frameworks.
     * @param {string} namespace - Der Ziel-Namespace.
     * @param {Object} manifest - Das Manifest mit Pipelines und Regeln.
     * @returns {void}
     */
    static hydrateRouting(registry, namespace, manifest) {
        if (!registry || typeof registry.get !== 'function') return;

        const debugAgent = registry.get(`debug:${namespace}`);
        const errorAgent = registry.get(`error:${namespace}`);

        if (debugAgent && typeof debugAgent.hydrate === 'function' && manifest.debug) {
            debugAgent.hydrate(manifest.debug);
        }

        if (errorAgent && typeof errorAgent.hydrate === 'function' && manifest.error) {
            errorAgent.hydrate(manifest.error);
        }
    }
}