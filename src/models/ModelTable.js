import { BaseModel } from "./BaseModel.js";

/**
 * Modell-Klasse des Aspis-Frameworks zur Repräsentation und Manipulation von Tabellendaten.
 * 
 * @public
 * @extends {BaseModel}
 */
export class ModelTable extends BaseModel {
    /**
     * Statische geschachtelte Klasse zur Repräsentation einer einzelnen Tabellenzeile.
     * 
     * @public
     * @static
     * @extends {BaseModel}
     */
    static Row = class ModelTableRow extends BaseModel {
        /**
         * Die intern gespeicherten, bereinigten Daten der Zeile.
         * @internal
         * @type {Record<string, any>}
         */
        #data = {};

        /**
         * Erstellt eine neue Instanz einer Tabellenzeile.
         * 
         * @public
         * @param {Record<string, any>} [data={}] - Die Daten der Zeile als Schlüssel-Wert-Paare.
         */
        constructor(data = {}) {
            super();
            if (data && typeof data === 'object') {
                this.#data = this._sanitize(data);
            }
        }

        /**
         * Ruft den Wert eines bestimmten Schlüssels aus den Zeilendaten ab.
         * 
         * @public
         * @param {string} key - Der Name des abzurufenden Feldes.
         * @returns {any} Der Wert des Feldes oder `undefined`, wenn der Schlüssel nicht existiert.
         */
        get(key) {
            return this.#data[key];
        }

        /**
         * Bereitet die Daten der Zeile für das Template-Rendering vor.
         * 
         * @public
         * @returns {ModelTableRowRenderData} Eine flache Kopie der internen Zeilendaten.
         */
        toRenderData() {
            return { ...this.#data };
        }

        /**
         * Prüft statisch, ob die übergebenen Daten von einer `ModelTableRow`-Instanz verarbeitet werden können.
         * 
         * @public
         * @static
         * @param {any} data - Der zu prüfende Wert.
         * @returns {boolean} `true`, wenn es sich um ein valides Objekt handelt, sonst `false`.
         */
        static canHandle(data) {
            return data && typeof data === 'object';
        }
    };

    /**
     * Alias-Referenz auf `ModelTable.Row` zur konsistenten Nutzung im Framework.
     * 
     * @public
     * @static
     * @type {typeof ModelTable.Row}
     */
    static Item = ModelTable.Row;

    /**
     * Die interne Liste aller verwalteten Zeilen-Instanzen.
     * @internal
     * @type {InstanceType<typeof ModelTable.Row>[]}
     */
    #rows = [];

    /**
     * Erstellt eine neue Instanz des ModelTable.
     * 
     * @public
     * @param {ModelTableRawData} [rawData=[]] - Die Rohdaten für die Tabelle (Array oder Objekt mit `rows`/`data`).
     * @param {ModelTableOptions} [options={}] - Konfigurationsoptionen oder direkt der Layout-Name als String.
     */
    constructor(rawData = [], options = {}) {
        const opts = typeof options === 'string' ? { layout: options } : options;
        super(opts);

        const list = Array.isArray(rawData)
            ? rawData
            : (rawData?.rows || rawData?.data || []);

        this.buildRows(list);
    }

    /**
     * Liefert eine flache Kopie des Arrays aller Tabellenzeilen zurück.
     * 
     * @public
     * @type {InstanceType<typeof ModelTable.Row>[]}
     */
    get rows() {
        return [...this.#rows];
    }

    /**
     * Baut das interne Zeilen-Array aus den übergebenen Rohdaten auf.
     * Filtert ungültige Daten heraus und konvertiert Plain Objects in `ModelTable.Row`-Instanzen.
     * 
     * @public
     * @param {Array<Record<string, any> | InstanceType<typeof ModelTable.Row>>} rawData - Array von Datenobjekten oder bereits instanziierten `ModelTable.Row`-Objekten.
     * @returns {void}
     */
    buildRows(rawData) {
        this.#rows = rawData
            .filter(data => ModelTable.Row.canHandle(data))
            .map(data => data instanceof ModelTable.Row ? data : new ModelTable.Row(data));
    }

    /**
     * Fügt eine einzelne Zeile oder ein Datenobjekt ans Ende der Tabelle an.
     * 
     * @public
     * @param {Record<string, any> | InstanceType<typeof ModelTable.Row>} data - Eine `ModelTable.Row`-Instanz oder ein entsprechendes Datenobjekt.
     * @returns {void}
     */
    appendRow(data) {
        if (data instanceof ModelTable.Row) {
            this.#rows.push(data);
        } else if (data && typeof data === 'object') {
            this.#rows.push(new ModelTable.Row(data));
        }
    }

    /**
     * Leert alle gespeicherten Zeilen aus der Tabelle.
     * 
     * @public
     * @returns {void}
     */
    clearRows() {
        this.#rows = [];
    }

    /**
     * Bereitet die Gesamtdaten der Tabelle für das Rendering-System vor.
     * 
     * @public
     * @returns {ModelTableRenderData} Das aufbereitete Datenobjekt mit Layout und Zeilen-Render-Daten.
     */
    toRenderData() {
        return {
            layout: this._layout,
            rows: this.#rows.map(row => row.toRenderData())
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
 * @property {<T>(input: T) => T} _sanitize - Sanitizes-Methode zur Bereinigung von Eingaben zur Vermeidung von XSS.
 */
/**
 * Optionsobjekt zur Initialisierung des ModelTable.
 * @typedef {Object} ModelTableOptionsObject
 * @property {string} [layout='default'] - Das zu verwendende Template-Layout der Tabelle.
 */
/**
 * Erlaubte Parameter-Typen für die Optionen des `ModelTable` (Optionsobjekt oder direkter Layout-String).
 * @typedef {ModelTableOptionsObject | string} ModelTableOptions
 */
/**
 * Struktur der Rohdaten, die an `ModelTable` übergeben werden können.
 * Can either be a array of row items directly, or an object containing a `rows` or `data` array.
 * @typedef {Array<Record<string, any> | InstanceType<typeof ModelTable.Row>> | { rows?: Array<Record<string, any> | InstanceType<typeof ModelTable.Row>>, data?: Array<Record<string, any> | InstanceType<typeof ModelTable.Row>> }} ModelTableRawData
 */
/**
 * Für das Template-Rendering aufbereitete Datenstruktur einer Tabellenzeile.
 * @typedef {Record<string, any>} ModelTableRowRenderData
 */
/**
 * Für das Template-Rendering aufbereitete Datenstruktur des Tabellen-Modells.
 * @typedef {Object} ModelTableRenderData
 * @property {string} layout - Das zu verwendende Template-Layout.
 * @property {ModelTableRowRenderData[]} rows - Die aufbereiteten Daten aller Tabellenzeilen.
 */