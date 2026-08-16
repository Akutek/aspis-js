import { LoggerService } from "../services/LoggerService.js";

/**
 * Verwalter für delegierte DOM-Events und globale Dispatcher-Abonnements innerhalb des Aspis-Frameworks.
 * Kapselt das Event-Handling auf Container-Ebene und unterstützt dynamisches Event-Mapping via Remote-Path oder dataset.
 * 
 * @public
 */
export class EventDelegator {
    /**
     * Das Wurzel-DOM-Element, auf dem Event-Listener registriert werden.
     * @internal
     * @type {HTMLElement | null}
     */
    #container;

    /**
     * Referenz auf den zentralen Event-Dispatcher.
     * @internal
     * @type {Dispatcher | null}
     */
    #dispatcher;

    /**
     * Das Zielobjekt (z. B. Controller-Instanz), an das Callback-Methoden gebunden werden.
     * @internal
     * @type {EventDelegatorTarget | null}
     */
    #target;

    /**
     * Konfigurationseinstellungen des EventDelegators.
     * @internal
     * @type {EventDelegatorOptions | null}
     */
    #options;

    /**
     * Liste von Unsubscribe-Funktionen für registrierte Dispatcher-Events.
     * @internal
     * @type {Array<function(): void>}
     */
    #unsubscribeEvents = [];

    /**
     * Erzeugt eine neue Instanz des EventDelegators.
     * 
     * @public
     * @param {HTMLElement} container - Das Wurzel-DOM-Element für das Event-Handling.
     * @param {Dispatcher} dispatcher - Der zentrale Event-Dispatcher.
     * @param {EventDelegatorTarget} [target] - Das Ziel-Objekt für Callbacks (fällt auf `this` zurück, wenn nicht angegeben).
     * @param {EventDelegatorOptions} [options={}] - Zusätzliche Konfigurationseinstellungen.
     */
    constructor(container, dispatcher, target, options = {}) {
        this.#container = container;
        this.#dispatcher = dispatcher;
        this.#target = target || this;
        this.#options = options;
    }

