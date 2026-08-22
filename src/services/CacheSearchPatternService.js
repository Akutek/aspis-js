/**
 * @file CacheSearchPatternService.js
 * @description Definiert, erstellt und entschlüsselt komplexe Suchmuster für das Caching-System des Aspis-Frameworks.
 * @module Aspis/Core/CacheSearchPatternService
 */

/**
 * @typedef {Object} SearchCriteria
 * @property {string} [field] - Das zu durchsuchende Feld.
 * @property {any} [operator] - Der Vergleichsoperator oder Wert.
 * @property {any} [value] - Der abzugleichende Zielwert.
 */

/**
 * @class CacheSearchPatternService
 * @classdesc Verantwortlich für die Strukturierung, Validierung und iterative Auswertung von Suchmustern,
 * um komplexe Abfragen über Cache-Einträge ohne Zustand durchzuführen.
 */
export class CacheSearchPatternService {
    /**
     * Erstellt ein strukturiertes Suchmuster für komplexe Abfragen.
     * 
     * @public
     * @static
     * @param {Object<string, any>} criteriaMap - Eine Map von Schlüsseln und Werten, die das Suchmuster definieren.
     * @returns {Object<string, any>} Das validierte und strukturierte Suchmuster.
     */
    static createPattern(criteriaMap = {}) {
        if (!criteriaMap || typeof criteriaMap !== 'object') {
            return {};
        }
        return { ...criteriaMap };
    }

    /**
     * Prüft iterativ, ob ein gespeichertes Zielobjekt dem definierten Suchmuster entspricht.
     * 
     * @public
     * @static
     * @param {Object} storedObject - Das im Cache hinterlegte Datenobjekt.
     * @param {Object<string, any>} pattern - Das anzuwendende Suchmuster.
     * @returns {boolean} True, wenn das Objekt dem Muster entspricht, ansonsten false.
     */
    static matches(storedObject, pattern) {
        if (!storedObject || typeof storedObject !== 'object') return false;
        if (!pattern || typeof pattern !== 'object') return false;

        const stack = [{ obj: storedObject, crit: pattern }];

        while (stack.length > 0) {
            const { obj, crit } = stack.pop();

            for (const [criteriaKey, criteriaValue] of Object.entries(crit)) {
                const actualValue = obj[criteriaKey];

                if (actualValue === undefined) return false;

                if (Array.isArray(criteriaValue)) {
                    if (!criteriaValue.includes(actualValue)) return false;
                } else if (criteriaValue !== null && typeof criteriaValue === 'object') {
                    if (actualValue === null || typeof actualValue !== 'object') return false;
                    stack.push({ obj: actualValue, crit: criteriaValue });
                } else {
                    if (actualValue !== criteriaValue) return false;
                }
            }
        }

        return true;
    }

    /**
     * Schüttelt ein Suchmuster auf und gibt eine flache Liste aller Suchpfade und Bedingungen zurück.
     * 
     * @public
     * @static
     * @param {Object<string, any>} pattern - Das zu parsende Suchmuster.
     * @param {string} [prefix=''] - Interner Parameter für den rekursiven Pfadaufbau.
     * @returns {Object<string, any>} Eine flache Map von Pfaden zu ihren Zielwerten.
     */
    static parsePattern(pattern, prefix = '') {
        let result = {};
        if (!pattern || typeof pattern !== 'object') return result;

        for (const [key, value] of Object.entries(pattern)) {
            const currentPath = prefix ? `${prefix}.${key}` : key;

            if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
                Object.assign(result, this.parsePattern(value, currentPath));
            } else {
                result[currentPath] = value;
            }
        }

        return result;
    }
}