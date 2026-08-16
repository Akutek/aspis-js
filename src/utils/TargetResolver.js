import { LoggerService } from "../services/LoggerService.js";

/**
 * Utility-Klasse des Aspis-Frameworks zur Auflösung von DOM-Ziel-Elementen basierend auf Konfigurationsobjekten.
 * 
 * @public
 */
export class TargetResolver {
    /**
     * Löst Ziel-Elemente innerhalb eines Container-Elements anhand einer gegebenen Konfiguration auf.
     * 
     * @public
     * @static
     * @param {HTMLElement | null | undefined} container - Das übergeordnete Container-Element, in dem gesucht wird.
     * @param {TargetsConfig | null | undefined} targetsConfig - Konfigurationsobjekt mit den zu suchenden Selektoren.
     * @returns {ResolvedTargetsMap} Eine Map mit den Ziel-Namen als Schlüssel und den gefundenen HTML-Elementen als Werte.
     */
    static resolve(container, targetsConfig) {
        const resolvedTargets = new Map();
        if (!targetsConfig || !(container instanceof HTMLElement)) return resolvedTargets;

        Object.entries(targetsConfig).forEach(([targetName, config]) => {
            let element = null;

            if (config.selector === ':scope') {
                element = container;
            } else {
                element = container.querySelector(config.selector);
            }

            if (element) {
                resolvedTargets.set(targetName, element);
            } else {
                LoggerService.warn(`[TargetResolver.resolve()] Element für Selektor '${config.selector}' nicht im DOM gefunden.`);
            }
        });

        return resolvedTargets;
    }
}

/**
 * Konfiguration für ein einzelnes Ziel-Element.
 * @typedef {Object} TargetConfig
 * @property {string} selector - Der CSS-Selektor zur Elementauswahl (z. B. '.my-class' oder ':scope').
 */
/**
 * Zuordnung von Ziel-Namen zu ihren jeweiligen Selektor-Konfigurationen.
 * @typedef {Record<string, TargetConfig>} TargetsConfig
 */
/**
 * Map, die aufgelöste Ziel-Namen den entsprechenden HTML-Elementen zuordnet.
 * @typedef {Map<string, HTMLElement>} ResolvedTargetsMap
 */