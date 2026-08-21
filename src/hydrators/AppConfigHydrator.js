/**
 * @file AppConfigHydrator.js
 * @description Hydrator zur Aufbereitung der globalen Anwendungskonfiguration.
 */

import { BaseHydrator } from "./BaseHydrator.js";

/**
 * Transformiert die rohe app-config.json.
 * 
 * @public
 * @extends {BaseHydrator}
 */
export class AppConfigHydrator extends BaseHydrator {
    /**
     * Spezifische Struktur-Transformation für die App-Config.
     * 
     * @protected
     * @static
     * @param {Object} rawData - Die rohen Config-Daten.
     * @returns {Object} Die strukturierte AppConfig.
     */
    static transform(rawData) {
        return {
            debug: Boolean(rawData.debug ?? false),
            publicPaths: {
                controllers: rawData.publicPaths?.controllers || './controllers',
                templates: rawData.publicPaths?.templates || './templates',
                events: rawData.publicPaths?.events || './events',
                manifestIndex: rawData.publicPaths?.manifestIndex || './js/aspis/core/registry-manifest.json',
                ...(rawData.publicPaths || {})
            },
            components: rawData.components || {}
        };
    }
}