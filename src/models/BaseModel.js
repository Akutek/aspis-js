import { GuardDOM } from "../utils/GuardDOM.js";

/**
 * Abstrakte Basisklasse für Datenmodelle im Aspis-Framework.
 * Stellt Kernfunktionen zur Layoutverwaltung, Daten-Sanitisierung und Schnittstellen
 * für die Template-Aufbereitung bereit.
 * 
 * @public
 */
export class BaseModel {
    /**
     * Der Name des aktuell zugewiesenen Layout-Templates.
     * @internal
     * @type {string}
     */
    _layout = 'default';

    /**
     * Konfigurationseinstellungen des Modells.
     * @internal
     * @type {ModelOptions}
     */
    _options = {};

    /**
     * Erzeugt eine neue Instanz des BaseModel.
     * 
     * @public
     * @param {ModelOptions} [options={}] - Optionale Konfigurationsobjekte zur Initialisierung.
     */
    constructor(options = {}) {
        this._options = typeof options === 'object' && options !== null ? { ...options } : {};
        if (this._options.layout) {
            this._layout = String(this._options.layout);
        }
    }

    /**
     * Bereinigt rekursiv Strings, Arrays und Objekte, um XSS-Schwachstellen zu vermeiden.
     * Nutzt `GuardDOM.clean`, falls verfügbar, und behält DOM-Nodes unberührt.
     * 
     * @internal
     * @template T
     * @param {T} data - Die zu bereinigenden Daten (String, Array, Objekt oder primitive Werte).
     * @returns {T} Die bereinigte Datenstruktur des gleichen Typs.
     */
    _sanitize(data) {
        if (typeof data === 'string') {
            return typeof GuardDOM !== 'undefined' ? GuardDOM.clean(data) : data;
        }
        if (Array.isArray(data)) {
            return data.map(item => this._sanitize(item));
        }
        if (data !== null && typeof data === 'object' && !(data instanceof Node)) {
            const cleanObj = {};
            for (const [key, value] of Object.entries(data)) {
                cleanObj[key] = this._sanitize(value);
            }
            return cleanObj;
        }
        return data;
    }

    /**
     * Setzt das anzuwendende Layout-Template.
     * 
     * @public
     * @param {string|any} layout - Der Bezeichner des gewünschten Layouts.
     * @returns {void}
     */
    setLayout(layout) {
        this._layout = String(layout);
    }

    /**
     * Der Bezeichner des aktuell eingestellten Layouts.
     * 
     * @public
     * @type {string}
     */
    get layout() {
        return this._layout;
    }

    /**
     * Bereitet die Modelldaten für das Template-Rendering auf.
     * Muss von konkreten Unterklassen überschrieben werden.
     * 
     * @public
     * @abstract
     * @returns {ModelRenderData} Das aufbereitete Datenobjekt für den Render-Prozess.
     * @throws {Error} Wenn die abstrakte Methode nicht in der abgeleiteten Klasse implementiert wurde.
     */
    toRenderData() {
        throw new Error(`Aspis [BaseModel]: '${this.constructor.name}' muss die Methode 'toRenderData()' implementieren.`);
    }
}

/**
 * Konfigurationsoptionen für die Initialisierung von BaseModel-Instanzen.
 * @typedef {Object} ModelOptions
 * @property {string} [layout='default'] - Der Name oder Bezeichner des zu verwendenden Templates/Layouts.
 * @property {Record<string, any>} [key: string] - Beliebige weitere optionale Daten oder Konfigurationseigenschaften.
 */
/**
 * Interface für globale HTML-Bereinigungs-Utilities (GuardDOM).
 * @typedef {Object} GuardDOMInterface
 * @property {function(string): string} clean - Bereinigt einen Eingabestring von potenziell gefährlichem HTML/XSS-Code.
 */
/**
 * Generische Datenstruktur, wie sie von Unterklassen für Render-Prozesse aufbereitet wird.
 * @typedef {Record<string, any>} ModelRenderData
 */
