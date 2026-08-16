import { BaseModel } from "./BaseModel.js";
import { ValidationService } from "../services/ValidationService.js";

/**
 * Modell-Klasse des Aspis-Frameworks zur Verwaltung von Formularzuständen,
 * Feldvalidierung und Übermittlungsstatus.
 * 
 * @public
 * @extends {BaseModel}
 */
export class ModelForm extends BaseModel {
    /**
     * Interne Map aller verwalteten Formularfelder keyed by Feldname.
     * @internal
     * @type {Map<string, FormField>}
     */
    #fields = new Map();

    /**
     * Status, ob das Formular aktuell abgesendet wird.
     * @internal
     * @type {boolean}
     */
    #isSubmitting = false;

    /**
     * Fehlermeldung des letzten Absendevorgangs oder null.
     * @internal
     * @type {string|null}
     */
    #submitError = null;

    /**
     * Status, ob der letzte Absendevorgang erfolgreich war.
     * @internal
     * @type {boolean}
     */
    #submitSuccess = false;

    /**
     * Erstellt eine neue Instanz des ModelForm.
     * 
     * @public
     * @param {InitialFieldsMap} [initialFields={}] - Initiales Objekt mit Feldkonfigurationen.
     * @param {BaseModelOptions} [options={}] - Optionen zur Initialisierung des Basismodells.
     */
    constructor(initialFields = {}, options = {}) {
        super(options);

        Object.entries(initialFields).forEach(([name, config]) => {
            this.addField(name, config.value, config.rules);
        });
    }

