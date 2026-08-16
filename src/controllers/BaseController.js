import { EventDelegator, LoadingStateHelper, DomDependencyScanner, ModifierDOM } from "../utils/";

/**
 * Interface für ein HTTP-Fetcher-Modul.
 * @typedef {Object} Fetcher
 * @property {function(string, Record<string, any>=, RequestInit=): Promise<any>} get - Führt einen HTTP-GET-Request aus.
 */
/**
 * Interface für die Service-Registry des Aspis-Frameworks.
 * @typedef {Object} ComponentRegistry
 * @property {function(string): boolean} has - Prüft, ob ein Service unter dem Namen registriert ist.
 * @property {function(string): any} get - Ruft einen registrierten Service ab.
 */
/**
 * Optionen zur Konfiguration des BaseControllers.
 * @typedef {Object} ControllerOptions
 * @property {string} [sliceKey] - Der Pfad zum zugehörigen State-Slice im Store (z. B. 'features.filter').
 * @property {Fetcher} [fetcher] - Benutzerdefinierter HTTP-Fetcher.
 * @property {ComponentRegistry} [registry] - Die zentrale Registry der Anwendung.
 * @property {Record<string, any>} [key: string] - Weitere benutzerdefinierte Optionen.
 */
/**
 * Interface für den reaktiven Haupt-Store.
 * @typedef {Object} Store
 * @property {function(function(): void): (function(): void)} [effect] - Registriert einen reaktiven Effekt.
 * @property {function(string): StateSlice|null} [getSlice] - Ruft einen State-Slice anhand seines Pfads ab.
 * @property {function(HTMLElement): void} [removeDomDependencies] - Entfernt ein Element aus allen Store-Reaktivitäts-Trackern.
 */
/**
 * Interface für den Event-Dispatcher des Frameworks.
 * @typedef {Object} Dispatcher
 * @property {function(string, any=): void} [dispatch] - Dispatched ein Framework-Event.
 */
/**
 * Konfiguration für ein spezifisches DOM-Target innerhalb eines State-Slices.
 * @typedef {Object} TargetConfig
 * @property {string} selector - CSS-Selektor für das Ziel-Element.
 * @property {Record<string, string>} [bindClasses] - Mapping von State-Eigenschaften auf CSS-Klassenschlüssel.
 */
/**
 * Konfiguration eines State-Slices.
 * @typedef {Object} SliceConfig
 * @property {Record<string, TargetConfig>} [targets] - Deklarierte Ziel-Elemente und deren Bindings.
 * @property {Record<string, string>} [styles] - Mapping von Style-Konstanten zu CSS-Klassen.
 */
/**
 * Zustandsobjekt eines State-Slices im Store.
 * @typedef {Object} StateSlice
 * @property {SliceConfig} [config] - Layout- und Binding-Konfiguration des Slices.
 * @property {Record<string, any>} [key: string] - Dynamische State-Daten.
 */
/**
 * Interface für den internen Event-Delegator.
 * @typedef {Object} EventDelegatorInterface
 * @property {function(string, string, function(Event): void, AddEventListenerOptions=): void} delegate - Registriert ein delegiertes Event.
 * @property {function(Fetcher): Promise<void>} initEvents - Initialisiert alle dekorierten Event-Handler.
 * @property {function(): void} destroy - Baut alle registrierten Event-Listener ab.
 */
/**
 * Helper zur Steuerung visueller Ladezustände im DOM.
 * @typedef {Object} LoadingStateHelper
 * @property {function(HTMLElement, Object, string=): void} apply - Wendet den Lade-Zustand auf den Container an.
 */
/**
 * Scanner zur Erfassung und Bereinigung von DOM-Abhängigkeiten.
 * @typedef {Object} DomDependencyScanner
 * @property {function(HTMLElement, Store): void} register - Registriert DOM-Abhängigkeiten im Store.
 * @property {function(HTMLElement, Store): void} unregister - Entfernt DOM-Abhängigkeiten aus dem Store.
 */
/**
 * Hilfsklasse zur Manipulation von DOM-Klassen basierend auf Slices.
 * @typedef {Object} ModifierDOM
 * @property {function(HTMLElement, StateSlice, string, boolean): void} toggleSliceClass - Schaltet Slice-spezifische CSS-Klassen um.
 */

/**
 * Abstrakte Basisklasse für alle Controller im Aspis-Framework.
 * Verwaltet den Komponenten-Lebenszyklus, Event-Delegation, Asynchronität via AbortController
 * sowie die automatische Bindung an den Store.
 * 
 * @public
 */
class BaseController {
    /**
     * Referenz auf den reaktiven Store.
     * @internal
     * @type {Store | null}
     */
    _store;

    /**
     * Referenz auf den Event-Dispatcher.
     * @internal
     * @type {Dispatcher | null}
     */
    _dispatcher;

