import { BaseController } from "./";
import { ModelAccordion, ModelLoader } from "../models/";
import { ModifierDOM } from "../utils/";

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
 * @property {ModelAccordion | null} [model] - Die zugewiesene Model-Instanz.
 * @property {boolean} [isLoading] - Ladezustands-Flag.
 * @property {string} [error] - Fehlermeldung bei Datenladefehlern.
 */
/**
 * HTTP-Fetcher Service für AJAX/API-Anfragen.
 * @typedef {Object} Fetcher
 * @property {(url: string, params?: Record<string, any>, options?: { signal?: AbortSignal }) => Promise<any>} get - Führt eine HTTP GET-Anfrage aus.
 */
/**
 * Statische Utility-Klasse zur sicheren DOM-Manipulation.
 * @typedef {Object} ModifierDOM
 * @property {(element: Element | null, className: string, force?: boolean) => void} [toggleClass] - Schaltet CSS-Klassen um.
 * @property {(element: Element | null, attrName: string, value: any) => void} [attr] - Setzt ein Attribut am Element.
 */
/**
 * Rohdatenstruktur eines Akkordeon-Eintrags für die Initialisierung aus dem DOM oder API.
 * @typedef {Object} RawAccordionItem
 * @property {string} id - Eindeutige ID des Akkordeon-Eintrags.
 * @property {string} title - Titel/Überschrift des Eintrags.
 * @property {string} content - HTML- oder Text-Inhalt des Panels.
 * @property {boolean} isOpen - Flag, ob der Eintrag initial geöffnet ist.
 * @property {boolean} disabled - Flag, ob der Eintrag deaktiviert ist.
 */
/**
 * Ein einzelnen Akkordeon-Eintrag repräsentierendes Objekt im Model.
 * @typedef {Object} AccordionItem
 * @property {string} id - Eindeutige ID des Eintrags.
 * @property {string} title - Titel des Eintrags.
 * @property {string} content - Inhalt des Eintrags.
 * @property {boolean} isOpen - Aktueller Öffnungszustand.
 * @property {boolean} [disabled] - Status der Deaktivierung.
 * @property {() => Record<string, any>} [toRenderData] - Bereitet die Eintragsdaten für den Renderer auf.
 */
/**
 * Konfigurationsoptionen für die Instanziierung des `ModelAccordion`.
 * @typedef {Object} ModelAccordionOptions
 * @property {string} [layout='default'] - Das visuelle Layout-Template des Akkordeons.
 * @property {boolean} [singleOpen=false] - Steuert, ob immer nur ein Eintrag gleichzeitig geöffnet sein darf.
 */
/**
 * Instanz eines Akkordeon-Models im Aspis-Framework.
 * @typedef {Object} ModelAccordion
 * @property {AccordionItem[]} items - Die Liste aller Akkordeon-Einträge.
 * @property {boolean} singleOpen - Gibt an, ob der Exklusiv-Öffnungsmodus aktiv ist.
 * @property {(itemId: string) => AccordionItem | null} toggleItem - Schaltet den Zustand eines Eintrags um.
 * @property {() => Record<string, any>} toRenderData - Bereitet die Gesamtdaten für das Rendering vor.
 */
/**
 * Marker-Klasse oder Interface für Loader-Modelle.
 * @typedef {Object} ModelLoader
 */
/**
 * Konfigurationsoptionen für den ControllerAccordion.
 * @typedef {Object} ControllerOptions
 * @property {string} [sliceKey='features.accordionFeature'] - Key für den zugewiesenen State-Slice im Store.
 * @property {string} [layout] - Override für das Akkordeon-Layout.
 * @property {RenderService} [renderService] - Explizit übergebener RenderService.
 * @property {ObserverRegistry} [registry] - Registry-Instanz zur Dependency-Resolution.
 */
/**
 * State-Slice für das Akkordeon aus dem Store.
 * @typedef {Object} AccordionSlice
 * @property {ModelAccordion} [model] - Die aktuell zugewiesene Model-Instanz.
 */
