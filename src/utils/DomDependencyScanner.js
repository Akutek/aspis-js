/**
 * Utility-Klasse des Aspis-Frameworks zum Scannen und Verwalten von DOM-Abhängigkeiten.
 * Liest `data-depends-on`-Attribute aus und registriert bzw. entfernt die entsprechenden Bindungen im Store.
 * 
 * @public
 */
export class DomDependencyScanner {
    /**
     * Scannt einen DOM-Container (sowie das Root-Element) nach `data-depends-on`-Attributen
     * und registriert alle gefundenen State-Pfade als Abhängigkeiten im Store.
     * 
     * @public
     * @static
     * @param {HTMLElement} container - Das Wurzel-Element, ab dem gescannt wird.
     * @param {Store} store - Die Store-Instanz, in der die Abhängigkeiten registriert werden.
     * @returns {void}
     */
    static register(container, store) {
        if (!container || !store || typeof store.addDependency !== 'function') return;

        const elements = [];
        if (container.dataset?.dependsOn) {
            elements.push(container);
        }

        const childElements = container.querySelectorAll('[data-depends-on]');
        elements.push(...childElements);

        elements.forEach(element => {
            const rawAttr = element.dataset.dependsOn;
            if (!rawAttr) return;

            const paths = rawAttr.split(/[\s,]+/).map(p => p.trim()).filter(Boolean);
            paths.forEach(path => {
                store.addDependency(element, path);
            });
        });
    }

    /**
     * Entfernt alle registrierten Store-Abhängigkeiten für einen DOM-Container
     * und dessen Unterelemente mit `data-depends-on`-Attributen.
     * 
     * @public
     * @static
     * @param {HTMLElement} container - Das Wurzel-Element des abzumeldenden DOM-Teilbaums.
     * @param {Store} store - Die Store-Instanz, aus der die Abhängigkeiten entfernt werden.
     * @returns {void}
     */
    static unregister(container, store) {
        if (!container || !store || typeof store.removeDomDependencies !== 'function') return;

        store.removeDomDependencies(container);

        const childElements = container.querySelectorAll('[data-depends-on]');
        childElements.forEach(child => store.removeDomDependencies(child));
    }
}

/**
 * Interface für den reaktiven Haupt-Store des Aspis-Frameworks.
 * @typedef {Object} Store
 * @property {function(HTMLElement, string): void} addDependency - Registriert eine DOM-Element-Bindung an einen State-Pfad.
 * @property {function(HTMLElement): void} removeDomDependencies - Entfernt ein Element aus allen Store-Reaktivitäts-Trackern.
 */