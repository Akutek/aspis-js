/**
 * Ergebnis eines DOM-Scan-Vorgangs für ein Controller-Element.
 * @typedef {Object} ControllerScanResult
 * @property {HTMLElement} element - Das gescannte DOM-Element mit `data-controller`-Attribut.
 * @property {string} type - Der Typ/Name des Controllers (Inhalt von `data-controller`).
 * @property {string} layout - Das zugewiesene Layout (Inhalt von `data-layout` oder `"default"`).
 */

/**
 * Utility-Klasse des Aspis-Frameworks zum Scannen des DOMs nach Controller-Deklarationen.
 * Sucht nach Elementen mit dem `data-controller`-Attribut und liest deren Metadaten aus.
 * 
 * @public
 */
export class ScannerDOM {
    /**
     * Durchsucht ein DOM-Element und dessen Kinder nach Elementen mit dem Attribut `data-controller`.
     * 
     * @public
     * @static
     * @param {ParentNode & Element} [rootElement=document.body] - Das Wurzel-Element, ab dem gescannt wird.
     * @returns {ControllerScanResult[]} Array mit den Analyse-Ergebnissen aller gefundenen Controller.
     */
    static scan(rootElement = document.body) {
        if (!rootElement || typeof rootElement.querySelectorAll !== 'function') {
            LoggerService.warn("[ScannerDOM.scan()] Aspis [ScannerDOM]: Ungültiges oder fehlendes Root-Element übergeben. Scan abgebrochen.");
            return [];
        }

        const scanResults = [];

        if (typeof rootElement.matches === 'function' && rootElement.matches('[data-controller]')) {
            const parsed = this.#parseNode(rootElement);
            if (parsed) scanResults.push(parsed);
        }

        const elements = rootElement.querySelectorAll('[data-controller]');
        for (const element of elements) {
            const parsed = this.#parseNode(element);
            if (parsed) scanResults.push(parsed);
        }

        return scanResults;
    }

    /**
     * Liest die Controller-Metadaten (`data-controller` und `data-layout`) aus einem einzelnen DOM-Node aus.
     * 
     * @internal
     * @static
     * @param {HTMLElement} container - Das zu analysierende DOM-Element.
     * @returns {ControllerScanResult | null} Das extrahierte Objekt oder `null`, falls das Attribut leer/ungültig ist.
     */
    static #parseNode(container) {
        const type = container.dataset.controller || container.getAttribute('data-controller');
        if (!type || !type.trim()) {
            LoggerService.warn("[ScannerDOM.#parseNode()] Aspis [ScannerDOM]: Element mit leerem 'data-controller'-Attribut übersprungen:", container);
            return null;
        }

        const layout = container.dataset.layout || container.getAttribute('data-layout') || "default";

        return {
            element: container,
            type: type.trim(),
            layout: layout.trim()
        };
    }
}