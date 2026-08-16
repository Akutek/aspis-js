/**
 * Zuordnung/Interface der Observer-Registry im Aspis-Framework.
 * @typedef {Object.<string, any>} ObserverRegistry
 */
/**
 * Zulässiges Ziel-Element für Beobachtungen.
 * @typedef {Node} ObserverTarget
 */

/**
 * Abstrakte Basisklasse für alle Observer-Implementierungen des Aspis-Frameworks.
 * 
 * @abstract
 * @public
 */
export class BaseObserver {
    /**
     * Referenz auf die zugewiesene Observer-Registry.
     * @internal
     * @type {ObserverRegistry | null}
     */
    #registry;

    /**
     * Indikator, ob die Beobachtung aktuell aktiv ist.
     * @internal
     * @type {boolean}
     */
    #isObserving = false;

    /**
     * Set der aktuell beobachteten DOM-Knoten.
     * @internal
     * @type {Set<Node>}
     */
    #targets = new Set();

    /**
     * Erstellt eine neue Instanz des BaseObservers.
     * 
     * @public
     * @param {ObserverRegistry} registry - Die Registry-Instanz zur Verwaltung des Observers.
     * @throws {TypeError} Wirft einen Fehler, wenn die abstrakte Klasse direkt instanziiert wird.
     */
    constructor(registry) {
        if (new.target === BaseObserver) {
            throw new TypeError("Aspis [BaseObserver]: Instanziierung der abstrakten Basisklasse ist nicht erlaubt.");
        }
        this.#registry = registry;
    }

    /**
     * Liefert die aktuell zugewiesene Observer-Registry.
     * 
     * @public
     * @type {ObserverRegistry | null}
     */
    get registry() {
        return this.#registry;
    }

    /**
     * Gibt an, ob der Observer derzeit aktiv Beobachtungen durchführt.
     * 
     * @public
     * @type {boolean}
     */
    get isObserving() {
        return this.#isObserving;
    }

    /**
     * Liefert eine Kopie aller aktuell beobachteten DOM-Knoten als Array.
     * 
     * @public
     * @type {Node[]}
     */
    get targets() {
        return Array.from(this.#targets);
    }

    /**
     * Aktiviert den Observer und fügt optional ein erstes Ziel-Element hinzu.
     * 
     * @public
     * @param {ObserverTarget} [target] - Optionales DOM-Ziel-Element, das sofort beobachtet werden soll.
     * @returns {void}
     */
    start(target) {
        this.#isObserving = true;
        if (target) {
            this.#targets.add(target);
        }
    }

    /**
     * Deaktiviert den Observer und entfernt alle bisher registrierten Ziel-Elemente.
     * 
     * @public
     * @returns {void}
     */
    stop() {
        this.#isObserving = false;
        this.#targets.clear();
    }

    /**
     * Registriert ein neues DOM-Ziel-Element für die Beobachtung.
     * 
     * @public
     * @param {ObserverTarget} target - Das hinzuzufügende DOM-Element (muss eine Instanz von `Node` sein).
     * @returns {void}
     */
    observe(target) {
        if (!(target instanceof Node)) return;
        this.#targets.add(target);
    }

    /**
     * Entfernt ein bestimmtes DOM-Ziel-Element aus der Beobachtung.
     * 
     * @public
     * @param {ObserverTarget} target - Das zu entfernende DOM-Ziel-Element.
     * @returns {void}
     */
    unobserve(target) {
        this.#targets.delete(target);
    }

    /**
     * Stoppt die Beobachtung vollständig und hebt die Referenz auf die Registry auf.
     * 
     * @public
     * @returns {void}
     */
    destroy() {
        this.stop();
        this.#registry = null;
    }
}