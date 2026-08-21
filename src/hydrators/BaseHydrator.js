/**
 * @file BaseHydrator.js
 * @description Basisklasse für alle Manifest- und Konfigurations-Hydratoren.
 */

/**
 * Abstrakte Basisklasse für standardisierte Daten-Transformationen.
 * 
 * @public
 */
export class BaseHydrator {
    /**
     * Führt den allgemeinen Hydratisierungs-Workflow aus.
     * Validiert die Rohdaten und ruft die spezifische Transformation auf.
     * 
     * @public
     * @static
     * @param {Object} rawData - Die rohen JSON-Daten.
     * @returns {Object} Die vollständig hydratisierten Daten.
     * @throws {Error} Wenn keine Rohdaten vorhanden sind.
     */
    static hydrate(rawData) {
        if (!rawData) {
            throw new Error(`Aspis [${this.name}]: Keine Rohdaten zum Hydratisieren übergeben.`);
        }

        // Delegiert an die überschriebene Methode der Kindklasse
        return this.transform(rawData);
    }

    /**
     * Spezifische Transformationslogik der Kindklasse.
     * Muss von Unterklassen implementiert werden.
     * 
     * @protected
     * @static
     * @param {Object} rawData - Die rohen Rohdaten.
     * @returns {Object} Die transformierten Daten.
     */
    static transform(rawData) {
        throw new Error(`Aspis [${this.name}]: Die Methode 'transform()' muss implementiert werden.`);
    }
}