/**
 * Event-Payload für das 'accordion:toggle' Dispatcher-Event.
 * @typedef {Object} AccordionToggleEventData
 * @property {string} id - ID des umgeschalteten Eintrags.
 * @property {boolean} isOpen - Neuer Öffnungszustand des Eintrags.
 * @property {Record<string, any> | AccordionItem} item - Die Daten oder das Model des Eintrags.
 * @property {HTMLElement} container - Das Container-Element des Akkordeons.
 */
/**
 * BaseController-Klasse, von der ControllerAccordion erbt.
 * @typedef {Object} BaseController
 * @property {HTMLElement} _container - DOM-Hauptcontainer der Komponente.
 * @property {Store} [_store] - Store-Instanz.
 * @property {EventDispatcher} [_dispatcher] - Dispatcher-Instanz.
 * @property {ControllerOptions} [_options] - Optionen-Objekt.
 * @property {string} _sliceKey - Key des State-Slices.
 * @property {Fetcher} fetcher - HTTP-Fetcher Service Instanz.
 * @property {AbortSignal} signal - Aktueller AbortSignal für Async-Operationen.
 * @property {(taskName: string) => AbortSignal} getSignal - Erstellt ein AbortSignal für eine spezifische Task.
 * @property {(taskName: string) => void} clearTask - Löscht eine registrierte Async-Task.
 * @property {(stateProxy: StateProxy, message: string) => void} setLoadingState - Setzt den Ladezustand im State.
 * @property {(eventName: string, selector: string, callback: (e: Event, target: HTMLElement) => void) => void} delegate - Delegiert Event-Listener.
 */

/**
 * Controller-Klasse des Aspis-Frameworks zur Steuerung von Akkordeon-Komponenten,
 * automatischem DOM-Parsing, Tastaturnavigation (A11y), API-Ladevorgängen und State-Synchronisation.
 * 
 * @public
 * @extends {BaseController}
 */
export class ControllerAccordion extends BaseController {
    /**
     * Zuweisung der internen Akkordeon-Model-Instanz.
     * @internal
     * @type {ModelAccordion | null}
     */
    #model = null;

