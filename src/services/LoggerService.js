/**
 * Zentraler Logging-Dienst des Aspis-Frameworks.
 * Kapselt Konsolen-Ausgaben (`console.log`, `console.warn`, `console.error`) und steuert
 * deren Ausführung basierend auf dem globalen Debug-Status der Anwendung.
 * 
 * @public
 * @class
 */
export class LoggerService {
    /**
     * Interner Speicher für den aktuellen Debug-Zustand des Frameworks.
     * Starts im Sicherheitsmodus (`null`), um Bootstrapping-Fehler vor dem Einlesen der Configs nicht zu verschlucken.
     * 
     * @internal
     * @static
     * @type {DebugState}
     * @default null
     */
    static #debug = null;

    /**
     * Initialisiert den LoggerService mit dem Debug-Status aus den Anwendungseinstellungen.
     * 
     * @public
     * @static
     * @param {boolean | null | undefined} debugState - Der auszulesende Debug-Status.
     * @returns {void}
     */
    static init(debugState) {
        if (typeof debugState === 'boolean') {
            this.#debug = debugState;
        }
    }

    /**
     * Gibt eine Standard-Debug-Information in der Konsole aus, sofern der Debug-Modus aktiv ist oder im Preboot-Zustand läuft.
     * 
     * @public
     * @static
     * @param {string} message - Die auszugebende Hauptnachricht.
     * @param {...LogArguments} args - Beliebige Zusatzargumente (Objekte, Parameter) zur Ausgabe.
     * @returns {void}
     */
    static debug(message, ...args) {
        if (this.#debug === false) return;
        console.log(`[Aspis] ${message}`, ...args);
    }

    /**
     * Gibt eine Informationsmeldung in der Konsole aus, sofern der Debug-Modus nicht explizit deaktiviert wurde.
     * 
     * @public
     * @static
     * @param {string} message - Die auszugebende Informationsnachricht.
     * @param {...LogArguments} args - Beliebige Zusatzargumente zur Ausgabe.
     * @returns {void}
     */
    static info(message, ...args) {
        if (this.#debug === false) return;
        console.info(`[Aspis] ${message}`, ...args);
    }
    
    /**
     * Gibt eine Warnmeldung in der Konsole aus, sofern der Debug-Modus nicht explizit deaktiviert wurde.
     * 
     * @public
     * @static
     * @param {string} message - Die auszugebende Warnnachricht.
     * @param {...LogArguments} args - Beliebige Zusatzargumente zur Ausgabe.
     * @returns {void}
     */
    static warn(message, ...args) {
        if (this.#debug === false) return;
        console.warn(`[Aspis] ${message}`, ...args);
    }

    /**
     * Gibt eine kritische Fehlermeldung in der Konsole aus.
     * Wird ununterbrochen und unabhängig vom Debug-Status IMMER ausgegeben.
     * 
     * @public
     * @static
     * @param {string} message - Die auszugebende Fehlermeldung.
     * @param {...LogArguments} args - Beliebige Zusatzargumente (z. B. Error-Objekte oder Kontextdaten) zur Ausgabe.
     * @returns {void}
     */
    static error(message, ...args) {
        console.error(`[Aspis Error] ${message}`, ...args);
    }
}

/**
 * Der aktuelle Status des Debug-Modus im LoggerService.
 * `null` entspricht dem Preboot-/Sicherheitsmodus (Ausführung erlaubt), `true` aktiviert
 * und `false` deaktiviert reguläre Debug- und Warnmeldungen.
 * 
 * @typedef {boolean | null} DebugState
 */
/**
 * Beliebige zusätzliche Parameter oder Objekte, die an die Log-Methoden übergeben werden.
 * 
 * @typedef {any[]} LogArguments
 */