    /**
     * Liefert zurück, ob das Formular sich gerade im Absendevorgang befindet.
     * 
     * @public
     * @type {boolean}
     */
    get isSubmitting() { return this.#isSubmitting; }

    /**
     * Liefert die Fehlermeldung des letzten Absendevorgangs zurück oder null.
     * 
     * @public
     * @type {string|null}
     */
    get submitError() { return this.#submitError; }

    /**
     * Liefert zurück, ob das Formular erfolgreich abgesendet wurde.
     * 
     * @public
     * @type {boolean}
     */
    get submitSuccess() { return this.#submitSuccess; }

    /**
     * Prüft, ob alle Formularfelder valide sind (keine Fehler enthalten).
     * 
     * @public
     * @type {boolean}
     */
    get isValid() {
        for (const [_, field] of this.#fields) {
            if (field.error) return false;
        }
        return true;
    }

    /**
     * Prüft, ob mindestens ein Feld im Formular verändert wurde.
     * 
     * @public
     * @type {boolean}
     */
    get isDirty() {
        for (const [_, field] of this.#fields) {
            if (field.isDirty) return true;
        }
        return false;
    }

    /**
     * Fügt dem Formular ein neues Feld hinzu.
     * 
     * @public
     * @param {string} name - Der eindeutige Name des Feldes.
     * @param {any} [initialValue=''] - Der initiale Wert des Feldes.
     * @param {FormFieldRules} [rules={}] - Validierungsregeln für das Feld.
     * @returns {void}
     */
    addField(name, initialValue = '', rules = {}) {
        if (!name) return;

        const cleanVal = typeof initialValue === 'object' && initialValue !== null 
            ? this._sanitize(initialValue) 
            : String(this._sanitize(initialValue ?? ''));

        this.#fields.set(name, {
            value: cleanVal,
            initialValue: cleanVal,
            error: null,
            isTouched: false,
            isDirty: false,
            rules: rules || {}
        });
    }

    /**
     * Setzt den Wert eines Feldes, aktualisiert den Dirty-Status und führt die Validierung aus.
     * 
     * @public
     * @param {string} name - Der Name des anzupassenden Feldes.
     * @param {any} rawValue - Der neue, unbereinigte Wert.
     * @param {boolean} [markTouched=true] - Markiert das Feld als interagiert (`isTouched`).
     * @returns {void}
     */
    setFieldValue(name, rawValue, markTouched = true) {
        const field = this.#fields.get(name);
        if (!field) return;

        const value = typeof rawValue === 'object' && rawValue !== null 
            ? this._sanitize(rawValue) 
            : String(this._sanitize(rawValue ?? ''));

        field.value = value;
        field.isDirty = field.value !== field.initialValue;
        if (markTouched) field.isTouched = true;

        this.validateField(name);
    }

    /**
     * Liefert das Feldobjekt anhand des Feldnamens zurück.
     * 
     * @public
     * @param {string} name - Der Name des gesuchten Feldes.
     * @returns {FormField|null} Das Feldobjekt oder null, falls es nicht existiert.
     */
    getField(name) {
        return this.#fields.get(name) || null;
    }

    /**
     * Sammelt alle aktuellen Fehler im Formular und gibt diese als Schlüssel-Wert-Paare zurück.
     * 
     * @public
     * @returns {FormErrorsMap} Ein Objekt mit Feldnamen als Keys und den entsprechenden Fehlermeldungen.
     */
    getErrors() {
        const errors = {};
        this.#fields.forEach((field, name) => {
            if (field.error) errors[name] = field.error;
        });
        return errors;
    }

    /**
     * Validiert ein einzelnes Formularfeld über den `ValidationService` (falls verfügbar).
     * 
     * @public
     * @param {string} name - Der Name des zu validierenden Feldes.
     * @returns {boolean} `true`, wenn das Feld gültig ist, sonst `false`.
     */
    validateField(name) {
        const field = this.#fields.get(name);
        if (!field) return true;

        if (typeof ValidationService !== 'undefined') {
            field.error = ValidationService.validateField(field.value, field.rules);
        } else {
            field.error = null;
        }

        return !field.error;
    }

    /**
     * Markiert alle Felder als berührt (`isTouched`) und validiert diese.
     * 
     * @public
     * @returns {boolean} `true`, wenn das gesamte Formular gültig ist, sonst `false`.
     */
    validateAll() {
        let allValid = true;
        this.#fields.forEach((field, name) => {
            field.isTouched = true;
            const valid = this.validateField(name);
            if (!valid) allValid = false;
        });
        return allValid;
    }

    /**
     * Setzt den Absendestatus des Formulars und setzt vorherige Ergebnisse zurück.
     * 
     * @public
     * @param {any} state - Der neue Status (wird zu `boolean` konvertiert).
     * @returns {void}
     */
    setSubmitting(state) {
        this.#isSubmitting = Boolean(state);
        if (state) {
            this.#submitError = null;
            this.#submitSuccess = false;
        }
    }

    /**
     * Setzt das Ergebnis des Absendevorgangs.
     * 
     * @public
     * @param {any} success - Erfolgsstatus des Absendevorgangs (wird zu `boolean` konvertiert).
     * @param {string|null} [errorMessage=null] - Optionale Fehlermeldung bei Misserfolg.
     * @returns {void}
     */
    setSubmitResult(success, errorMessage = null) {
        this.#isSubmitting = false;
        this.#submitSuccess = Boolean(success);
        this.#submitError = errorMessage;
    }

    /**
     * Exportiert die aktuellen Feldwerte als Schlüssel-Wert-Objekt (Payload).
     * 
     * @public
     * @returns {FormPayload} Ein Objekt aller Feldnamen mit ihren aktuellen Werten.
     */
    toPayload() {
        const payload = {};
        this.#fields.forEach((field, name) => {
            payload[name] = field.value;
        });
        return payload;
    }

    /**
     * Setzt alle Felder auf ihre Initialwerte zurück und löscht Fehler- sowie Absendestatus.
     * 
     * @public
     * @returns {void}
     */
    reset() {
        this.#fields.forEach((field) => {
            field.value = field.initialValue;
            field.error = null;
            field.isTouched = false;
            field.isDirty = false;
        });
        this.#submitError = null;
        this.#submitSuccess = false;
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
 * Validierungsregeln für ein Formularfeld.
 * @typedef {Record<string, any>} FormFieldRules
 */
/**
 * Konfigurationsobjekt für die Erstellung eines Formularfeldes.
 * @typedef {Object} FormFieldConfig
 * @property {any} [value=''] - Der initiale Wert des Feldes.
 * @property {FormFieldRules} [rules={}] - Die Validierungsregeln für das Feld.
 */
/**
 * Zuordnung von Feldnamen zu ihrer jeweiligen Feldkonfiguration.
 * @typedef {Record<string, FormFieldConfig>} InitialFieldsMap
 */
/**
 * Interner Zustand eines verwalteten Formularfeldes.
 * @typedef {Object} FormField
 * @property {any} value - Der aktuelle Wert des Feldes.
 * @property {any} initialValue - Der ursprüngliche Initialwert des Feldes.
 * @property {string|null} error - Die aktuelle Fehlermeldung oder null, wenn valide.
 * @property {boolean} isTouched - Gibt an, ob das Feld vom Benutzer fokussiert/interagiert wurde.
 * @property {boolean} isDirty - Gibt an, ob sich der Wert vom Initialwert unterscheidet.
 * @property {FormFieldRules} rules - Die für das Feld definierten Validierungsregeln.
 */
/**
 * Zuordnung von Feldnamen zu ihren Fehlermeldungen.
 * @typedef {Record<string, string>} FormErrorsMap
 */
/**
 * Aufbereitetes Payload-Objekt für den Formularversand (Feldname -> Wert).
 * @typedef {Record<string, any>} FormPayload
 */