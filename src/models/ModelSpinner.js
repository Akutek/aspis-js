import { ModelLoader } from "./";

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
 * Modell-Klasse des Aspis-Frameworks zur Repräsentation von Ladezuständen.
 * @typedef {Object} ModelLoader
 * @property {string} message - Liefert die aktuell gesetzte Lade-Nachricht zurück.
 * @property {(msg?: any) => void} setMessage - Setzt die Lade-Nachricht.
 * @property {() => { layout: string, message: string }} toRenderData - Bereitet die Daten für das Rendering vor.
 */
/**
 * Optionsobjekt zur Initialisierung des ModelSpinner.
 * @typedef {Object} ModelSpinnerOptionsObject
 * @property {string} [message='Lade Daten...'] - Die anzuzeigende Lade-Nachricht des Spinners.
 * @property {string} [layout='spinner'] - Das zu verwendende Spinner-Template-Layout.
 */
/**
 * Erlaubte Parameter-Typen für den Konstruktor des `ModelSpinner` (Optionsobjekt oder direkter Nachrichten-String).
 * @typedef {ModelSpinnerOptionsObject | string} ModelSpinnerOptions
 */

/**
 * Spezialisierte Modell-Klasse des Aspis-Frameworks zur Repräsentation eines visuellen Ladeindikators (Spinner) mit Standard-Layout 'spinner'.
 * 
 * @public
 * @extends {ModelLoader}
 */
export class ModelSpinner extends ModelLoader {
    /**
     * Erstellt eine neue Instanz des ModelSpinner und setzt Standardwerte für Nachricht ('Lade Daten...') und Layout ('spinner').
     * 
     * @public
     * @param {ModelSpinnerOptions} [options={}] - Konfigurationsoptionen für den Spinner oder direkt die Lade-Nachricht als String.
     */
    constructor(options = {}) {
        let message = 'Lade Daten...';
        let layout = 'spinner';

        if (typeof options === 'string') {
            message = options;
        } else if (options && typeof options === 'object') {
            message = options.message || 'Lade Daten...';
            layout = options.layout || 'spinner';
        }

        super({
            layout: layout,
            message: message
        });
    }
}