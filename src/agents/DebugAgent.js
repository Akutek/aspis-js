/**
 * @file DebugAgent.js
 * @description Instanziierbarer, kontextgebundener Debug- und Log-Dienst des Aspis-Frameworks.
 */

/**
 * @typedef {Object} DebugPipelinePayload
 * @property {string} type - Der Typ der Log-Nachricht ('log', 'info', 'warn').
 * @property {string} namespace - Der Ursprungskontext (z. B. Klassenname).
 * @property {string} message - Die auszugebende Hauptnachricht.
 * @property {any[]} args - Zusätzliche Parameter oder Objekte.
 */

/**
 * @typedef {Object} DebugPipeline
 * @property {(payload: DebugPipelinePayload) => void} handle - Methode zur Verarbeitung der Log-Nachricht.
 */

/**
 * @typedef {Object} DebugManifest
 * @property {DebugPipeline[]} [pipelines] - Array von Transport-Pipelines für erweiterte Log-Ziele.
 */

/**
 * @class DebugAgent
 * @classdesc Handhabt kontextbezogene Konsolen-Ausgaben, Debug-Modi und Transport-Pipelines (Pre-Boot fähig, bereit für Registry- und Cache-Zusammenspiel).
 */
export class DebugAgent {
    /**
     * @private
     * @type {string}
     */
    #namespace = "";

    /**
     * @private
     * @type {boolean|null}
     */
    #debugState = null;

    /**
     * @private
     * @type {DebugPipeline[]}
     */
    #pipelines = [];

    /**
     * @public
     * @constructor
     * @param {string} namespace - Der Name des Kontexts (z. B. "ScanManager").
     */
    constructor(namespace) {
        this.#namespace = namespace;
    }

    /**
     * Aktualisiert den globalen Debug-Status (wird später vom Store/BootManager gesteuert).
     * 
     * @public
     * @param {boolean | null} state - Der neue Debug-Zustand.
     * @returns {void}
     */
    setDebugState(state) {
        if (typeof state === 'boolean' || state === null) {
            this.#debugState = state;
        }
    }

    /**
     * Hydriert den Debug-Agenten mit manifest-gesteuerten Regeln und Transport-Pipelines (Post-Boot).
     * 
     * @public
     * @param {DebugManifest} manifest - Das Modul- oder System-Manifest für das Debugging.
     * @returns {void}
     */
    hydrate(manifest) {
        if (manifest && Array.isArray(manifest.pipelines)) {
            this.#pipelines = manifest.pipelines;
        }
    }

    /**
     * Interne Methode zur Formatierung und Weiterleitung der Konsolenausgabe.
     * 
     * @private
     * @param {string} type - Der Log-Typ ('log', 'info', 'warn').
     * @param {string} message - Die auszugebende Nachricht.
     * @param {...any} args - Zusätzliche Parameter oder Objekte.
     * @returns {void}
     */
    #emit(type, message, ...args) {
        if (this.#debugState === false) return;

        const timestamp = new Date().toISOString().split('T')[1].replace('Z', '');
        const prefix = `[Aspis][${this.#namespace}][${timestamp}]`;

        if (type === 'info') {
            console.info(`${prefix} INFO:`, message, ...args);
        } else if (type === 'warn') {
            console.warn(`${prefix} WARN:`, message, ...args);
        } else {
            console.log(`${prefix}`, message, ...args);
        }

        this.#pipelines.forEach(pipeline => {
            if (typeof pipeline.handle === 'function') {
                pipeline.handle({ type, namespace: this.#namespace, message, args });
            }
        });
    }

    /**
     * Gibt eine Standard-Debug-Meldung in der Konsole aus.
     * 
     * @public
     * @param {string} message - Die Nachricht.
     * @param {...any} args - Zusätzliche Parameter.
     * @returns {void}
     */
    log(message, ...args) {
        this.#emit('log', message, ...args);
    }

    /**
     * Gibt eine Informationsmeldung in der Konsole aus.
     * 
     * @public
     * @param {string} message - Die Nachricht.
     * @param {...any} args - Zusätzliche Parameter.
     * @returns {void}
     */
    info(message, ...args) {
        this.#emit('info', message, ...args);
    }

    /**
     * Gibt eine Warnmeldung in der Konsole aus.
     * 
     * @public
     * @param {string} message - Die Nachricht.
     * @param {...any} args - Zusätzliche Parameter.
     * @returns {void}
     */
    warn(message, ...args) {
        this.#emit('warn', message, ...args);
    }
}