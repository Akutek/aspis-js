import { BaseModel } from "./BaseModel.js";
import { FormFieldService } from "../services/FormFieldService.js";
import { ValidationService } from "../services/ValidationService.js";

/**
 * Modell-Klasse des Aspis-Frameworks zur Repräsentation und Steuerung eines benutzerdefinierten Dropdown-Steuerelements mit Tastaturnavigation und Validierung.
 * 
 * @public
 * @extends {BaseModel}
 */
export class ModelCustomDropdown extends BaseModel {
    /**
     * Statische geschachtelte Klasse zur Repräsentation eines einzelnen Dropdown-Eintrags.
     * 
     * @public
     * @static
     */
    static Item = class ModelCustomDropdownItem {
        /**
         * Der bereinigte Wert des Eintrags.
         * @internal
         * @type {string}
         */
        #value;

        /**
         * Die bereinigte Anzeigebezeichnung des Eintrags.
         * @internal
         * @type {string}
         */
        #label;

        /**
         * Deaktivierungsstatus des Eintrags.
         * @internal
         * @type {boolean}
         */
        #disabled;

        /**
         * Erstellt eine neue Instanz eines Dropdown-Eintrags.
         * 
         * @public
         * @param {ModelCustomDropdownItemRawData} [data={}] - Rohdaten des Eintrags.
         * @param {SanitizeFunction} [sanitizeFn=(v) => String(v ?? '')] - Funktion zur Bereinigung von Strings.
         */
        constructor(data = {}, sanitizeFn = (v) => String(v ?? '')) {
            const rawVal = data.value ?? data.id ?? '';
            const rawLabel = data.label ?? data.title ?? String(rawVal);
            
            this.#value = sanitizeFn(rawVal);
            this.#label = sanitizeFn(rawLabel);
            this.#disabled = Boolean(data.disabled);
        }

        /**
         * Liefert den Wert des Eintrags zurück.
         * 
         * @public
         * @type {string}
         */
        get value() { return this.#value; }

        /**
         * Liefert die Anzeigebezeichnung des Eintrags zurück.
         * 
         * @public
         * @type {string}
         */
        get label() { return this.#label; }

        /**
         * Liefert den Deaktivierungsstatus des Eintrags zurück.
         * 
         * @public
         * @type {boolean}
         */
        get disabled() { return this.#disabled; }

        /**
         * Bereitet die Daten des Eintrags für das Rendering-System vor.
         * 
         * @public
         * @param {boolean} [isSelected=false] - Kennzeichnung, ob der Eintrag ausgewählt ist.
         * @param {boolean} [isFocused=false] - Kennzeichnung, ob der Eintrag fokussiert ist.
         * @returns {ModelCustomDropdownItemRenderData} Das aufbereitete Render-Datenobjekt des Eintrags.
         */
        toRenderData(isSelected = false, isFocused = false) {
            return {
                value: this.#value,
                label: this.#label,
                disabled: this.#disabled,
                isSelected,
                isFocused
            };
        }
    };

    /**
     * Die interne Liste aller verwalteten Dropdown-Einträge.
     * @internal
     * @type {InstanceType<typeof ModelCustomDropdown.Item>[]}
     */
    #items = [];

    /**
     * Der Index des aktuell ausgewählten Eintrags (-1 falls keiner).
     * @internal
     * @type {number}
     */
    #selectedIndex = -1;

    /**
     * Der Index des aktuell fokussierten Eintrags (-1 falls keiner).
     * @internal
     * @type {number}
     */
    #focusedIndex = -1;

    /**
     * Status, ob das Dropdown-Menü aktuell geöffnet ist.
     * @internal
     * @type {boolean}
     */
    #isOpen = false;

    /**
     * Der interne Feldzustand (Wert, Validierungsregeln, Fehlerzustand).
     * @internal
     * @type {CustomDropdownFieldState}
     */
    #fieldState;

    /**
     * Erstellt eine neue Instanz des ModelCustomDropdown.
     * 
     * @public
     * @param {ModelCustomDropdownRawData} [rawData=[]] - Optionseinträge (Array oder Objekt mit `options`/`data`).
     * @param {ModelCustomDropdownOptions} [options={}] - Konfigurationsoptionen oder direkt der Layout-Name als String.
     */
    constructor(rawData = [], options = {}) {
        const opts = typeof options === 'string' ? { layout: options } : options;
        super(opts);

        if (typeof FormFieldService !== 'undefined' && typeof FormFieldService.createFieldState === 'function') {
            this.#fieldState = FormFieldService.createFieldState(opts.value || '', opts.rules || {});
        } else {
            this.#fieldState = {
                value: this._sanitize(opts.value || ''),
                rules: opts.rules || {},
                error: null,
                isTouched: false
            };
        }

        this.setOptions(rawData);

        if (opts.value !== undefined) {
            this.selectByValue(opts.value, false);
        }
    }

    /**
     * Liefert zurück, ob das Dropdown-Menü geöffnet ist.
     * 
     * @public
     * @type {boolean}
     */
    get isOpen() { return this.#isOpen; }

    /**
     * Liefert den Index des aktuell fokussierten Eintrags zurück.
     * 
     * @public
     * @type {number}
     */
    get focusedIndex() { return this.#focusedIndex; }

    /**
     * Liefert den Index des aktuell ausgewählten Eintrags zurück.
     * 
     * @public
     * @type {number}
     */
    get selectedIndex() { return this.#selectedIndex; }

    /**
     * Liefert den aktuell ausgewählten Dropdown-Eintrag zurück oder null.
     * 
     * @public
     * @type {InstanceType<typeof ModelCustomDropdown.Item>|null}
     */
    get selectedItem() { return this.#items[this.#selectedIndex] || null; }

    /**
     * Liefert den aktuell gewählten Wert des Feldzustands zurück.
     * 
     * @public
     * @type {string}
     */
    get value() { return this.#fieldState.value; }

    /**
     * Liefert die aktuelle Fehlermeldung des Feldzustands zurück.
     * 
     * @public
     * @type {string|null}
     */
    get error() { return this.#fieldState.error; }

    /**
     * Aktualisiert die Optionseinträge des Dropdowns und synchronisiert Selektion sowie Fokus.
     * 
     * @public
     * @param {ModelCustomDropdownRawData} [rawData=[]] - Die neuen Optionseinträge.
     * @returns {void}
     */
    setOptions(rawData = []) {
        const list = Array.isArray(rawData) ? rawData : (rawData?.options || rawData?.data || []);
        const sanitizeFn = (val) => this._sanitize(val);
        
        this.#items = list.map(item => item instanceof ModelCustomDropdown.Item ? item : new ModelCustomDropdown.Item(item, sanitizeFn));
        this.#selectedIndex = this.#items.findIndex(item => item.value === this.#fieldState.value);
        this.#focusedIndex = this.#selectedIndex >= 0 ? this.#selectedIndex : 0;
    }

    /**
     * Setzt den Öffnungsstatus des Dropdowns. Setzt den Fokus bei Öffnen auf die aktuelle Selektion.
     * 
     * @public
     * @param {any} open - Der neue Öffnungsstatus (wird zu `boolean` konvertiert).
     * @returns {void}
     */
    setOpen(open) {
        this.#isOpen = Boolean(open);
        if (this.#isOpen) {
            this.#focusedIndex = this.#selectedIndex >= 0 ? this.#selectedIndex : 0;
        }
    }

    /**
     * Wählt einen Eintrag anhand seines Wertes aus und aktualisiert Zustand und Fokus.
     * 
     * @public
     * @param {any} val - Der auszuwählende Wert.
     * @param {boolean} [triggerValidation=true] - Gibt an, ob im Anschluss die Validierung ausgeführt werden soll.
     * @returns {boolean} `true`, wenn ein passender (nicht deaktivierter) Eintrag gefunden und gesetzt wurde oder ein leerer String zurückgesetzt wurde, sonst `false`.
     */
    selectByValue(val, triggerValidation = true) {
        const sanitizedVal = this._sanitize(val);
        const index = this.#items.findIndex(item => item.value === sanitizedVal && !item.disabled);
        
        if (index === -1 && sanitizedVal !== '') return false;

        this.#selectedIndex = index;
        this.#focusedIndex = index >= 0 ? index : 0;
        this.#fieldState.value = index >= 0 ? this.#items[index].value : '';
        this.#fieldState.isTouched = true;

        if (triggerValidation) {
            this.validate();
        }
        return true;
    }

    /**
     * Verschiebt den Fokus innerhalb der Liste in eine Richtung unter Übergehung deaktivierter Einträge.
     * 
     * @public
     * @param {number} direction - Schrittweite und Richtung (z. B. `1` für abwärts, `-1` für aufwärts).
     * @returns {void}
     */
    moveFocus(direction) {
        if (this.#items.length === 0) return;
        let next = this.#focusedIndex + direction;

        while (next >= 0 && next < this.#items.length && this.#items[next].disabled) {
            next += direction;
        }

        if (next >= 0 && next < this.#items.length) {
            this.#focusedIndex = next;
        }
    }

    /**
     * Wählt den aktuell fokussierten Eintrag aus, falls dieser nicht deaktiviert ist.
     * 
     * @public
     * @returns {boolean} `true`, wenn der fokussierte Eintrag erfolgreich ausgewählt wurde, sonst `false`.
     */
    selectFocused() {
        if (this.#focusedIndex >= 0 && this.#focusedIndex < this.#items.length) {
            const item = this.#items[this.#focusedIndex];
            if (!item.disabled) {
                return this.selectByValue(item.value);
            }
        }
        return false;
    }

    /**
     * Führt die Validierung des aktuellen Feldwerts über den `ValidationService` aus (falls verfügbar).
     * 
     * @public
     * @returns {boolean} `true`, wenn der Feldwert gültig ist, sonst `false`.
     */
    validate() {
        if (typeof ValidationService !== 'undefined') {
            this.#fieldState.error = ValidationService.validateField(
                this.#fieldState.value, 
                this.#fieldState.rules
            );
        } else {
            this.#fieldState.error = null;
        }
        return !this.#fieldState.error;
    }

    /**
     * Bereitet die Gesamtdaten des Dropdowns für das Rendering-System vor.
     * 
     * @public
     * @returns {ModelCustomDropdownRenderData} Das aufbereitete Datenobjekt mit Layout, Zuständen und allen Optionen.
     */
    toRenderData() {
        return {
            layout: this._layout,
            isOpen: this.#isOpen,
            value: this.#fieldState.value,
            selectedLabel: this.selectedItem ? this.selectedItem.label : 'Bitte wählen...',
            error: this.#fieldState.error,
            isInvalid: Boolean(this.#fieldState.error),
            options: this.#items.map((item, idx) => 
                item.toRenderData(idx === this.#selectedIndex, idx === this.#focusedIndex)
            )
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
 * Rohdaten zur Erstellung eines Dropdown-Eintrags.
 * @typedef {Object} ModelCustomDropdownItemRawData
 * @property {string} [value] - Der Wert des Eintrags.
 * @property {string} [id] - Alternative Schlüsselbezeichnung für den Wert des Eintrags.
 * @property {string} [label] - Die Bezeichnung/Anzeigetext des Eintrags.
 * @property {string} [title] - Alternative Schlüsselbezeichnung für die Bezeichnung des Eintrags.
 * @property {boolean} [disabled=false] - Gibt an, ob der Eintrag deaktiviert ist.
 */
/**
 * Funktion zur Bereinigung/Sanitizing von Strings.
 * @typedef {(val: any) => string} SanitizeFunction
 */
/**
 * Für das Template-Rendering aufbereitete Datenstruktur eines Dropdown-Eintrags.
 * @typedef {Object} ModelCustomDropdownItemRenderData
 * @property {string} value - Der bereinigte Wert des Eintrags.
 * @property {string} label - Die bereinigte Anzeigebezeichnung des Eintrags.
 * @property {boolean} disabled - Deaktivierungsstatus des Eintrags.
 * @property {boolean} isSelected - Gibt an, ob der Eintrag aktuell ausgewählt ist.
 * @property {boolean} isFocused - Gibt an, ob der Eintrag aktuell den Fokus besitzt.
 */
/**
 * Validierungsregeln für das Dropdown-Feld.
 * @typedef {Record<string, any>} CustomDropdownRules
 */
/**
 * Zustandsobjekt eines Formularfeldes im Dropdown.
 * @typedef {Object} CustomDropdownFieldState
 * @property {string} value - Der aktuelle Wert des Feldes.
 * @property {CustomDropdownRules} rules - Die definierten Validierungsregeln.
 * @property {string|null} error - Fehlermeldung oder null, wenn valide.
 * @property {boolean} isTouched - Gibt an, ob der Benutzer mit dem Feld interagiert hat.
 */
/**
 * Optionsobjekt zur Initialisierung des ModelCustomDropdown.
 * @typedef {Object} ModelCustomDropdownOptionsObject
 * @property {string} [layout='default'] - Das zu verwendende Template-Layout.
 * @property {string} [value=''] - Der initial ausgewählte Wert.
 * @property {CustomDropdownRules} [rules={}] - Validierungsregeln für das Feld.
 */
/**
 * Erlaubte Parameter-Typen für die Optionen des `ModelCustomDropdown` (Optionsobjekt oder direkter Layout-String).
 * @typedef {ModelCustomDropdownOptionsObject | string} ModelCustomDropdownOptions
 */
/**
 * Struktur der Rohdaten für die Optionen des Dropdowns.
 * Array von Elemente-Objekten/Instanzen oder ein Objekt mit `options`- bzw. `data`-Array.
 * @typedef {Array<ModelCustomDropdownItemRawData | InstanceType<typeof ModelCustomDropdown.Item>> | { options?: Array<ModelCustomDropdownItemRawData | InstanceType<typeof ModelCustomDropdown.Item>>, data?: Array<ModelCustomDropdownItemRawData | InstanceType<typeof ModelCustomDropdown.Item>> }} ModelCustomDropdownRawData
 */
/**
 * Für das Template-Rendering aufbereitete Datenstruktur des Dropdown-Modells.
 * @typedef {Object} ModelCustomDropdownRenderData
 * @property {string} layout - Das zu verwendende Template-Layout.
 * @property {boolean} isOpen - Öffnungsstatus des Menüs.
 * @property {string} value - Der aktuell ausgewählte Wert.
 * @property {string} selectedLabel - Bezeichnung des ausgewählten Eintrags oder Standardtext.
 * @property {string|null} error - Aktuelle Fehlermeldung oder null.
 * @property {boolean} isInvalid - Gibt an, ob ein Validierungsfehler vorliegt.
 * @property {ModelCustomDropdownItemRenderData[]} options - Liste aller aufbereiteten Optionen.
 */