    /**
     * Das Root-DOM-Element der Controller-Komponente.
     * @internal
     * @type {HTMLElement | null}
     */
    _container;

    /**
     * Konfigurationseinstellungen des Controllers.
     * @internal
     * @type {ControllerOptions | null}
     */
    _options;

    /**
     * Pfad des zugewiesenen State-Slices (z. B. 'features.myFeature').
     * @internal
     * @type {string | null}
     */
    _sliceKey = null;

    /**
     * Statusflag, ob der Controller bereits gestartet wurde.
     * @internal
     * @type {boolean}
     */
    _isStarted = false;

    /**
     * Unsubscribe-Funktion für das reaktive Store-Effekt-Abonnement.
     * @internal
     * @type {(function(): void) | null}
     */
    #unsubscribeStore = null;

    /**
     * Instanz des EventDelegators zur Verwaltung gekapselter DOM-Events.
     * @internal
     * @type {EventDelegatorInterface | null}
     */
    #eventDelegator = null;

    /**
     * Haupt-AbortController für den gesamten Lebenszyklus der Komponente.
     * @internal
     * @type {AbortController}
     */
    #lifecycleController = new AbortController();

    /**
     * Map von AbortControllern für spezifische, abbrechbare Tasks/Requests.
     * @internal
     * @type {Map<string, AbortController>}
     */
    #taskControllers = new Map();

    /**
     * Erzeugt eine neue Instanz des BaseControllers.
     * 
     * @public
     * @param {HTMLElement} container - Das zugewiesene DOM-Element.
     * @param {Store} store - Die Haupt-Store-Instanz.
     * @param {Dispatcher} dispatcher - Die Dispatcher-Instanz.
     * @param {ControllerOptions} [options={}] - Zusätzliche Konfigurationseinstellungen.
     */
    constructor(container, store, dispatcher, options = {}) {
        this._container = container;
        this._store = store;
        this._dispatcher = dispatcher;
        this._options = options;

        if (options.sliceKey) {
            this._sliceKey = options.sliceKey;
        }

        this.#eventDelegator = new EventDelegator(container, dispatcher, this, options);
    }

    /**
     * Das Haupt-AbortSignal für den Lebenszyklus des Controllers.
     * Signalisiert das Beenden/Zerstören der Komponente.
     * 
     * @public
     * @type {AbortSignal}
     */
    get signal() {
        return this.#lifecycleController.signal;
    }

    /**
     * Gibt den konfigurierten oder aus der Registry bezogenen HTTP-Fetcher zurück.
     * Fällt auf eine native `fetch`-Implementierung zurück, falls keiner angegeben ist.
     * 
     * @public
     * @type {Fetcher}
     */
    get fetcher() {
        if (this._options?.fetcher) return this._options.fetcher;

        const registry = this._options?.registry;
        if (registry && typeof registry.has === 'function' && registry.has('fetcher')) {
            return registry.get('fetcher');
        }

        return {
            get: async (url, params, opts) => {
                const res = await fetch(url, opts);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            }
        };
    }

