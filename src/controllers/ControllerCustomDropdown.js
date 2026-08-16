import { BaseController } from "./";
import { ModelCustomDropdown, ModelLoader } from "../models";
import { FormFieldService } from "../services";
import { ModifierDOM } from "../utils";

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
 * Event-Dispatcher des Frameworks für entkoppelte Kommunikation und globale Events.
 * @typedef {Object} EventDispatcher
 * @property {(event: string, callback: (data?: any) => void) => void} [on] - Registriert einen Event-Listener.
 * @property {(event: string, data?: any) => void} [emit] - Löst ein Event aus.
 * @property {(element: HTMLElement, callback: () => void) => UnsubscribeCallback} [onClickOutside] - Registriert einen Click-Outside-Listener für ein DOM-Element.
 */
/**
 * Funktion zum Entfernen eines Event-Listeners (Unsubscribe).
 * @typedef {() => void} UnsubscribeCallback
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
 * @property {ModelCustomDropdown | null} [model] - Die zugewiesene Model-Instanz.
 * @property {boolean} [isLoading] - Ladezustands-Flag.
 */
/**
 * HTTP-Fetcher Service für AJAX/API-Anfragen.
 * @typedef {Object} Fetcher
 * @property {(url: string, params?: Record<string, any>, options?: { signal?: AbortSignal }) => Promise<any>} get - Führt eine HTTP GET-Anfrage aus.
 */
/**
 * Statische Utility-Klasse zur sicheren DOM-Manipulation.
 * @typedef {Object} ModifierDOM
 * @property {(element: Element | null, className: string, force?: boolean) => void} toggleClass - Schaltet CSS-Klassen um.
 * @property {(element: Element | null, className: string) => void} addClass - Fügt eine CSS-Klasse hinzu.
 * @property {(element: Element | null, className: string) => void} removeClass - Entfernt eine CSS-Klasse.
 * @property {(element: Element | null, attrName: string, value: any) => void} attr - Setzt ein Attribut am Element.
 * @property {(element: HTMLElement | null) => void} show - Blendet ein Element ein.
 * @property {(element: HTMLElement | null) => void} hide - Blendet ein Element aus.
 */
/**
 * Service zur Ermittlung von Formularfeld-Eigenschaften aus DOM-Elementen.
 * @typedef {Object} FormFieldService
 * @property {(container: HTMLElement) => string | undefined} getFieldName - Ermittelt den logischen Namen eines Formularfeldes.
 */
/**
 * Validierungsregeln für das Dropdown-Feld.
 * @typedef {Record<string, any>} FieldRules
 */
/**
 * Repräsentiert einen einzelnen Eintrag in der Dropdown-Auswahlliste.
 * @typedef {Object} DropdownItem
 * @property {any} value - Der Wert des Eintrags.
 * @property {string} label - Die Anzeigebeschriftung des Eintrags.
 * @property {boolean} [disabled] - Flag, ob der Eintrag deaktiviert ist.
 */
/**
 * Konstruktor-Optionen für die Modellierung des `ModelCustomDropdown`.
 * @typedef {Object} ModelCustomDropdownOptions
 * @property {string} [layout='default'] - Das visuelle Layout-Template des Dropdowns.
 * @property {any} [value=''] - Der initial ausgewählte Wert.
 * @property {FieldRules} [rules={}] - Die anzuwendenden Validierungsregeln.
 */
