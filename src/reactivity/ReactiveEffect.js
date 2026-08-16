/**
 * Repräsentiert einen reaktiven Effekt im Aspis-Framework, der eine Funktion ausführt,
 * deren gelesene State-Pfade automatisch protokolliert und sich bei State-Änderungen erneut triggern lässt.
 * 
 * @internal
 */
export class ReactiveEffect {
    /**
     * Referenz auf den verknüpften Store zur Steuerung des Effect-Stacks und Cleanups.
     * @internal
     * @type {Store}
     */
    #store;

    /**
     * Die reaktiv auszuführende Ziel-Funktion.
     * @internal
     * @type {function(): any}
     */
    #fn;

    /**
     * Menge aller State-Pfade, die während der letzten Ausführung dieses Effekts gelesen wurden.
     * @internal
     * @type {Set<string>}
     */
    #trackedPaths = new Set();

    /**
     * Erzeugt eine neue `ReactiveEffect`-Instanz.
     * 
     * @public
     * @param {Store} store - Die Store-Instanz, an die der Effekt gebunden ist.
     * @param {function(): any} fn - Die reaktiv auszuführende Funktion.
     */
    constructor(store, fn) {
        this.#store = store;
        this.#fn = fn;
    }

    /**
     * Führt die hinterlegte Funktion aus, registriert den Effekt auf dem Store-Stack
     * zur automatischen Pfad-Erfassung und stellt sicher, dass der Stack anschließend bereinigt wird.
     * 
     * @public
     * @returns {any} Der Rückgabewert der ausgeführten Funktion `#fn`.
     */
    run() {
        try {
            this.#store.pushEffect(this);
            return this.#fn();
        } finally {
            this.#store.popEffect();
        }
    }

    /**
     * Registriert einen beobachteten State-Pfad in der internen Tracking-Liste des Effekts.
     * 
     * @public
     * @param {string} path - Der vom State ausgelesene Punkt-getrennte Pfad.
     * @returns {void}
     */
    trackPath(path) {
        this.#trackedPaths.add(path);
    }

    /**
     * Stoppt den Effekt, meldet ihn von allen registrierten Pfad-Listenern des Stores ab
     * und leert die intern verfolgten Pfade.
     * 
     * @public
     * @returns {void}
     */
    stop() {
        this.#store._cleanupEffect(this, this.#trackedPaths);
        this.#trackedPaths.clear();
    }
}

/**
 * Interface für den reaktiven Haupt-Store des Aspis-Frameworks.
 * @typedef {Object} Store
 * @property {function(ReactiveEffect): void} pushEffect - Legt einen Reaktivitäts-Effekt auf den Ausführungs-Stack.
 * @property {function(): void} popEffect - Entfernt den obersten Reaktivitäts-Effekt vom Ausführungs-Stack.
 * @property {function(ReactiveEffect, Set<string>): void} _cleanupEffect - Entfernt die Listener-Registrierungen eines Effekts für gegebene Pfade.
 */