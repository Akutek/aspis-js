import { BaseController } from "./";
import { ModelTable, ModelLoader } from "../models/";

/**
 * Registry-Interface zum Abrufen von Services im Aspis-Framework.
 * @typedef {Object} ObserverRegistry
 * @property {(key: string) => any} get - Holt eine registrierte Service-Instanz.
 */
/**
 * Service zum Rendern von HTML-Templates im DOM.
 * @typedef {Object} RenderService
 * @property {(container: HTMLElement, templateName: string, data: Record<string, any>) => Promise<void>} paste - Fügt gerendertes HTML in ein Element ein.
 */
/**
 * Event-Dispatcher des Frameworks für entkoppelte Kommunikation.
 * @typedef {Object} EventDispatcher
 * @property {(event: string, callback: (data?: any) => void) => void} [on] - Registriert einen Event-Listener.
 * @property {(event: string, data?: any) => void} [emit] - Löst ein Event aus.
 */
/**
 * Zentraler State-Store der Anwendung.
 * @typedef {Object} Store
 * @property {(sliceKey: string) => StateProxy | undefined} [getSlice] - Holt einen State-Slice-Proxy.
 * @property {(sliceKey: string) => any} [getState] - Holt den aktuellen Zustand eines State-Slices.
 */
/**
 * Proxy-Objekt für Reaktivität und Zustandsverwaltung eines Slices im Store.
 * @typedef {Object} StateProxy
 * @property {ModelTable | null} [model] - Die zugewiesene Model-Instanz.
 * @property {boolean} [isLoading] - Ladezustands-Flag.
 * @property {string} [error] - Fehlermeldung bei Datenladefehlern.
 */
/**
 * HTTP-Fetcher Service für AJAX/API-Anfragen.
 * @typedef {Object} Fetcher
 * @property {(url: string, params?: Record<string, any>, options?: { signal?: AbortSignal }) => Promise<any>} get - Führt eine HTTP GET-Anfrage aus.
 */
/**
 * Konfigurationsoptionen für die Instanziierung des `ModelTable`.
 * @typedef {Object} ModelTableOptions
 * @property {string} [layout='default'] - Das visuelle Layout-Template der Tabelle.
 */
/**
 * Instanz eines Tabellen-Models im Aspis-Framework.
 * @typedef {Object} ModelTable
 * @property {() => Record<string, any>} toRenderData - Bereitet die Tabellendaten für das Rendering vor.
 */
/**
 * Marker-Klasse oder Interface für Loader-Modelle.
 * @typedef {Object} ModelLoader
 */
/**
 * Key-Value-Map für Filter-, Sortier- und Paginierungsparameter beim Neuladen der Tabellendaten.
 * @typedef {Record<string, string | number | boolean | null | undefined>} TableFilterPayload
 */
/**
 * Event-Payload für dynamische Tabellenaktionen ('table:[action]').
 * @typedef {Object} TableActionEventData
 * @property {string} id - Eindeutige ID der Tabellenzeile (`data-row-id`).
 * @property {string} action - Ausgeführter Aktionsname (`data-action`).
 * @property {HTMLElement} target - Das auslösende DOM-Element.
 */
/**
 * Konfigurationsoptionen für den ControllerTable.
 * @typedef {Object} ControllerTableOptions
 * @property {string} [sliceKey='features.tableFeature'] - Key für den zugewiesenen State-Slice im Store.
 * @property {string} [layout] - Override für das Tabellen-Layout.
 * @property {RenderService} [renderService] - Explizit übergebener RenderService.
 * @property {ObserverRegistry} [registry] - Registry-Instanz zur Dependency-Resolution.
 */
/**
 * State-Slice für die Tabelle aus dem Store.
 * @typedef {Object} TableSlice
 * @property {ModelTable} [model] - Die aktuell zugewiesene Model-Instanz.
 */
/**
 * BaseController-Klasse, von der ControllerTable erbt.
 * @typedef {Object} BaseController
 * @property {HTMLElement} _container - DOM-Hauptcontainer der Komponente.
 * @property {Store} [_store] - Store-Instanz.
 * @property {EventDispatcher} [_dispatcher] - Dispatcher-Instanz.
 * @property {ControllerTableOptions} [_options] - Optionen-Objekt.
 * @property {string} _sliceKey - Key des State-Slices.
 * @property {Fetcher} fetcher - HTTP-Fetcher Service Instanz.
 * @property {AbortSignal} signal - Aktueller AbortSignal für Async-Operationen.
 * @property {(taskName: string) => AbortSignal} getSignal - Erstellt ein AbortSignal für eine spezifische Task.
 * @property {(taskName: string) => void} clearTask - Löscht eine registrierte Async-Task.
 * @property {(stateProxy: StateProxy, message: string) => void} setLoadingState - Setzt den Ladezustand im State.
 * @property {(eventName: string, selector: string, callback: (e: Event, target: HTMLElement) => void) => void} delegate - Delegiert Event-Listener.
 */

/**
 * Controller-Klasse des Aspis-Frameworks zur Steuerung von datengetriebenen Tabellen,
 * inklusive Sortierung, Paginierung, Row-Actions, dynamischem Nachladen und Template-Rendering.
 * 
 * @public
 * @extends {BaseController}
 */
export class ControllerTable extends BaseController {
    /**
     * Zuweisung der internen Tabellen-Model-Instanz.
     * @internal
     * @type {ModelTable | null}
     */
    #model = null;

    /**
     * Erstellt eine neue Instanz des ControllerTable.
     * 
     * @public
     * @param {HTMLElement} container - Das DOM-Haupt- oder Tabellen-Element.
     * @param {Store} store - Die Store-Instanz für State-Updates.
     * @param {EventDispatcher} dispatcher - Event-Dispatcher für Entkopplung.
     * @param {ControllerTableOptions} [options={}] - Optionale Konfigurationen.
     */
    constructor(container, store, dispatcher, options = {}) {
        super(container, store, dispatcher, options);
        this._sliceKey = options.sliceKey || 'features.tableFeature';
    }