    /**
     * Erstellt oder liefert ein `AbortSignal` für einen spezifischen Task.
     * Bricht vorherige laufende Tasks unter demselben `taskKey` automatisch ab
     * und ist an das Haupt-Signal gekoppelt.
     * 
     * @public
     * @param {string | null} [taskKey=null] - Eindeutiger Identifikator des Tasks.
     * @returns {AbortSignal} Das erzeugte oder kombinierte AbortSignal.
     */
    getSignal(taskKey = null) {
        if (!taskKey) {
            return this.#lifecycleController.signal;
        }

        if (this.#taskControllers.has(taskKey)) {
            this.#taskControllers.get(taskKey).abort(`Task '${taskKey}' überschrieben.`);
        }

        const taskController = new AbortController();
        this.#taskControllers.set(taskKey, taskController);

        if (typeof AbortSignal.any === 'function') {
            return AbortSignal.any([this.#lifecycleController.signal, taskController.signal]);
        }

        if (this.#lifecycleController.signal.aborted) {
            taskController.abort(this.#lifecycleController.signal.reason);
        } else {
            this.#lifecycleController.signal.addEventListener('abort', () => {
                taskController.abort(this.#lifecycleController.signal.reason);
            }, { once: true });
        }

        return taskController.signal;
    }

    /**
     * Entfernt den AbortController eines beendeten Tasks aus dem internen Speicher.
     * 
     * @public
     * @param {string} taskKey - Der Identifikator des zu entfernenden Tasks.
     * @returns {void}
     */
    clearTask(taskKey) {
        if (this.#taskControllers.has(taskKey)) {
            this.#taskControllers.delete(taskKey);
        }
    }

    /**
     * Registriert ein delegiertes Event-Handling auf dem Container-Element.
     * 
     * @public
     * @param {string} eventName - Der Name des DOM-Events (z. B. 'click').
     * @param {string} selector - CSS-Selektor für das Ziel-Element.
     * @param {function(Event): void} handler - Die auszuführende Callback-Funktion.
     * @param {AddEventListenerOptions} [options={}] - Optionale Event-Listener-Optionen.
     * @returns {void}
     */
    delegate(eventName, selector, handler, options = {}) {
        this.#eventDelegator.delegate(eventName, selector, handler, options);
    }

    /**
     * Wendet einen visuellen Lade-Zustand auf den Container oder dessen Unterelemente an.
     * 
     * @public
     * @param {Object} stateProxy - Das reaktive Proxy-Objekt des States.
     * @param {string} [message='Lade...'] - Die anzuzeigende Lade-Nachricht.
     * @returns {void}
     */
    setLoadingState(stateProxy, message = 'Lade...') {
        LoadingStateHelper.apply(this._container, stateProxy, message);
    }

    /**
     * Lifecycle-Hook: Wird nach der Initialisierung des Controllers aufgerufen.
     * Kann in abgeleiteten Klassen überschrieben werden.
     * 
     * @public
     * @async
     * @returns {Promise<void>}
     * @throws {Error} Wenn kein gültiges Container-Element vorhanden ist.
     */
    async onInit() {
        if (!this._container) {
            throw new Error(`Aspis [${this.constructor.name}]: Kein Container-Element übergeben.`);
        }
    }

    /**
     * Startet den Lebenszyklus des Controllers: Initialisiert Event-Delegation,
     * führt `onInit` aus, scannt DOM-Abhängigkeiten und bindet den Store-Slice-Effekt.
     * 
     * @public
     * @async
     * @returns {Promise<void>}
     */
    async start() {
        if (this._isStarted || this.signal.aborted) return;
        this._isStarted = true;

        await this.#eventDelegator.initEvents(this.fetcher);
        if (this.signal.aborted) return;

        await this.onInit();
        if (this.signal.aborted) return;

        DomDependencyScanner.register(this._container, this._store);

        if (this._sliceKey && this._store && typeof this._store.effect === 'function') {
            this.#unsubscribeStore = this._store.effect(() => {
                if (!this._store || this.signal.aborted) return;

                const slice = typeof this._store.getSlice === 'function' 
                    ? this._store.getSlice(this._sliceKey) 
                    : null;

                if (slice) {
                    this._onStateChange(slice);
                }
            });
        }
    }

    /**
     * Zerstört die Controller-Instanz vollständig: Bricht alle laufenden Tasks ab,
     * meldet den Store-Subscriber ab, entfernt Event-Delegationen und gibt Referenzen frei.
     * Ruft optional `onDestroy()` auf der Kindklasse auf.
     * 
     * @public
     * @returns {void}
     */
    destroy() {
        this.#lifecycleController.abort("Controller zerstört.");
        for (const taskCtrl of this.#taskControllers.values()) {
            taskCtrl.abort("Controller zerstört.");
        }
        this.#taskControllers.clear();

        if (this.#unsubscribeStore) {
            this.#unsubscribeStore();
            this.#unsubscribeStore = null;
        }

        if (this.#eventDelegator) {
            this.#eventDelegator.destroy();
            this.#eventDelegator = null;
        }

        DomDependencyScanner.unregister(this._container, this._store);

        try {
            if (typeof this.onDestroy === 'function') {
                this.onDestroy();
            }
        } catch (e) {
            console.error(`Aspis [BaseController]: Fehler in onDestroy() von ${this.constructor.name}:`, e);
        } finally {
            this._container = null;
            this._store = null;
            this._dispatcher = null;
            this._options = null;
        }

        console.log(`Aspis [Lifecycle]: ${this.constructor.name} erfolgreich gereinigt und aus dem Speicher entfernt.`);
    }

    /**
     * Verarbeitet Zustandsänderungen des abonnierten State-Slices
     * und aktualisiert gebundene CSS-Klassen auf DOM-Elements.
     * 
     * @internal
     * @param {StateSlice} slice - Der geänderte State-Slice Knoten.
     * @returns {void}
     */
    _onStateChange(slice) {
        if (!this._container) return;
        if (slice?.config?.targets) {
            const targets = slice.config.targets;
            for (const [, targetConfig] of Object.entries(targets)) {
                const element = targetConfig.selector === ':scope' 
                    ? this._container 
                    : this._container.querySelector(targetConfig.selector);

                if (!element || !targetConfig.bindClasses) continue;

                for (const [stateProp, styleKey] of Object.entries(targetConfig.bindClasses)) {
                    const isActive = Boolean(slice[stateProp]); 
                    if (typeof ModifierDOM !== 'undefined' && typeof ModifierDOM.toggleSliceClass === 'function') {
                        ModifierDOM.toggleSliceClass(element, slice, styleKey, isActive);
                    }
                }
            }
        }

        if (typeof this.onStateChange === 'function') {
            this.onStateChange(slice);
        }
    }
}