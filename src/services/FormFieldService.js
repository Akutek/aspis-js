/**
 * Service-Klasse des Aspis-Frameworks zum Auslesen von Feldnamen und Werten aus DOM-Elementen
 * sowie zur Erzeugung standardisierter Formularfeld-States.
 * 
 * @public
 */
export class FormFieldService {
    /**
     * Ermittelt den logischen Namen eines DOM-Elements (basiert auf `name`, `data-name` oder `id`).
     * 
     * @public
     * @static
     * @param {Element | any} element - Das zu prüfende DOM-Element.
     * @returns {string | null} Der gefundene Name oder `null`, wenn kein Name ermittelt werden konnte.
     */
    static getFieldName(element) {
        if (!(element instanceof Element)) return null;
        return element.name || element.dataset.name || element.id || null;
    }

    /**
     * Liest den aktuellen Wert eines Formular- oder DOM-Elements aus.
     * Berücksichtigt `data-value`, Checkboxen, Radiobuttons (inkl. Gruppenprüfung im Formular) und Multiple-Selects.
     * 
     * @public
     * @static
     * @param {Element | HTMLInputElement | HTMLSelectElement | HTMLElement | any} element - Das DOM-Element, dessen Wert ausgelesen werden soll.
     * @returns {FormFieldValue} Der ausgelesene Wert oder `null`, wenn kein gültiges Element übergeben wurde.
     */
    static getValue(element) {
        if (!(element instanceof Element)) return null;

        if (element.dataset.value !== undefined) {
            return element.dataset.value;
        }

        if (element.type === 'checkbox') return element.checked;
        if (element.type === 'radio') {
            const form = element.form || element.closest('form');
            if (form && element.name) {
                const checked = form.querySelector(`input[name="${CSS.escape(element.name)}"]:checked`);
                return checked ? checked.value : '';
            }
            return element.checked ? element.value : '';
        }

        if (element.tagName === 'SELECT' && element.multiple) {
            return Array.from(element.selectedOptions).map(opt => opt.value);
        }

        return element.value ?? '';
    }

    /**
     * Erstellt ein standardisiertes State-Objekt für ein Formularfeld.
     * 
     * @public
     * @static
     * @param {FormFieldValue} [initialValue=''] - Der anfängliche Wert des Feldes.
     * @param {FieldRules} [rules={}] - Ein Objekt mit den Validierungsregeln für das Feld.
     * @returns {FieldState} Das initialisierte Feld-State-Objekt.
     */
    static createFieldState(initialValue = '', rules = {}) {
        return {
            value: initialValue,
            rules: rules,
            error: null,
            isTouched: false,
            isDirty: false
        };
    }
}

/**
 * Mögliche Typen für Werte von Formularelementen (String, Boolean, Array von Strings oder Null).
 * @typedef {string | boolean | string[] | null} FormFieldValue
 */
/**
 * Validierungsregeln für ein Formularfeld.
 * @typedef {Record<string, any>} FieldRules
 */
/**
 * Repräsentiert den vollständigen State-Zustand eines Formularfeldes.
 * @typedef {Object} FieldState
 * @property {FormFieldValue} value - Der aktuelle Wert des Feldes.
 * @property {FieldRules} rules - Die zugewiesenen Validierungsregeln.
 * @property {string | null} error - Die aktuelle Fehlermeldung oder `null`, wenn gültig.
 * @property {boolean} isTouched - Indikator, ob das Feld bereits fokussiert/verlassen wurde.
 * @property {boolean} isDirty - Indikator, ob der Wert vom Initialwert abweicht.
 */