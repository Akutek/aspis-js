/**
 * Interface für einen Service, der CSS-Klassen und Style-Cleanups auf Elementen verwaltet.
 * @typedef {Object} ClassService
 * @property {function(): void} [cleanup] - Entfernt gesetzte Klassen-Bindings und stellt den Ursprungszustand her.
 */
/**
 * Interface für eine Controller-Instanz im Aspis-Framework.
 * @typedef {Object} ControllerInstance
 * @property {ClassService} [classService] - Optionaler Service zur Verwaltung von Klassen-Bindings.
 * @property {function(): void} [destroy] - Lifecycle-Methode zum Aufräumen und Freigeben von Ressourcen.
 */
/**
 * Interface für den reaktiven Haupt-Store des Aspis-Frameworks.
 * @typedef {Object} Store
 * @property {function(HTMLElement): void} removeDomDependencies - Entfernt ein Element aus allen Store-Reaktivitäts-Trackern.
 */
/**
 * Interface für die Registry des Aspis-Frameworks zur Verwaltung von Services, Store und Controller-Instanzen.
 * @typedef {Object} ComponentRegistry
 * @property {function(string | HTMLElement): (Store | ControllerInstance | any)} get - Ruft einen Service über dessen Namen ODER einen Controller über dessen Element-Referenz ab.
 * @property {function(HTMLElement): boolean} delete - Entfernt die Zuordnung eines Controllers zu einem DOM-Element.
 */

/**
 * Interne Hilfsklasse des Aspis-Frameworks zum geordneten Abbau (Cleanup/Teardown) von Komponenten,
 * Controller-Instanzen und deren Reaktivitäts-Bindungen aus dem Store und DOM.
 * 
 * @internal
 */
export class ComponentCleaner {
    /**
     * Referenz auf die zentral registrierte ComponentRegistry.
     * @internal
     * @type {ComponentRegistry}
     */
    #registry;

    /**
     * Erstellt eine neue Instanz des ComponentCleaners.
     * 
     * @public
     * @param {ComponentRegistry} registry - Die zentrale Registry zur Komponenten-Verwaltung.
     */
    constructor(registry) {
        this.#registry = registry;
    }

    /**
     * Räumt ein einzelnes DOM-Element auf: Entkoppelt Store-Abhängigkeiten, führt Lifecycle-Cleanup
     * des zugehörigen Controllers aus und entfernt diesen aus der Registry.
     * 
     * @public
     * @param {HTMLElement} element - Das aufzuräumende DOM-Element.
     * @returns {void}
     */
    clean(element) {
        if (!element || !this.#registry) return;

        const store = this.#registry.get('store');
        if (store && typeof store.removeDomDependencies === 'function') {
            store.removeDomDependencies(element);
        }

        const controller = this.#registry.get(element);
        if (!controller) return;

        try {
            if (controller.classService && typeof controller.classService.cleanup === 'function') {
                controller.classService.cleanup();
            }

            if (typeof controller.destroy === 'function') {
                controller.destroy();
            }
        } catch (error) {
            LoggerService.error(`[ComponentCleaner.clean()] Aspis [ComponentCleaner]: Fehler beim Zerstören von ${controller.constructor?.name || 'Controller'}:`, error);
        } finally {
            this.#registry.delete(element);
        }
    }

    /**
     * Durchsucht einen DOM-Teilbaum rückwärts (Bottom-Up) nach Elementen mit `data-controller`
     * und führt für jedes gefundene Element (inklusive Root) das Cleanup durch.
     * 
     * @public
     * @param {Element} rootElement - Das Wurzel-Element des abzubauenden DOM-Teilbaums.
     * @returns {void}
     */
    cleanTree(rootElement) {
        if (!rootElement || !(rootElement instanceof Element)) return;

        const targets = [];

        const children = rootElement.querySelectorAll('[data-controller]');
        for (const child of children) {
            targets.push(child);
        }

        if (typeof rootElement.matches === 'function' && rootElement.matches('[data-controller]')) {
            targets.push(rootElement);
        }

        for (let i = targets.length - 1; i >= 0; i--) {
            this.clean(targets[i]);
        }
    }
}