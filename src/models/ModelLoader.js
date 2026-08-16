import { BaseModel } from "./";

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
 * Erlaubte Parameter-Typen für den Konstruktor des `ModelLoader` (Optionsobjekt oder direkter Nachrichten-String).
 * @typedef {ModelLoaderOptionsObject | string} ModelLoaderOptions
 */
/**
 * Für das Template-Rendering aufbereitete Datenstruktur des Lade-Modells.
 * @typedef {Object} ModelLoaderRenderData
 * @property {string} layout - Das zu verwendende Template-Layout.
 * @property {string} message - Die bereinigte Lade-Nachricht.
 */

/**
 * Modell-Klasse des Aspis-Frameworks zur Repräsentation von Ladezuständen (Loader/Spinner) und Lade-Nachrichten.
 * 
 * @public
 * @extends {BaseModel}
 */
export class ModelLoader extends BaseModel {
    /**
     * Die intern gespeicherte, bereinigte Lade-Nachricht.
     * @internal
     * @type {string}
     */
    #message;

    /**
     * Erstellt eine neue Instanz des ModelLoader.
     * 
     * @public
     * @param {ModelLoaderOptions} [options={}] - Konfigurationsoptionen oder direkt die Lade-Nachricht als String.
     */
    constructor(options = {}) {
        const opts = typeof options === 'string'
            ? { message: options }
            : (options && typeof options === 'object' ? options : {});

        super(opts);
        this.setMessage(opts.message);
    }

    /**
     * Liefert die aktuell gesetzte Lade-Nachricht zurück.
     * 
     * @public
     * @type {string}
     */
    get message() {
        return this.#message;
    }

    /**
     * Setzt die Lade-Nachricht, führt eine Typkonvertierung durch, wendet bei leeren Werten den Standardtext ('Lade...') an und bereinigt den String.
     * 
     * @public
     * @param {any} [msg] - Die zu setzende Nachricht (wird intern zu String konvertiert).
     * @returns {void}
     */
    setMessage(msg) {
        const str = (msg !== null && msg !== undefined) ? String(msg) : '';
        const rawMsg = str || 'Lade...';
        this.#message = this._sanitize(rawMsg);
    }

    /**
     * Bereitet die Daten des Lade-Modells für die Übergabe an das Rendering-System vor.
     * 
     * @public
     * @returns {ModelLoaderRenderData} Das Rendering-Datenobjekt mit Layout und Nachricht.
     */
    toRenderData() {
        return {
            layout: this._layout,
            message: this.#message
        };
    }
}