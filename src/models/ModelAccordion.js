import { BaseModel } from "./BaseModel.js";

/**
 * Modell-Klasse des Aspis-Frameworks zur Repräsentation und Steuerung eines Akkordeon-Steuerelements (Accordion).
 * 
 * @public
 * @extends {BaseModel}
 */
export class ModelAccordion extends BaseModel {
    /**
     * Statische geschachtelte Klasse zur Repräsentation eines einzelnen Accordion-Eintrags.
     * 
     * @public
     * @static
     * @extends {BaseModel}
     */
    static Item = class ModelAccordionItem extends BaseModel {
        /**
         * Eindeutige ID des Accordion-Elements.
         * @internal
         * @type {string}
         */
        #id;

        /**
         * Der Titel des Accordion-Elements.
         * @internal
         * @type {string}
         */
        #title;

        /**
         * Der Text/Inhalt des Accordion-Elements.
         * @internal
         * @type {string}
         */
        #content;

        /**
         * Status, ob das Element geöffnet ist.
         * @internal
         * @type {boolean}
         */
        #isOpen;

        /**
         * Status, ob das Element deaktiviert ist.
         * @internal
         * @type {boolean}
         */
        #disabled;

        /**
         * Erstellt eine neue Instanz eines Accordion-Elements.
         * 
         * @public
         * @param {ModelAccordionItemRawData} [data={}] - Die Initialisierungsdaten des Elements.
         */
        constructor(data = {}) {
            super();
            const sanitized = this._sanitize(data);

            const rawId = sanitized.id || `acc-item-${Math.random().toString(36).substring(2, 9)}`;
            this.#id = String(rawId);
            this.#title = String(sanitized.title || '');
            this.#content = String(sanitized.content || '');
            this.#isOpen = Boolean(data.isOpen);
            this.#disabled = Boolean(data.disabled);
        }

        /**
         * Liefert die ID des Elements zurück.
         * 
         * @public
         * @type {string}
         */
        get id() { return this.#id; }

        /**
         * Liefert den Titel des Elements zurück.
         * 
         * @public
         * @type {string}
         */
        get title() { return this.#title; }

        /**
         * Liefert den Inhalt des Elements zurück.
         * 
         * @public
         * @type {string}
         */
        get content() { return this.#content; }

        /**
         * Liefert den Öffnungsstatus des Elements zurück.
         * 
         * @public
         * @type {boolean}
         */
        get isOpen() { return this.#isOpen; }

        /**
         * Liefert den Deaktivierungsstatus des Elements zurück.
         * 
         * @public
         * @type {boolean}
         */
        get disabled() { return this.#disabled; }

        /**
         * Setzt den Öffnungsstatus des Elements. Bei deaktivierten Elementen erfolgt keine Änderung.
         * 
         * @public
         * @param {boolean} open - Der neue Öffnungsstatus.
         * @returns {void}
         */
        setOpen(open) {
            if (this.#disabled) return;
            this.#isOpen = Boolean(open);
        }

        /**
         * Wechselt den Öffnungsstatus des Elements (Öffnen/Schließen). Bei deaktivierten Elementen erfolgt keine Änderung.
         * 
         * @public
         * @returns {void}
         */
        toggle() {
            if (this.#disabled) return;
            this.#isOpen = !this.#isOpen;
        }

        /**
         * Bereitet die Daten des Elements für das Rendering vor.
         * 
         * @public
         * @returns {ModelAccordionItemRenderData} Objekt mit allen Render-Daten des Elements.
         */
        toRenderData() {
            return {
                id: this.#id,
                title: this.#title,
                content: this.#content,
                isOpen: this.#isOpen,
                disabled: this.#disabled
            };
        }

        /**
         * Prüft statisch, ob die übergebenen Daten von einer `ModelAccordionItem`-Instanz verarbeitet werden können.
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
     * Die interne Liste aller verwalteten Accordion-Elements.
     * @internal
     * @type {InstanceType<typeof ModelAccordion.Item>[]}
     */
    #items = [];

    /**
     * Modus-Flag: Wenn `true`, darf maximal ein Element gleichzeitig geöffnet sein.
     * @internal
     * @type {boolean}
     */
    #singleOpen = false;

    /**
     * Erstellt eine neue Instanz des ModelAccordion.
     * 
     * @public
     * @param {ModelAccordionRawData} [rawData=[]] - Die Rohdaten für das Akkordeon (Array oder Objekt mit `items`/`data`).
     * @param {ModelAccordionOptions} [options={}] - Konfigurationsoptionen oder direkt der Layout-Name als String.
     */
    constructor(rawData = [], options = {}) {
        const opts = typeof options === 'string' ? { layout: options } : options;
        super(opts);

        this.#singleOpen = Boolean(opts.singleOpen);

        const list = Array.isArray(rawData)
            ? rawData
            : (rawData?.items || rawData?.data || []);

        this.buildItems(list);
    }

    /**
     * Liefert zurück, ob der Single-Open-Modus aktiv ist.
     * 
     * @public
     * @type {boolean}
     */
    get singleOpen() { return this.#singleOpen; }

    /**
     * Liefert eine flache Kopie des Arrays aller Accordion-Elements zurück.
     * 
     * @public
     * @type {InstanceType<typeof ModelAccordion.Item>[]}
     */
    get items() { return [...this.#items]; }

    /**
     * Erstellt die interne Element-Liste aus den übergebenen Rohdaten.
     * Ungültige Daten werden gefiltert, Plain Objects in `ModelAccordion.Item`-Instanzen konvertiert.
     * 
     * @public
     * @param {Array<ModelAccordionItemRawData | InstanceType<typeof ModelAccordion.Item>>} rawData - Liste von Datenobjekten oder Instanzen.
     * @returns {void}
     */
    buildItems(rawData) {
        this.#items = rawData
            .filter(data => ModelAccordion.Item.canHandle(data))
            .map(data => data instanceof ModelAccordion.Item ? data : new ModelAccordion.Item(data));
    }

    /**
     * Sucht ein Element anhand seiner ID.
     * 
     * @public
     * @param {string} itemId - Die gesuchte Element-ID.
     * @returns {InstanceType<typeof ModelAccordion.Item>|null} Das gefundene Element oder `null`.
     */
    getItem(itemId) {
        return this.#items.find(item => item.id === itemId) || null;
    }

    /**
     * Umschaltet den Status eines Elements über dessen ID.
     * Beachtet die `singleOpen`-Regel und schließt bei Bedarf andere Elemente.
     * 
     * @public
     * @param {string} itemId - Die ID des umzuschaltenden Elements.
     * @returns {InstanceType<typeof ModelAccordion.Item>|null} Das geänderte Element oder `null`, falls es nicht existiert oder deaktiviert ist.
     */
    toggleItem(itemId) {
        const targetItem = this.getItem(itemId);
        if (!targetItem || targetItem.disabled) return null;

        const nextState = !targetItem.isOpen;

        if (this.#singleOpen && nextState) {
            this.#items.forEach(item => {
                if (item.id !== itemId) item.setOpen(false);
            });
        }

        targetItem.setOpen(nextState);
        return targetItem;
    }

    /**
     * Öffnet ein bestimmtes Element anhand seiner ID.
     * Beachtet die `singleOpen`-Regel und schließt ggf. alle anderen Elemente.
     * 
     * @public
     * @param {string} itemId - Die ID des zu öffnenden Elements.
     * @returns {void}
     */
    openItem(itemId) {
        const targetItem = this.getItem(itemId);
        if (!targetItem || targetItem.disabled) return;

        if (this.#singleOpen) {
            this.#items.forEach(item => item.setOpen(false));
        }
        targetItem.setOpen(true);
    }

    /**
     * Schließt ein bestimmtes Element anhand seiner ID.
     * 
     * @public
     * @param {string} itemId - Die ID des zu schließenden Elements.
     * @returns {void}
     */
    closeItem(itemId) {
        const targetItem = this.getItem(itemId);
        if (targetItem) {
            targetItem.setOpen(false);
        }
    }

    /**
     * Öffnet alle Elemente des Akkordeons.
     * Wird ignoriert, wenn `singleOpen` aktiv ist.
     * 
     * @public
     * @returns {void}
     */
    openAll() {
        if (this.#singleOpen) return;
        this.#items.forEach(item => item.setOpen(true));
    }

    /**
     * Schließt alle Elemente des Akkordeons.
     * 
     * @public
     * @returns {void}
     */
    closeAll() {
        this.#items.forEach(item => item.setOpen(false));
    }

    /**
     * Bereitet die Gesamtdaten des Akkordeons für das Rendering-System vor.
     * 
     * @public
     * @returns {ModelAccordionRenderData} Das aufbereitete Datenobjekt mit Layout, Konfiguration und Render-Daten aller Elemente.
     */
    toRenderData() {
        return {
            layout: this._layout,
            singleOpen: this.#singleOpen,
            items: this.#items.map(item => item.toRenderData())
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
 * Rohdaten für ein einzelnes Accordion-Element.
 * @typedef {Object} ModelAccordionItemRawData
 * @property {string} [id] - Eindeutige ID des Elements (wird automatisch generiert, wenn nicht angegeben).
 * @property {string} [title=''] - Titel/Header des Accordion-Elements.
 * @property {string} [content=''] - Inhalt des Accordion-Elements.
 * @property {boolean} [isOpen=false] - Gibt an, ob das Element initial geöffnet ist.
 * @property {boolean} [disabled=false] - Gibt an, ob das Element deaktiviert ist.
 */
/**
 * Für das Template-Rendering aufbereitete Datenstruktur eines Accordion-Elements.
 * @typedef {Object} ModelAccordionItemRenderData
 * @property {string} id - Eindeutige ID des Elements.
 * @property {string} title - Bereinigter Titel des Elements.
 * @property {string} content - Bereinigter Inhalt des Elements.
 * @property {boolean} isOpen - Öffnungsstatus des Elements.
 * @property {boolean} disabled - Deaktivierungsstatus des Elements.
 */
/**
 * Optionsobjekt zur Initialisierung des ModelAccordion.
 * @typedef {Object} ModelAccordionOptionsObject
 * @property {string} [layout='default'] - Das zu verwendende Template-Layout.
 * @property {boolean} [singleOpen=false] - Wenn true, kann jeweils nur ein Element gleichzeitig geöffnet sein.
 */
/**
 * Erlaubte Parameter-Typen für die Optionen des `ModelAccordion` (Optionsobjekt oder direkter Layout-String).
 * @typedef {ModelAccordionOptionsObject | string} ModelAccordionOptions
 */
/**
 * Struktur der Rohdaten, die an `ModelAccordion` übergeben werden können.
 * Array von Elemente-Objekten oder ein Objekt mit `items`- bzw. `data`-Array.
 * @typedef {Array<ModelAccordionItemRawData | InstanceType<typeof ModelAccordion.Item>> | { items?: Array<ModelAccordionItemRawData | InstanceType<typeof ModelAccordion.Item>>, data?: Array<ModelAccordionItemRawData | InstanceType<typeof ModelAccordion.Item>> }} ModelAccordionRawData
 */
/**
 * Für das Template-Rendering aufbereitete Datenstruktur des Accordion-Modells.
 * @typedef {Object} ModelAccordionRenderData
 * @property {string} layout - Das zu verwendende Template-Layout.
 * @property {boolean} singleOpen - Modus für Einzelanzeige geöffneter Elemente.
 * @property {ModelAccordionItemRenderData[]} items - Aufbereitete Daten aller Accordion-Elements.
 */
