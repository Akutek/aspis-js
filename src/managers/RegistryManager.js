/**
 * @file RegistryManager.js
 * @description Verwaltet den Service-Container, den Store und das kaskadierte Laden von Manifesten.
 */

import { Registry } from "../core/Registry.js";
import { Store } from "../reactivity/Store.js";
import { ManifestLoaderService } from "../services/ManifestLoaderService.js";

/**
 * Manager zur Steuerung und Befüllung des Service-Containers und des Stores.
 * 
 * @public
 */
export class RegistryManager {
    /**
     * Initialisiert den Kern (Registry & Store), lädt die harte Root-Konfiguration 
     * und das kaskadierte Registry-Manifest.
     * 
     * @public
     * @static
     * @async
     * @param {string} [registryPath] - Basispfad.
     * @returns {Promise<Registry>} Der vollständig initialisierte Service-Container.
     */
    static async ini(registryPath) {
        const registry = new Registry();
        const store = new Store();

        this.regist(registry, 'store', store);

        const appConfig = await this.load('./js/aspis/core/app-config.json');
        this.regist(registry, 'config', appConfig);

        const registryManifestPath = appConfig.publicPaths?.manifestIndex;
        const registryManifest = await this.load(registryManifestPath);

        this.regist(registry, 'registryManifest', registryManifest);
        return registry;
    }

    /**
     * Registriert eine Instanz in der Registry.
     * 
     * @public
     * @static
     * @param {Registry} registry - Die Registry-Instanz.
     * @param {string} key - Der Schlüsselname.
     * @param {any} instance - Die zu registrierende Instanz.
     */
    static regist(registry, key, instance) {
        registry.set(key, instance);
    }

    /**
     * Lädt eine JSON-Ressource über den ManifestLoaderService und wendet optional einen Hydrator an.
     * 
     * @public
     * @static
     * @async
     * @param {string} path - Der Pfad zur Ressource.
     * @param {Function} [hydration=null] - Optionaler Hydrator zur Transformation der Rohdaten.
     * @returns {Promise<any>} Die geladenen (und ggf. hydratisierten) Daten.
     */
    static async load(path, hydration = null) {
        const rawData = await ManifestLoaderService.load(path);
        
        return hydration ? hydration(rawData) : rawData;
    }
}