import { ModelLoader } from "./ModelLoader.js";

/**
 * Modell-Klasse des Aspis-Frameworks zur Repräsentation einer Fortschrittsanzeige (Loading Bar) mit prozentualem Status.
 * 
 * @public
 * @extends {ModelLoader}
 */
export class ModelLoadingBar extends ModelLoader {
    /**
     * Der interne Fortschrittswert in Prozent (begrenzt auf 0 bis 100).
     * @internal
     * @type {number}
     */
    #progress = 0;

    /**
     * Erstellt eine neue Instanz des ModelLoadingBar.
     * 
     * @public
     * @param {ModelLoadingBarOptions} [options={}] - Konfigurationsoptionen für die Fortschrittsanzeige, eine Zahl als Fortschrittswert oder ein String als Lade-Nachricht.
     */
    constructor(options = {}) {
        let progressVal = 0;
        let message = 'Lade...';
        let layout = 'bar';

        if (typeof options === 'number') {
            progressVal = options;
        } else if (typeof options === 'string') {
            message = options;
        } else if (options && typeof options === 'object') {
            progressVal = options.progress;
            message = options.message || 'Lade...';
            layout = options.layout || 'bar';
        }

        super({
            layout: layout,
            message: message
        });

        this.setProgress(progressVal);
    }

    /**
     * Liefert den aktuellen Fortschrittswert in Prozent zurück.
     * 
     * @public
     * @type {number}
     */
    get progress() {
        return this.#progress;
    }

    /**
     * Setzt den Fortschrittswert in Prozent. Konvertiert den Eingabewert zu einer Zahl und begrenzt diesen strikt auf den Bereich von 0 bis 100.
     * 
     * @public
     * @param {any} percent - Der zu setzende Fortschrittswert (wird zu `Number` konvertiert; ungültige/NaN-Werte werden auf 0 gesetzt).
     * @returns {void}
     */
    setProgress(percent) {
        const val = Number(percent);
        if (Number.isNaN(val)) {
            this.#progress = 0;
            return;
        }
        this.#progress = Math.min(100, Math.max(0, val));
    }

    /**
     * Bereitet die Daten der Fortschrittsanzeige für das Rendering-System vor.
     * 
     * @public
     * @returns {ModelLoadingBarRenderData} Das aufbereitete Datenobjekt mit Layout-, Nachrichten- und Fortschrittsdaten.
     */
    toRenderData() {
        return {
            ...super.toRenderData(),
            progress: this.#progress
        };
    }
}

/**
 * Basis-Optionen für Modelle im Aspis-Framework.
 * @typedef {Object} BaseModelOptions
 * @property {string} [layout='default'] - Das zugewiesene Template-Layout des Modells.
 */
/**
 * Basisklasse BaseModel im Aspis-Framework.
 * @typedef {Object} BaseModel
 * @property {string} _layout - Das zugewiesene Template-Layout des Modells.
 * @property {(input: string) => string} _sanitize - Sanitizes-Methode zur Bereinigung von Strings zur Vermeidung von XSS.
 */
/**
 * Optionsobjekt zur Initialisierung des ModelLoader.
 * @typedef {Object} ModelLoaderOptionsObject
 * @property {string} [message='Lade...'] - Die anzuzeigende Lade-Nachricht.
 * @property {string} [layout='default'] - Das zu verwendende Template-Layout.
 */
/**
 * Erlaubte Parameter-Typen für den Konstruktor des `ModelLoader`.
 * @typedef {ModelLoaderOptionsObject | string} ModelLoaderOptions
 */
/**
 * Für das Template-Rendering aufbereitete Datenstruktur des Lade-Modells.
 * @typedef {Object} ModelLoaderRenderData
 * @property {string} layout - Das zu verwendende Template-Layout.
 * @property {string} message - Die bereinigte Lade-Nachricht.
 */
/**
 * Modell-Klasse des Aspis-Frameworks zur Repräsentation von Ladezuständen.
 * @typedef {Object} ModelLoader
 * @property {string} message - Liefert die aktuell gesetzte Lade-Nachricht zurück.
 * @property {(msg?: any) => void} setMessage - Setzt die Lade-Nachricht.
 * @property {() => ModelLoaderRenderData} toRenderData - Bereitet die Daten für das Rendering vor.
 */
/**
 * Optionsobjekt zur Initialisierung des ModelLoadingBar.
 * @typedef {Object} ModelLoadingBarOptionsObject
 * @property {number} [progress=0] - Der anfängliche Fortschrittswert in Prozent (0–100).
 * @property {string} [message='Lade...'] - Die anzuzeigende Lade-Nachricht.
 * @property {string} [layout='bar'] - Das zu verwendende Ladebalken-Template-Layout.
 */
/**
 * Erlaubte Parameter-Typen für den Konstruktor des `ModelLoadingBar` (Optionsobjekt, direkter Nachrichten-String oder direkter Fortschrittswert als Zahl).
 * @typedef {ModelLoadingBarOptionsObject | string | number} ModelLoadingBarOptions
 */
/**
 * Für das Template-Rendering aufbereitete Datenstruktur des Ladebalken-Modells.
 * @typedef {Object} ModelLoadingBarRenderData
 * @property {string} layout - Das zu verwendende Template-Layout.
 * @property {string} message - Die bereinigte Lade-Nachricht.
 * @property {number} progress - Der aktuelle Fortschrittswert in Prozent (0–100).
 */