    /**
     * Erstellt eine neue Instanz des ControllerAccordion.
     * 
     * @public
     * @param {HTMLElement} container - Das DOM-Haupt- oder Akkordeon-Element.
     * @param {Store} store - Die Store-Instanz für State-Updates.
     * @param {EventDispatcher} dispatcher - Event-Dispatcher für Entkopplung.
     * @param {ControllerOptions} [options={}] - Optionale Konfigurationen.
     */
    constructor(container, store, dispatcher, options = {}) {
        super(container, store, dispatcher, options);
        this._sliceKey = options.sliceKey || 'features.accordionFeature';
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
     * Initialisiert den Controller, lädt bei Bedarf externe Daten oder parst das bestehende DOM und bindet Events.
     * 
     * @public
     * @override
     * @returns {Promise<void>}
     */
    async onInit() {
        await super.onInit();
        if (this.signal.aborted) return;

        const url = this._container.dataset.url;
        if (url) {
            await this.loadData(url);
        } else {
            this.#scanDOMAndBuildModel();
        }

        if (this.signal.aborted) return;

        this.#bindDOMEvents();
    }

    /**
     * Reagiert auf State-Änderungen aus dem Store und aktualisiert bei neuem Model das UI vollständig.
     * 
     * @public
     * @override
     * @param {AccordionSlice} slice - Der geänderte State-Ausschnitt.
     * @returns {void}
     */
    onStateChange(slice) {
        if (slice?.model && this.#model !== slice.model) {
            this.#model = slice.model;
            this.#renderFull();
        }
    }

    /**
     * Lädt Akkordeon-Inhalte asynchron von einer REST-Schnittstelle und instanziiert das Model.
     * 
     * @public
     * @param {string} url - Endpunkt-URL zum Abrufen der Akkordeon-Daten.
     * @returns {Promise<void>}
     */
    async loadData(url) {
        const stateProxy = this._store?.getSlice(this._sliceKey);
        const signal = this.getSignal('loadData');

        try {
            if (stateProxy) {
                this.setLoadingState(stateProxy, 'Akkordeon-Inhalte werden geladen...');
            }

            const liveData = await this.fetcher.get(url, {}, { signal });

            if (signal.aborted) return;

            if (liveData) {
                const layout = this._container.dataset.layout || this._options?.layout || 'default';
                const singleOpen = this._container.dataset.singleOpen === 'true';

                if (typeof ModelAccordion !== 'undefined') {
                    this.#model = new ModelAccordion(liveData, { layout, singleOpen });
                }

                if (stateProxy) {
                    stateProxy.model = this.#model;
                }

                await this.#renderFull();
            }
        } catch (error) {
            if (error.name !== 'AbortError' && !signal.aborted) {
                if (stateProxy) stateProxy.error = error.message;
                LoggerService.error("[ControllerAccordion.loadData()] Fehler im loadData-Ablauf", error);
            }
        } finally {
            if (stateProxy && !signal.aborted) {
                stateProxy.isLoading = false;
            }
            this.clearTask('loadData');
        }
    }

    /**
     * Schaltet den Zustand (geöffnet/geschlossen) eines bestimmten Akkordeon-Eintrags um und sendet Events.
     * 
     * @public
     * @param {string} itemId - Die eindeutige ID des umzuschaltenden Eintrags.
     * @returns {void}
     */
    toggle(itemId) {
        if (!this.#model) return;

        const toggledItem = this.#model.toggleItem(itemId);
        if (!toggledItem) return;

        if (this.#model.singleOpen) {
            this.#model.items.forEach(item => this.#updateItemUI(item));
        } else {
            this.#updateItemUI(toggledItem);
        }

        if (this._dispatcher) {
            this._dispatcher.emit('accordion:toggle', {
                id: toggledItem.id,
                isOpen: toggledItem.isOpen,
                item: typeof toggledItem.toRenderData === 'function' ? toggledItem.toRenderData() : toggledItem,
                container: this._container
            });
        }
    }

    /**
     * Liest die bestehende HTML-Struktur im Container aus und baut daraus das `ModelAccordion` auf.
     * 
     * @internal
     * @returns {void}
     */
    #scanDOMAndBuildModel() {
        if (!this._container) return;

        const itemEls = this._container.querySelectorAll('[data-accordion-item]');
        const rawItems = [];

        itemEls.forEach(el => {
            const id = el.dataset.id || el.id;
            const triggerEl = el.querySelector('[data-target="trigger"]');
            const panelEl = el.querySelector('[data-target="panel"]');

            rawItems.push({
                id: id,
                title: triggerEl ? triggerEl.textContent.trim() : '',
                content: panelEl ? panelEl.innerHTML : '',
                isOpen: el.classList.contains('is-open') || triggerEl?.getAttribute('aria-expanded') === 'true',
                disabled: el.hasAttribute('data-disabled')
            });
        });

        const singleOpen = this._container.dataset.singleOpen === 'true';
        const layout = this._container.dataset.layout || this._options?.layout || 'default';

        if (typeof ModelAccordion !== 'undefined') {
            this.#model = new ModelAccordion(rawItems, { layout, singleOpen });
        }
    }

    /**
     * Registriert die Event-Listener für Klick- und Tastaturinteraktionen auf den Trigger-Elementen.
     * 
     * @internal
     * @returns {void}
     */
    #bindDOMEvents() {
        this.delegate('click', '[data-target="trigger"]', (event, target) => {
            const itemEl = target.closest('[data-accordion-item]');
            const itemId = itemEl?.dataset.id || itemEl?.id;

            if (itemId) {
                this.toggle(itemId);
            }
        });

        this.delegate('keydown', '[data-target="trigger"]', (event) => {
            this.#handleKeyDown(event);
        });
    }

