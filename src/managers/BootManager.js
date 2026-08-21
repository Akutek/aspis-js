/**
 * @file BootManager.js
 * @description Zentraler Einstiegspunkt des Frameworks.
 */

import { CacheManager} from "./CacheManager.js"
import { DebugErrorManager } from "./DebugErrorManager.js";
import { PlanManager } from "./PlanManager.js"; // Übergang von Phase 1 zu Phase 2
import { RegistryManager } from "./RegistryManager.js";
import { ScanManager } from "./ScanManager.js";

/**
 * Haupt-Bootstrapper und Routing-Knoten des Aspis-Frameworks.
 * Steuert den initialen Systemstart sequenziell.
 * 
 * @public
 */
export class BootManager {
    /**
     * Startet das Framework über die neuen Manager-Weichen in einer festen Reihenfolge.
     * 
     * @public
     * @static
     * @async
     * @param {string} [registryPath='./controllers'] - Pfad zum Controller-Verzeichnis.
     * @returns {Promise<void>}
     */
    static async boot(registryPath = './controllers') {
        try {
            DebugErrorManager.init();
            CacheManager.init();

            const registry = await RegistryManager.init(registryPath);
            const scanResults = await ScanManager.scan(registry);

            await PlanManager.plan(scanResults, registry);
        } catch (error) {
            DebugErrorManager.capture(error, "BootManager failed.");
        }
    }
}