    /**
     * Ermittelt den verfügbaren RenderService (entweder aus den Optionen oder der Registry).
     * 
     * @public
     * @type {RenderService | null}
     */
    get renderService() {
        return this._options?.renderService || this._options?.registry?.get('renderService') || null;
    }

    /**
     * Initialisiert den Controller, delegiert DOM-Events für Sortierung, Aktionen und Paginierung und stößt den ersten Ladevorgang an.
     * 
     * @public
     * @override
     * @returns {Promise<void>}
     * @throws {Error} Wirft einen Fehler, wenn am Container-Element das erforderliche `data-url`-Attribut fehlt.
     */
    async onInit() {
        await super.onInit();
        if (this.signal.aborted) return;

        this.delegate('click', 'th[data-sort-key]', (event, target) => {
            const sortKey = target.dataset.sortKey;
            const currentOrder = target.dataset.sortOrder || 'asc';
            const nextOrder = currentOrder === 'asc' ? 'desc' : 'asc';
            this.reload({ sort: sortKey, order: nextOrder });
        });

        this.delegate('click', '[data-action]', (event, target) => {
            const action = target.dataset.action;
            const row = target.closest('[data-row-id]');
            const rowId = row?.dataset.rowId;
            if (action && rowId) {
                this._dispatcher?.emit(`table:${action}`, { id: rowId, action, target });
            }
        });

        this.delegate('click', '[data-page]', (event, target) => {
            const page = target.dataset.page;
            if (page) {
                this.reload({ page });
            }
        });

        const url = this._container.dataset.url;
        if (!url) {
            throw new Error(`Aspis [ControllerTable]: Fehlendes 'data-url'-Attribut am Container <${this._container.tagName.toLowerCase()}>.`);
        }

        await this.loadData(url);
    }

    /**
     * Reagiert auf State-Änderungen aus dem Store und rendert das UI neu, wenn ein neues Model übergeben wurde.
     * 
     * @public
     * @override
     * @param {TableSlice} slice - Der geänderte State-Ausschnitt.
     * @returns {void}
     */
    onStateChange(slice) {
        if (slice?.model && this.#model !== slice.model) {
            this.#model = slice.model;
            this.#render();
        }
    }

    /**
     * Lädt Tabellendaten asynchron von einer REST-Schnittstelle und instanziiert das Model.
     * 
     * @public
     * @param {string} url - Endpunkt-URL zum Abrufen der Tabellendaten.
     * @returns {Promise<void>}
     */
    async loadData(url) {
        const stateProxy = this._store?.getSlice(this._sliceKey);
        if (!stateProxy) return;

        const signal = this.getSignal('loadData');

        try {
            this.setLoadingState(stateProxy, 'Tabelle wird geladen...');

            const liveData = await this.fetcher.get(url, {}, { signal });

            if (signal.aborted) return;

            if (liveData) {
                const layout = this._container.dataset.layout || this._options?.layout || 'default';
                if (typeof ModelTable !== 'undefined') {
                    stateProxy.model = new ModelTable(liveData, { layout });
                }
            }
        } catch (error) {
            if (error.name !== 'AbortError' && !signal.aborted) {
                stateProxy.error = error.message;
                LoggerService.error("[ControllerTable.loadData()] Fehler im loadData-Ablauf", error);
            }
        } finally {
            if (stateProxy && !signal.aborted) {
                stateProxy.isLoading = false;
            }
            this.clearTask('loadData');
        }
    }

    /**
     * Lädt die Tabellendaten unter Beibehaltung der Basis-URL mit aktualisierten Query-Parametern (Sortierung, Paginierung, Filter) neu.
     * 
     * @public
     * @param {TableFilterPayload} [filterPayload={}] - Key-Value-Paare der anzuwendenden URL-Suchparameter.
     * @returns {void}
     */
    reload(filterPayload = {}) {
        const baseUrl = this._container?.dataset?.url;
        if (!baseUrl) return;

        try {
            const urlObj = new URL(baseUrl, window.location.origin);

            Object.entries(filterPayload).forEach(([key, val]) => {
                if (val !== undefined && val !== null && val !== '') {
                    urlObj.searchParams.set(key, val);
                }
            });

            this.loadData(urlObj.toString());
        } catch (e) {
            LoggerService.error("[ControllerTable.reload()] Fehler beim Generieren der Reload-URL", e);
        }
    }

    /**
     * Rendert die Tabellen-Komponente vollständig neu via `RenderService`.
     * 
     * @internal
     * @returns {Promise<void>}
     */
    async #render() {
        if (!this.#model || this.signal.aborted) return;

        try {
            let templateName = this._container.dataset.template || "meine-tabelle";

            if (typeof ModelLoader !== 'undefined' && this.#model instanceof ModelLoader) {
                templateName = this._container.dataset.loaderTemplate || "defaultSpinner";
            }

            const renderService = this.renderService;

            if (renderService && typeof renderService.paste === 'function') {
                await renderService.paste(this._container, templateName, this.#model.toRenderData());

                if (this.signal.aborted) return;
                LoggerService.debug(`[ControllerTable.#render()] HTML für '${this._sliceKey}' erfolgreich ins DOM injiziert.`);
            } else {
                LoggerService.warn("[ControllerTable.#render()] RenderService ist nicht verfügbar.");
            }
        } catch (error) {
            if (!this.signal.aborted) {
                LoggerService.error("[ControllerTable.#render()] Render-Fehler", error);
            }
        }
    }
}