/**
 * Instanz des Custom-Dropdown-Models im Aspis-Framework.
 * @typedef {Object} ModelCustomDropdown
 * @property {boolean} isOpen - Gibt an, ob das Dropdown aktuell geöffnet ist.
 * @property {any} value - Der aktuell gewählte Wert.
 * @property {number} focusedIndex - Index des aktuell per Tastatur fokussierten Eintrags.
 * @property {string | null} error - Die aktuelle Fehlermeldung oder null.
 * @property {DropdownItem | null} selectedItem - Das aktuell gewählte Item-Objekt.
 * @property {(open: boolean) => void} setOpen - Setzt den Öffnungszustand.
 * @property {(options: Array<DropdownItem | any>) => void} setOptions - Aktualisiert die Auswahlliste.
 * @property {(step: number) => void} moveFocus - Verschiebt den Tastaturfokus relativ um `step`.
 * @property {() => boolean} selectFocused - Wählt das aktuell fokussierte Item aus.
 * @property {(value: any) => boolean} selectByValue - Wählt ein Item anhand seines Werts aus und gibt zurück, ob sich der Wert geändert hat.
 * @property {() => boolean} validate - Führt die Validierung durch und gibt das Ergebnis zurück.
 * @property {() => Record<string, any>} toRenderData - Bereitet die Datenstruktur für das Template-Rendering vor.
 */
/**
 * Konfigurationsoptionen für den ControllerCustomDropdown.
 * @typedef {Object} ControllerOptions
 * @property {string} [sliceKey='features.dropdownFeature'] - Key für den zugewiesenen State-Slice im Store.
 * @property {string} [layout] - Override für das Dropdown-Layout.
 * @property {RenderService} [renderService] - Explizit übergebener RenderService.
 * @property {ObserverRegistry} [registry] - Registry-Instanz zur Dependency-Resolution.
 */
/**
 * State-Slice für das Custom-Dropdown aus dem Store.
 * @typedef {Object} DropdownSlice
 * @property {ModelCustomDropdown} [model] - Die aktuell zugewiesene Model-Instanz.
 * @property {boolean} [isLoading] - Ladezustand der Daten.
 */
/**
 * Event-Payload für das 'dropdown:change' Dispatcher-Event.
 * @typedef {Object} DropdownChangeEventData
 * @property {string | undefined} name - Name des Dropdown-Feldes.
 * @property {any} value - Ausgewählter Wert.
 * @property {string | undefined} label - Anzeigetext des ausgewählten Eintrags.
 * @property {HTMLElement} container - Das Container-Element des Dropdowns.
 */
/**
 * BaseController-Klasse, von der ControllerCustomDropdown erbt.
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
 * Controller-Klasse des Aspis-Frameworks zur Steuerung von benutzerdefinierten Dropdown-Komponenten,
 * inklusive ARIA-Barrierefreiheit, Tastaturnavigation (A11y), Asynchronem Laden und Event-Handling.
 * 
 * @public
 * @extends {BaseController}
 */
export class ControllerCustomDropdown extends BaseController {
    /**
     * Zuweisung der internen Model-Instanz des Custom Dropdowns.
     * @internal
     * @type {ModelCustomDropdown | null}
     */
    #model = null;

    /**
     * Unsubscribe-Funktion für das Click-Outside Event des Dropdowns.
     * @internal
     * @type {UnsubscribeCallback | null}
     */
    #clickOutsideUnsub = null;

    /**
     * Erstellt eine neue Instanz des ControllerCustomDropdown.
     * 
     * @public
     * @param {HTMLElement} container - Das DOM-Haupt- oder Dropdown-Element.
     * @param {Store} store - Die Store-Instanz für State-Updates.
     * @param {EventDispatcher} dispatcher - Event-Dispatcher für Entkopplung.
     * @param {ControllerOptions} [options={}] - Optionale Konfigurationen.
     */
    constructor(container, store, dispatcher, options = {}) {
        super(container, store, dispatcher, options);
        this._sliceKey = options.sliceKey || 'features.dropdownFeature';
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
     * Initialisiert den Controller, baut das Model auf, registriert Event-Listener und stößt ggf. das Laden von Optionen an.
     * 
     * @public
     * @override
     * @returns {Promise<void>}
     */
    async onInit() {
        await super.onInit();
        if (this.signal.aborted) return;

        const initialVal = this._container.dataset.value || '';
        let rules = {};
        if (this._container.dataset.rules) {
            try {
                rules = JSON.parse(this._container.dataset.rules);
            } catch (e) {
                console.warn('[ControllerCustomDropdown]: Ungültiges JSON in data-rules', e);
            }
        }
        
        const layout = this._options?.layout || this._container.dataset.layout || 'default';

        if (typeof ModelCustomDropdown !== 'undefined') {
            this.#model = new ModelCustomDropdown([], { 
                layout: layout,
                value: initialVal,
                rules: rules
            });
        }

