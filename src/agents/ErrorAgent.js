/**
 * @file ErrorAgent.js
 * @description Instanziierbarer, kontextgebundener Fehler- und Abbruch-Dienst des Aspis-Frameworks.
 */

/**
 * @typedef {Object} ErrorPipelinePayload
 * @property {string} type - Der Typ der Pipeline-Nachricht (immer 'error').
 * @property {string} namespace - Der Ursprungskontext (z. B. Klassenname).
 * @property {string} message - Die auszugebende Hauptfehlermeldung.
 * @property {any[]} args - Zusätzliche Parameter oder Fehlerobjekte.
 */

/**
 * @typedef {Object} ErrorPipeline
 * @property {(payload: ErrorPipelinePayload) => void} handle - Methode zur Verarbeitung des Fehlers.
 */

/**
 * @typedef {Object} ErrorManifest
 * @property {ErrorPipeline[]} [pipelines] - Array von Transport-Pipelines für Telemetrie.
 */

/**
 * @class ErrorAgent
 * @classdesc Handhabt kritische Konsolenfehler und wirft kontrollierte Laufzeitfehler mit präzisem Kontext (Pre-Boot fähig, bereit für Registry- und Cache-Zusammenspiel).
 */
export class ErrorAgent {
    /**
     * @private
     * @type {string}
     */
    #namespace = "";

    /**
     * @private
     * @type {ErrorPipeline[]}
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
     * Hydriert den Error-Agenten mit manifest-gesteuerten Regeln und Fehler-Pipelines (Post-Boot).
     * 
     * @public
     * @param {ErrorManifest} manifest - Das Modul- oder System-Manifest für die Fehlerbehandlung.
     * @returns {void}
     */
    hydrate(manifest) {
        if (manifest && Array.isArray(manifest.pipelines)) {
            this.#pipelines = manifest.pipelines;
        }
    }

    /**
     * Interne Methode zur Formatierung der Konsolenausgabe.
     * 
     * @private
     * @param {string} message - Die Fehlermeldung.
     * @param {...any} args - Zusätzliche Fehlerobjekte oder Kontextdaten.
     * @returns {string} Der voll formatierte Fehlerstring.
     */
    #format(message, ...args) {
        const timestamp = new Date().toISOString().split('T')[1].replace('Z', '');
        return `[Aspis Error][${this.#namespace}][${timestamp}] ${message}`;
    }

    /**
     * Gibt eine kritische Fehlermeldung in der Konsole aus, ohne die Applikation zu blockieren.
     * 
     * @public
     * @param {string} message - Die Fehlermeldung.
     * @param {...any} args - Zusätzliche Parameter.
     * @returns {void}
     */
    error(message, ...args) {
        const formattedMessage = this.#format(message);
        console.error(formattedMessage, ...args);

        this.#pipelines.forEach(pipeline => {
            if (typeof pipeline.handle === 'function') {
                pipeline.handle({ type: 'error', namespace: this.#namespace, message, args });
            }
        });
    }

    /**
     * Wirft einen echten, kontrollierten Systemfehler inkl. Kontext und bricht die Ausführung hart ab.
     * 
     * @public
     * @param {string} message - Die Fehlermeldung für den Abbruch.
     * @param {...any} args - Zusätzliche Parameter.
     * @throws {Error}
     */
    throw(message, ...args) {
        const formattedMessage = this.#format(message);
        
        this.error(message, ...args);

        const error = new Error(formattedMessage);
        throw error;
    }
}