    /**
     * Registriert ein delegiertes Event auf dem Container-Element.
     * Der Callback wird nur ausgeführt, wenn das auslösende Element dem CSS-Selektor entspricht.
     * 
     * @public
     * @param {string} eventName - Name des DOM-Events (z. B. 'click', 'change').
     * @param {string} selector - CSS-Selektor zur Ziel-Element-Bestimmung.
     * @param {DelegateHandler} handler - Callback-Funktion bei Event-Eintritt.
     * @param {DelegateOptions} [options={}] - Optionale `addEventListener`-Einstellungen (inkl. `signal`).
     * @returns {void}
     */
    delegate(eventName, selector, handler, options = {}) {
        if (!this.#container) {
            LoggerService.warn(`[EventDelegator.delegate()] Aspis [${this.#target.constructor.name}]: delegate() abgebrochen — kein Container vorhanden.`);
            return;
        }

        if (typeof handler !== 'function') {
            LoggerService.warn(`[EventDelegator.delegate()] Aspis [${this.#target.constructor.name}]: Handler für Event '${eventName}' ist keine Funktion.`);
            return;
        }

        const signal = options.signal || (typeof this.#target.getSignal === 'function' ? this.#target.getSignal() : null);
        const listenerOptions = { ...options };

        if (signal) {
            listenerOptions.signal = signal;
        }

        this.#container.addEventListener(
            eventName,
            (event) => {
                const target = event.target.closest(selector);

                if (target && this.#container.contains(target)) {
                    handler.call(this.#target, event, target);
                }
            },
            listenerOptions
        );
    }

    /**
     * Initialisiert dynamische Dispatcher-Event-Mappings aus einer Remote-Quelle (`eventPath`)
     * oder aus dem `data-events`-Attribut des Containers.
     * 
     * @public
     * @async
     * @param {Fetcher | null} [fetcher=null] - Optionaler HTTP-Fetcher zum Laden der Remote-Konfiguration.
     * @returns {Promise<void>}
     */
    async initEvents(fetcher = null) {
        if (!this.#dispatcher) return;

        let eventMap = {};

        if (this.#options?.eventPath) {
            const initSignal = typeof this.#target.getSignal === 'function' ? this.#target.getSignal('initEvents') : null;
            const activeFetcher = fetcher || this.#options?.fetcher || this.#target?.fetcher;

            try {
                if (activeFetcher && typeof activeFetcher.get === 'function') {
                    eventMap = await activeFetcher.get(this.#options.eventPath, {}, { signal: initSignal }) || {};
                }
            } catch (e) {
                const isAborted = this.#target?.signal?.aborted;
                if (e.name !== 'AbortError' && !isAborted) {
                    LoggerService.error(`[EventDelegator.initEvents()] Aspis [${this.#target.constructor.name}]: Fehler beim Laden von '${this.#options.eventPath}':`, e);
                }
            } finally {
                if (typeof this.#target.clearTask === 'function') {
                    this.#target.clearTask('initEvents');
                }
            }
        }

        if (this.#target?.signal?.aborted) return;

        if (this.#container?.dataset?.events) {
            try {
                const inlineMap = JSON.parse(this.#container.dataset.events);
                eventMap = { ...eventMap, ...inlineMap };
            } catch (e) {
                LoggerService.error(`[EventDelegator.initEvents()] Aspis [${this.#target.constructor.name}]: Fehler beim Parsen von data-events an <${this.#target.constructor.name}>:`, e);
            }
        }

        Object.entries(eventMap).forEach(([eventName, methodName]) => {
            if (typeof this.#target[methodName] === 'function') {
                const unsub = this.#dispatcher.on(eventName, (payload) => this.#target[methodName](payload));
                this.#unsubscribeEvents.push(unsub);
            } else {
                LoggerService.warn(`[EventDelegator.initEvents()] Aspis [${this.#target.constructor.name}]: Event '${eventName}' verweist auf nicht existierende Methode '${methodName}' in ${this.#target.constructor.name}.`);
            }
        });
    }

    /**
     * Zerstört die EventDelegator-Instanz: Meldet alle Dispatcher-Events ab
     * und hebt die Referenzen auf DOM-Elemente und Zielobjekte auf.
     * 
     * @public
     * @returns {void}
     */
    destroy() {
        this.#unsubscribeEvents.forEach(unsub => unsub());
        this.#unsubscribeEvents = [];

        this.#container = null;
        this.#dispatcher = null;
        this.#target = null;
        this.#options = null;
    }
}

/**
 * Interface für ein HTTP-Fetcher-Modul.
 * @typedef {Object} Fetcher
 * @property {function(string, Record<string, any>=, RequestInit=): Promise<any>} get - Führt einen HTTP-GET-Request aus.
 */
/**
 * Interface für den Event-Dispatcher des Frameworks.
 * @typedef {Object} Dispatcher
 * @property {function(string, function(any): void): (function(): void)} on - Registriert einen Event-Listener und gibt eine Unsubscribe-Funktion zurück.
 * @property {function(string, any=): void} [dispatch] - Dispatched ein Framework-Event.
 */
/**
 * Konfigurationsoptionen für den EventDelegator.
 * @typedef {Object} EventDelegatorOptions
 * @property {string} [eventPath] - Optionaler Server-Pfad zum Laden einer Event-Mapping-Konfiguration.
 * @property {Fetcher} [fetcher] - Benutzerdefinierter HTTP-Fetcher.
 * @property {Record<string, any>} [key: string] - Weitere benutzerdefinierte Optionen.
 */
/**
 * Schnittstelle für das Zielobjekt (z. B. Controller), auf das Event-Callbacks gebunden werden.
 * @typedef {Object} EventDelegatorTarget
 * @property {function(string=): AbortSignal|null} [getSignal] - Erzeugt oder holt ein AbortSignal für einen spezifischen Task.
 * @property {function(string): void} [clearTask] - Bereinigt den AbortController eines abgeschlossenen Tasks.
 * @property {AbortSignal} [signal] - Haupt-AbortSignal des Zielobjekts.
 * @property {Fetcher} [fetcher] - Zugewiesener HTTP-Fetcher des Zielobjekts.
 * @property {Record<string, any>} [key: string] - Dynamische Methoden und Eigenschaften des Zielobjekts.
 */
/**
 * Callback-Funktion für delegierte DOM-Events.
 * @callback DelegateHandler
 * @param {Event} event - Das ausgelöste ursprüngliche DOM-Event.
 * @param {HTMLElement} target - Das ermittelte Ziel-Element, das dem CSS-Selektor entspricht.
 * @returns {void}
 */
/**
 * Erweiterte Optionseinstellungen für den DOM-Event-Listener.
 * @typedef {AddEventListenerOptions & { signal?: AbortSignal }} DelegateOptions
 */