        this.#bindDOMEvents();

        const url = this._container.dataset.url;
        if (url) {
            await this.loadOptions(url);
        }
    }

    /**
     * Reagiert auf State-Änderungen aus dem Store und synchronisiert das interne Model sowie die UI.
     * 
     * @public
     * @override
     * @param {DropdownSlice} slice - Der geänderte State-Ausschnitt.
     * @returns {void}
     */
    onStateChange(slice) {
        if (slice && slice.model && this.#model !== slice.model) {
            this.#model = slice.model;
            this.#renderFull();
        }
    }

    /**
     * Lädt Dropdown-Optionen asynchron von einem Server-Endpunkt.
     * 
     * @public
     * @param {string} url - Die URL-Adresse, von der die Optionen geladen werden sollen.
     * @returns {Promise<void>}
     */
    async loadOptions(url) {
        const stateProxy = this._store?.getSlice(this._sliceKey);
        
        try {
            if (stateProxy) this.setLoadingState(stateProxy, 'Optionen laden...');

            const data = await this.fetcher.get(url, {}, { signal: this.getSignal('loadOptions') });

            if (this.signal.aborted) return;

            if (data && this.#model) {
                this.#model.setOptions(data);
                if (stateProxy) stateProxy.model = this.#model;
                await this.#renderFull();
            }
        } catch (error) {
            if (error.name !== 'AbortError' && !this.signal.aborted) {
                console.error('[ControllerCustomDropdown]: Fehler beim Laden der Optionen', error);
            }
        } finally {
            if (stateProxy && !this.signal.aborted) stateProxy.isLoading = false;
            this.clearTask('loadOptions');
        }
    }

    /**
     * Setzt ARIA-Attribute auf dem Container und bindet DOM-Events (Klick, Option-Auswahl, Tastatur) via Delegation.
     * 
     * @internal
     * @returns {void}
     */
    #bindDOMEvents() {
        if (!this._container) return;

        if (typeof ModifierDOM !== 'undefined' && typeof ModifierDOM.attr === 'function') {
            ModifierDOM.attr(this._container, 'tabindex', '0');
            ModifierDOM.attr(this._container, 'role', 'combobox');
        } else {
            this._container.setAttribute('tabindex', '0');
            this._container.setAttribute('role', 'combobox');
        }

        this.delegate('click', '[data-target="trigger"]', () => {
            this.toggle();
        });

        this.delegate('click', '[data-option-value]', (e, target) => {
            if (!target.hasAttribute('data-disabled')) {
                const value = target.dataset.optionValue;
                this.selectValue(value);
            }
        });

        this.delegate('keydown', ':scope', (e) => {
            this.#handleKeyDown(e);
        });
    }

    /**
     * Handhabt Tastatur-Eingaben für Barrierefreiheit (Pfeiltasten, Enter, Space, Escape).
     * 
     * @internal
     * @param {KeyboardEvent} e - Das ausgelöste Keyboard-Event.
     * @returns {void}
     */
    #handleKeyDown(e) {
        if (!this.#model) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                if (!this.#model.isOpen) {
                    this.open();
                } else {
                    this.#model.moveFocus(1);
                    this.#updateFocusUI();
                }
                break;

            case 'ArrowUp':
                e.preventDefault();
                if (!this.#model.isOpen) {
                    this.open();
                } else {
                    this.#model.moveFocus(-1);
                    this.#updateFocusUI();
                }
                break;

            case 'Enter':
            case ' ':
                e.preventDefault();
                if (!this.#model.isOpen) {
                    this.open();
                } else {
                    if (this.#model.selectFocused()) {
                        this.selectValue(this.#model.value);
                    }
                }
                break;

            case 'Escape':
                if (this.#model.isOpen) {
                    e.preventDefault();
                    this.close();
                }
                break;
        }
    }

    /**
     * Schaltet den Öffnungszustand des Dropdowns um (öffnet es, wenn geschlossen; schließt es, wenn geöffnet).
     * 
     * @public
     * @returns {void}
     */
    toggle() {
        if (!this.#model) return;
        this.#model.isOpen ? this.close() : this.open();
    }

    /**
     * Öffnet das Dropdown, aktualisiert ARIA-Attribute und registriert den Click-Outside-Listener.
     * 
     * @public
     * @returns {void}
     */
    open() {
        if (!this.#model || this.#model.isOpen) return;

        this.#model.setOpen(true);
        const listEl = this._container.querySelector('[data-target="list"]');

        if (typeof ModifierDOM !== 'undefined') {
            if (listEl) ModifierDOM.show(listEl);
            ModifierDOM.addClass(this._container, 'is-open');
            ModifierDOM.attr(this._container, 'aria-expanded', 'true');
        } else {
            if (listEl) listEl.style.display = '';
            this._container.classList.add('is-open');
            this._container.setAttribute('aria-expanded', 'true');
        }

        this.#updateFocusUI();

        if (this._dispatcher && typeof this._dispatcher.onClickOutside === 'function') {
            this.#clickOutsideUnsub = this._dispatcher.onClickOutside(this._container, () => this.close());
        }
    }

    /**
     * Schließt das Dropdown, entfernt den Click-Outside-Listener und stößt die UI-Validierung an.
     * 
     * @public
     * @returns {void}
     */
    close() {
        if (!this.#model || !this.#model.isOpen) return;

        this.#model.setOpen(false);
        const listEl = this._container.querySelector('[data-target="list"]');

        if (typeof ModifierDOM !== 'undefined') {
            if (listEl) ModifierDOM.hide(listEl);
            ModifierDOM.removeClass(this._container, 'is-open');
            ModifierDOM.attr(this._container, 'aria-expanded', 'false');
        } else {
            if (listEl) listEl.style.display = 'none';
            this._container.classList.remove('is-open');
            this._container.setAttribute('aria-expanded', 'false');
        }

        if (this.#clickOutsideUnsub) {
            this.#clickOutsideUnsub();
            this.#clickOutsideUnsub = null;
        }
        this.validateUI();
    }

    /**
     * Wählt einen Wert im Model aus, synchronisiert versteckte Input-Felder, löst Event-Notifications aus und schließt das Dropdown.
     * 
     * @public
     * @param {any} value - Der auszuwählende Wert.
     * @returns {void}
     */
    selectValue(value) {
        if (!this.#model) return;

        const changed = this.#model.selectByValue(value);
        if (changed) {
            this.#syncWithNativeInput();

            const fieldName = typeof FormFieldService !== 'undefined' && typeof FormFieldService.getFieldName === 'function'
                ? FormFieldService.getFieldName(this._container)
                : (this._container.name || this._container.dataset.name);

            const selectedItem = this.#model.selectedItem;
            const itemLabel = (typeof ModelCustomDropdown !== 'undefined' && selectedItem instanceof ModelCustomDropdown.Item)
                ? selectedItem.label
                : selectedItem?.label;

            if (this._dispatcher) {
                this._dispatcher.emit('dropdown:change', {
                    name: fieldName,
                    value: this.#model.value,
                    label: itemLabel,
                    container: this._container
                });
            }

            const labelEl = this._container.querySelector('[data-target="label"]');
            if (labelEl && selectedItem) {
                labelEl.textContent = itemLabel;
            }
        }

        this.close();
        this.validateUI();
    }

    /**
     * Validiert das Model und aktualisiert die visuellen Fehlerklassen sowie Fehlermeldungen im DOM.
     * 
     * @public
     * @returns {void}
     */
    validateUI() {
        if (!this.#model) return;

        const isValid = this.#model.validate();

        if (typeof ModifierDOM !== 'undefined') {
            ModifierDOM.toggleClass(this._container, 'is-invalid', !isValid);
            ModifierDOM.toggleClass(this._container, 'is-valid', isValid && this.#model.value !== '');
        } else {
            this._container.classList.toggle('is-invalid', !isValid);
            this._container.classList.toggle('is-valid', isValid && this.#model.value !== '');
        }

        const errorEl = this._container.querySelector('[data-target="error"]');
        if (errorEl) {
            errorEl.textContent = this.#model.error || '';
            if (typeof ModifierDOM !== 'undefined') {
                ModifierDOM.toggleClass(errorEl, 'is-hidden', isValid);
            } else {
                errorEl.classList.toggle('is-hidden', isValid);
            }
        }
    }

    /**
     * Aktualisiert den visuellen Fokuszustand der Listenelemente bei Tastaturnavigation und scrollt das Element in den Sichtbereich.
     * 
     * @internal
     * @returns {void}
     */
    #updateFocusUI() {
        if (!this.#model) return;

        const optionEls = this._container.querySelectorAll('[data-option-value]');
        optionEls.forEach((el, idx) => {
            const isFocused = idx === this.#model.focusedIndex;
            if (typeof ModifierDOM !== 'undefined') {
                ModifierDOM.toggleClass(el, 'is-focused', isFocused);
            } else {
                el.classList.toggle('is-focused', isFocused);
            }

            if (isFocused && typeof el.scrollIntoView === 'function') {
                el.scrollIntoView({ block: 'nearest' });
            }
        });
    }

    /**
     * Synchronisiert den aktuell gewählten Wert mit einem versteckten HTML `<input>` Element für native Formularübertragungen.
     * 
     * @internal
     * @returns {void}
     */
    #syncWithNativeInput() {
        if (!this.#model) return;

        const fieldName = typeof FormFieldService !== 'undefined' && typeof FormFieldService.getFieldName === 'function'
            ? FormFieldService.getFieldName(this._container)
            : (this._container.name || this._container.dataset.name);

        if (!fieldName) return;

        const escapedName = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(fieldName) : fieldName;
        let hiddenInput = this._container.querySelector(`input[name="${escapedName}"]`);

        if (!hiddenInput) {
            hiddenInput = document.createElement('input');
            hiddenInput.type = 'hidden';
            hiddenInput.name = fieldName;
            this._container.appendChild(hiddenInput);
        }
        hiddenInput.value = this.#model.value;
    }

    /**
     * Rendert die Komponente neu unter Verwendung des konfigurierten `RenderService`.
     * 
     * @internal
     * @returns {Promise<void>}
     */
    async #renderFull() {
        if (!this.#model || this.signal.aborted) return;

        try {
            let templateName = this._container.dataset.template || "custom-dropdown";

            if (typeof ModelLoader !== 'undefined' && this.#model instanceof ModelLoader) {
                templateName = this._container.dataset.loaderTemplate || "defaultSpinner";
            }

            const renderService = this.renderService;

            if (renderService && typeof renderService.paste === 'function') {
                await renderService.paste(this._container, templateName, this.#model.toRenderData());
            } else {
                console.warn("[ControllerCustomDropdown]: RenderService ist nicht verfügbar.");
            }
        } catch (error) {
            if (!this.signal.aborted) {
                console.error("[ControllerCustomDropdown]: Render-Fehler", error);
            }
        }
    }

    /**
     * Lifecycle-Hook beim Zerstören der Controller-Instanz. Räumt Event-Subscriptions auf.
     * 
     * @public
     * @override
     * @returns {void}
     */
    onDestroy() {
        if (this.#clickOutsideUnsub) {
            this.#clickOutsideUnsub();
            this.#clickOutsideUnsub = null;
        }
    }
}