/**
 * Validator-Funktion zur Überprüfung eines Wertes.
 * @typedef {(value: any, param?: any) => boolean} ValidationRuleFn
 */
/**
 * Objektstruktur für eine erweiterte Regel-Konfiguration.
 * @typedef {Object} RuleConfigObject
 * @property {any} [param] - Der Parameter für die Regel (z. B. Mindestlänge oder Regex-Muster).
 * @property {string} [message] - Die benutzerdefinierte Fehlermeldung.
 */
/**
 * Tupel-Struktur für eine kompakte Regel-Konfiguration: [Parameter, Fehlermeldung].
 * @typedef {[any, string]} RuleConfigTuple
 */
/**
 * Mögliche Konfigurationsformen für eine einzelne Validierungsregel.
 * @typedef {boolean | string | RuleConfigTuple | RuleConfigObject} RuleConfig
 */
/**
 * Mapping von Regel-Namen zu ihren jeweiligen Konfigurationen für ein Feld.
 * @typedef {Record<string, RuleConfig>} FieldRules
 */
/**
 * Key-Value-Objekt der zu validierenden Formularwerte.
 * @typedef {Record<string, any>} FormValues
 */
/**
 * Validierungsschema für ein gesamtes Formular (Mapping von Feldnamen zu FieldRules).
 * @typedef {Record<string, FieldRules>} FormSchema
 */
/**
 * Mapping von Feldnamen zu ihren jeweiligen Fehlermeldungen.
 * @typedef {Record<string, string>} FormErrors
 */

/**
 * Service-Klasse des Aspis-Frameworks zur Validierung einzelner Formularfelder
 * sowie kompletter Formular-Datensätze anhand konfigurierbarer Prüfregeln.
 * 
 * @public
 */
export class ValidationService {

    /**
     * Interne Registry der verfügbaren Validierungsregeln.
     * @internal
     * @type {Record<string, ValidationRuleFn>}
     */
    static #rules = {
        required: (value) => {
            if (value === null || value === undefined) return false;
            if (typeof value === 'string') return value.trim().length > 0;
            if (Array.isArray(value)) return value.length > 0;
            return true;
        },
        email: (value) => {
            if (!value) return true;
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
        },
        minLength: (value, param) => {
            if (!value) return true;
            return String(value).length >= Number(param);
        },
        maxLength: (value, param) => {
            if (!value) return true;
            return String(value).length <= Number(param);
        },
        numeric: (value) => {
            if (!value) return true;
            return !isNaN(parseFloat(value)) && isFinite(value);
        },
        pattern: (value, param) => {
            if (!value) return true;
            const regex = new RegExp(param);
            return regex.test(value);
        }
    };

    /**
     * Registriert eine neue benutzerdefinierte Validierungsregel im Service.
     * 
     * @public
     * @static
     * @param {string} name - Der eindeutige Name der Validierungsregel.
     * @param {ValidationRuleFn} fn - Die Prüffunktion, die `true` bei Gültigkeit und `false` bei einem Fehler zurückgibt.
     * @returns {void}
     */
    static registerRule(name, fn) {
        if (typeof fn === 'function') {
            this.#rules[name] = fn;
        }
    }

    /**
     * Validiert einen einzelnen Wert gegen ein Set definierter Regeln.
     * 
     * @public
     * @static
     * @param {any} value - Der zu prüfende Wert.
     * @param {FieldRules} [rules={}] - Ein Objekt mit den anzuwendenden Validierungsregeln.
     * @returns {string | null} Die erste aufgetretene Fehlermeldung oder `null`, wenn der Wert gültig ist.
     */
    static validateField(value, rules = {}) {
        for (const [ruleName, config] of Object.entries(rules)) {
            let param = null;
            let message = "Ungültiger Wert";

            if (Array.isArray(config)) {
                [param, message] = config;
            } else if (typeof config === 'string') {
                message = config;
            } else if (typeof config === 'object' && config !== null) {
                param = config.param;
                message = config.message || message;
            }

            const ruleFn = this.#rules[ruleName];
            if (ruleFn && !ruleFn(value, param)) {
                return message;
            }
        }
        return null;
    }

    /**
     * Validiert ein komplettes Objekt von Formularwerten gegen ein definiertes Schema.
     * 
     * @public
     * @static
     * @param {FormValues} values - Key-Value-Paare der Formularfeld-Werte.
     * @param {FormSchema} [schema={}] - Das Schema mit den Validierungsregeln pro Feld.
     * @returns {FormErrors} Ein Objekt, das fehlgeschlagenen Feldern ihre jeweilige Fehlermeldung zuordnet.
     */
    static validateForm(values, schema = {}) {
        const errors = {};

        for (const [fieldName, rules] of Object.entries(schema)) {
            const fieldValue = values[fieldName];
            const error = this.validateField(fieldValue, rules);

            if (error) {
                errors[fieldName] = error;
            }
        }
        return errors;
    }
}