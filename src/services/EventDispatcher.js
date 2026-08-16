import { LoggerService } from "./LoggerService.js";

/**
 * Zentrale Event-Dispatcher-Klasse des Aspis-Frameworks.
 * Bietet Publisher-Subscriber-Funktionalitäten (Pub/Sub), asynchrone Event-Verteilung via Microtasks,
 * Klick-Außerhalb-Erkennung (Click-Outside) sowie die Verwaltung globaler Dokument-Events.
 * 
 * @public
 */
export class EventDispatcher {
    /**
     * Interne Map von Event-Namen auf deren registrierte Callback-Sets.
     * @internal
     * @type {ListenersMap}
     */
    #listeners = new Map();

    /**
     * Das konfigurierte Event-Manifest der Instanz.
     * @internal
     * @type {EventManifest}
     */
    #eventManifest;

    /**
     * Referenz auf den gebundenen Handler für das globale Klick-Event.
     * @internal
     * @type {GlobalClickHandler | null}
     */
    #clickTrackerHandler = null;

    /**
     * Erzeugt eine neue Instanz des EventDispatchers.
     * 
     * @public
     * @param {EventManifest} [eventManifest={}] - Optionales Event-Manifest zur Initialisierung.
     */
    constructor(eventManifest = {}) {
        this.#eventManifest = eventManifest;
        this.#initGlobalClickTracker();
    }

    /**
     * Registriert einen Event-Listener für ein bestimmtes Event.
     * 
     * @public
     * @template [T=any]
     * @param {string} eventName - Der Name des zu abonnierenden Events.
     * @param {EventListenerCallback<T>} callback - Die beim Event-Auslösen auszuführende Callback-Funktion.
     * @returns {UnsubscribeFunction} Eine Funktion zum Entfernen des registrierten Listeners.
     */
    on(eventName, callback) {
        if (typeof callback !== 'function') return () => {};

        if (!this.#listeners.has(eventName)) {
            this.#listeners.set(eventName, new Set());
        }

        this.#listeners.get(eventName).add(callback);
        return () => this.off(eventName, callback);
    }

    /**
     * Registriert einen Event-Listener, der nach der ersten Ausführung automatisch entfernt wird.
     * 
     * @public
     * @template [T=any]
     * @param {string} eventName - Der Name des zu abonnierenden Events.
     * @param {EventListenerCallback<T>} callback - Die einmalig auszuführende Callback-Funktion.
     * @returns {UnsubscribeFunction} Eine Funktion zum vorzeitigen Entfernen des Listeners.
     */
    once(eventName, callback) {
        if (typeof callback !== 'function') return () => {};

        const unsubscribe = this.on(eventName, (data) => {
            unsubscribe();
            callback(data);
        });

        return unsubscribe;
    }

    /**
     * Entfernt einen spezifischen Event-Listener für ein angegebenes Event.
     * 
     * @public
     * @template [T=any]
     * @param {string} eventName - Der Name des Events.
     * @param {EventListenerCallback<T>} callback - Die zu entfernende Callback-Funktion.
     * @returns {void}
     */
    off(eventName, callback) {
        const eventListeners = this.#listeners.get(eventName);
        if (eventListeners) {
            eventListeners.delete(callback);
            if (eventListeners.size === 0) {
                this.#listeners.delete(eventName);
            }
        }
    }

    /**
     * Löst ein Event asynchron über Microtasks aus und übergibt Daten an alle registrierten Listener.
     * 
     * @public
     * @template [T=any]
     * @param {string} eventName - Der Name des auszulösenden Events.
     * @param {T|null} [data=null] - Die mitzusendenden Daten (Payload).
     * @returns {void}
     */
    emit(eventName, data = null) {
        const eventListeners = this.#listeners.get(eventName);
        if (!eventListeners) return;

        const targets = Array.from(eventListeners);
        targets.forEach(callback => {
            Promise.resolve()
                .then(() => callback(data))
                .catch(error => {
                    LoggerService.error(`[EventDispatcher.emit()] Aspis [EventDispatcher]: Fehler bei '${eventName}':`, error);
                });
        });
    }

    /**
     * Registriert einen Callback, der ausgeführt wird, sobald ein Klick außerhalb des angegebenen HTML-Elements erfolgt.
     * 
     * @public
     * @param {HTMLElement} element - Das überwachte DOM-Element.
     * @param {ClickOutsideCallback} callback - Bei einem Klick außerhalb aufzurufende Funktion.
     * @returns {UnsubscribeFunction} Funktion zum Stoppen der Überwachung.
     */
    onClickOutside(element, callback) {
        if (!(element instanceof HTMLElement) || typeof callback !== 'function') {
            return () => {};
        }
        return this.on('document:click', (clickedElement) => {
            if (!element.contains(clickedElement)) {
                callback();
            }
        });
    }

    /**
     * Entfernt sämtliche registrierten Event-Listener.
     * 
     * @public
     * @returns {void}
     */
    clear() {
        this.#listeners.clear();
    }

    /**
     * Zerstört die Instanz, leert den Listener-Speicher und entfernt den globalen Document-Click-Tracker.
     * 
     * @public
     * @returns {void}
     */
    destroy() {
        this.clear();
        if (this.#clickTrackerHandler) {
            document.removeEventListener('click', this.#clickTrackerHandler);
            this.#clickTrackerHandler = null;
        }
    }

    /**
     * Initialisiert den globalen Document-Click-Tracker zur Verteilung von Klick-Events auf dem Dokument.
     * 
     * @internal
     * @returns {void}
     */
    #initGlobalClickTracker() {
        this.#clickTrackerHandler = (event) => {
            this.emit('document:click', event.target);
        };
        document.addEventListener('click', this.#clickTrackerHandler);
    }
}

/**
 * Unsubscribe-Funktion zum Wiederabmelden/Entfernen eines Event-Listeners.
 * @typedef {function(): void} UnsubscribeFunction
 */
/**
 * Callback-Funktion, die bei der Auslösung eines Events aufgerufen wird.
 * @template [T=any]
 * @typedef {function(T): void} EventListenerCallback
 */
/**
 * Callback-Funktion ohne Parameter, die bei Klicks außerhalb eines Ziel-Elements aufgerufen wird.
 * @typedef {function(): void} ClickOutsideCallback
 */
/**
 * Manifest- / Konfigurationsobjekt zur Definition von unterstützten Events oder Metadaten.
 * @typedef {Record<string, any>} EventManifest
 */
/**
 * Menge (Set) von registrierten Callback-Funktionen für ein spezifisches Event.
 * @template [T=any]
 * @typedef {Set<EventListenerCallback<T>>} EventListenerSet
 */
/**
 * Map zur Zuordnung von Event-Namen zu den jeweiligen Listener-Sets.
 * @typedef {Map<string, EventListenerSet>} ListenersMap
 */
/**
 * Event-Handler-Funktion für das globale Dokument-Klick-Event.
 * @typedef {function(MouseEvent): void} GlobalClickHandler
 */