    /**
     * Handhabt Tastatur-Navigation (ArrowDown, ArrowUp, Home, End) zwischen den Trigger-Buttons gemäß WAI-ARIA.
     * 
     * @internal
     * @param {KeyboardEvent} e - Das ausgelöste Keyboard-Event.
     * @returns {void}
     */
    #handleKeyDown(e) {
        if (!this._container) return;

        const triggers = Array.from(this._container.querySelectorAll('[data-target="trigger"]:not([disabled])'));
        if (triggers.length === 0) return;

        const currentIdx = triggers.indexOf(document.activeElement);
        if (currentIdx === -1) return;

        let nextIdx = currentIdx;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                nextIdx = (currentIdx + 1) % triggers.length;
                triggers[nextIdx].focus();
                break;

            case 'ArrowUp':
                e.preventDefault();
                nextIdx = (currentIdx - 1 + triggers.length) % triggers.length;
                triggers[nextIdx].focus();
                break;

            case 'Home':
                e.preventDefault();
                triggers[0].focus();
                break;

            case 'End':
                e.preventDefault();
                triggers[triggers.length - 1].focus();
                break;
        }
    }

    /**
     * Aktualisiert die visuellen Zustände (CSS-Klassen, ARIA-Attribute) eines einzelnen Eintrags im DOM.
     * 
     * @internal
     * @param {AccordionItem} item - Der zu aktualisierende Akkordeon-Eintrag.
     * @returns {void}
     */
    #updateItemUI(item) {
        if (!this._container || !(item instanceof ModelAccordion.Item || item?.id)) return;

        const itemEl = this._container.querySelector(`[data-accordion-item][data-id="${CSS.escape(item.id)}"]`) 
                    || this._container.querySelector(`#${CSS.escape(item.id)}`);

        if (!itemEl) return;

        const triggerEl = itemEl.querySelector('[data-target="trigger"]');
        const panelEl = itemEl.querySelector('[data-target="panel"]');

        if (typeof ModifierDOM !== 'undefined' && typeof ModifierDOM.toggleClass === 'function') {
            ModifierDOM.toggleClass(itemEl, 'is-open', item.isOpen);
            if (triggerEl) ModifierDOM.attr(triggerEl, 'aria-expanded', item.isOpen);
            if (panelEl) {
                ModifierDOM.toggleClass(panelEl, 'is-hidden', !item.isOpen);
                ModifierDOM.attr(panelEl, 'aria-hidden', !item.isOpen);
            }
        } else {
            itemEl.classList.toggle('is-open', Boolean(item.isOpen));
            if (triggerEl) triggerEl.setAttribute('aria-expanded', String(item.isOpen));
            if (panelEl) {
                panelEl.classList.toggle('is-hidden', !item.isOpen);
                panelEl.setAttribute('aria-hidden', String(!item.isOpen));
            }
        }
    }

    /**
     * Rendert die Akkordeon-Komponente vollständig neu via `RenderService`.
     * 
     * @internal
     * @returns {Promise<void>}
     */
    async #renderFull() {
        if (!this.#model || this.signal.aborted) return;

        try {
            let templateName = this._container.dataset.template || "accordion-component";

            if (typeof ModelLoader !== 'undefined' && this.#model instanceof ModelLoader) {
                templateName = this._container.dataset.loaderTemplate || "defaultSpinner";
            }

            const renderService = this.renderService;

            if (renderService && typeof renderService.paste === 'function') {
                await renderService.paste(this._container, templateName, this.#model.toRenderData());

                if (this.signal.aborted) return;
                LoggerService.debug(`[ControllerAccordion.#renderFull()] HTML für '${this._sliceKey}' erfolgreich im DOM aktualisiert.`);
            } else {
                LoggerService.warn("[ControllerAccordion.#renderFull()] RenderService ist nicht verfügbar.");
            }
        } catch (error) {
            if (!this.signal.aborted) {
                LoggerService.error("[ControllerAccordion.#renderFull()] Render-Fehler", error);
            }
        }
    }
}