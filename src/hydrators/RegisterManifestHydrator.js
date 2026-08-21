/**
 * @file RegistryManifestHydrator.js
 * @description Hydrator für den zentralen Registry-Manifest-Index.
 */

import { BaseHydrator } from "./BaseHydrator.js";

/**
 * Transformiert das rohe Registry-Manifest.
 * 
 * @public
 * @extends {BaseHydrator}
 */
export class RegistryManifestHydrator extends BaseHydrator {
    /**
     * Spezifische Struktur-Transformation für das Registry-Manifest.
     * 
     * @protected
     * @static
     * @param {Object} rawData - Die rohen Manifest-Daten.
     * @returns {Object} Die strukturierte Manifest-Index-Map.
     */
    static transform(rawData) {
        return {
            version: rawData.version || '1.0.0',
            indices: {
                controllers: rawData.indices?.controllers || null,
                events: rawData.indices?.events || null,
                hydrators: rawData.indices?.hydrators || null,
                ...(rawData.indices || {})
            }
        };
    }
}