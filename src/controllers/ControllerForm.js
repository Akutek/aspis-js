import { LoggerService } from "../services/LoggerService.js";
import { BaseController } from "./BaseController.js";
import { FormFieldService } from "../services/FormFieldService.js";
import { ModelForm } from "../models/ModelForm.js";
import { ModifierDOM } from "../utils/ModifierDOM.js";

/**
 * Controller-Klasse des Aspis-Frameworks zur Steuerung von HTML-Formularen,
 * automatischen Event-Bindings, Validierungen, Rendering und Absendevorgängen (Submit).
 * 
 * @public
 * @extends {BaseController}
 */
export class ControllerForm extends BaseController {
    /**
     * Zuweisung der internen Formular-Model-Instanz.
     * @internal
     * @type {ModelForm | null}
     */
    #model = null;

    /**
     * Steuert, ob beim `focusout`-Event eine Validierung ausgelöst werden soll.
     * @internal
     * @type {boolean}
     */
    #validateOnBlur = true;

    /**
     * Steuert, ob bei jedem `input`-Event sofort validiert werden soll.
     * @internal
     * @type {boolean}
     */
    #validateOnChange = false;

    /**
     * Erstellt eine neue Instanz des ControllerForm.
     * 
     * @public
     * @param {HTMLElement} container - Das DOM-Haupt- oder Formular-Element.
     * @param {Store} store - Die Store-Instanz für State-Updates.
     * @param {EventDispatcher} dispatcher - Event-Dispatcher für Entkopplung.
     * @param {ControllerFormOptions} [options={}] - Optionale Konfigurationen.
     */
    constructor(container, store, dispatcher, options = {}) {
        super(container, store, dispatcher, options);
        this._sliceKey = options.sliceKey || 'forms.mainForm';
        this.#validateOnBlur = options.validateOnBlur ?? true;
        this.#validateOnChange = options.validateOnChange ?? false;
    }

    /**
     * Ermittelt den verfügbaren RenderService (entweder aus Optionen oder der Registry).
     * 
     * @public
     * @type {RenderService | null}
     */
    get renderService() {
        return this._options?.renderService || this._options?.registry?.get('renderService') || null;
    }

    /**
     * Initialisiert den Controller, liest das DOM-Formular aus und bindet Events.
     * 
     * @public
     * @override
     * @returns {Promise<void>}
     */
    async onInit() {
        await super.onInit();
        if (this.signal.aborted) return;

        this.#initializeFormModel();
        this.#bindFormEvents();
    }

    /**
     * Reagiert auf State-Änderungen aus dem Store und aktualisiert ggf. das Model sowie das UI.
     * 
     * @public
     * @override
     * @param {FormSlice} slice - Der geänderte State-Ausschnitt.
     * @returns {void}
     */
    onStateChange(slice) {
        if (slice?.model && this.#model !== slice.model) {
            this.#model = slice.model;
            this.#renderFull();
        }
    }

    /**
     * Liest alle Formular-Knoten aus dem Container aus, baut die Initialdaten sowie Validierungsregeln auf
     * und instanziiert das `ModelForm`.
     * 
     * @internal
     * @returns {void}
     */
    #initializeFormModel() {
        if (!this._container) return;

        const initialFields = {};
        const formElements = this._container.querySelectorAll('input, select, textarea, [data-name]');

        formElements.forEach(el => {
            const name = typeof FormFieldService !== 'undefined' && typeof FormFieldService.getFieldName === 'function'
                ? FormFieldService.getFieldName(el)
                : (el.name || el.dataset.name);

            if (!name || initialFields[name]) return;

            const val = typeof FormFieldService !== 'undefined' && typeof FormFieldService.getValue === 'function'
                ? FormFieldService.getValue(el)
                : el.value;

            const rules = this.#extractRulesFromElement(el);

            initialFields[name] = {
                value: val,
                rules: rules
            };
        });

        if (typeof ModelForm !== 'undefined') {
            this.#model = new ModelForm(initialFields, { layout: this._options?.layout });
        }
    }

    /**
     * Extrahiert Validierungsregeln aus HTML-Attributen (`data-rules`, `required`, `type="email"`, `minlength`).
     * 
     * @internal
     * @param {Element | HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement} el - Das zu prüfende DOM-Element.
     * @returns {FieldRules} Die extrahierten Validierungsregeln.
     */
    #extractRulesFromElement(el) {
        let rules = {};

        if (el.dataset.rules) {
            try {
                rules = JSON.parse(el.dataset.rules);
            } catch (e) {
                LoggerService.warn(`[ControllerForm.#extractRulesFromElement()] Ungültiges JSON in data-rules für ${el.name}`, e);
            }
        }

        if (el.hasAttribute('required') && !rules.required) {
            rules.required = 'Dieses Feld ist ein Pflichtfeld.';
        }
        if (el.type === 'email' && !rules.email) {
            rules.email = 'Bitte gib eine gültige E-Mail-Adresse ein.';
        }
        if (el.hasAttribute('minlength') && !rules.minLength) {
            rules.minLength = {
                length: parseInt(el.getAttribute('minlength'), 10),
                message: `Mindestens ${el.getAttribute('minlength')} Zeichen erforderlich.`
            };
        }

        return rules;
    }

    /**
     * Registriert alle notwendigen DOM- und Dispatcher-Event-Listener via Delegation.
     * 
     * @internal
     * @returns {void}
     */
    #bindFormEvents() {
        const fieldSelector = 'input, select, textarea, [data-name]';

        this.delegate('input', fieldSelector, (e) => this.#handleInput(e));
        this.delegate('change', fieldSelector, (e) => this.#handleChange(e));
        this.delegate('focusout', fieldSelector, (e) => this.#handleBlur(e));

        this.delegate('submit', 'form, :scope', (e) => {
            e.preventDefault();
            this.submit();
        });

        if (this._dispatcher) {
            this._dispatcher.on('dropdown:change', (data) => {
                if (data && data.name && this._container.contains(data.container)) {
                    this.#updateField(data.name, data.value, true);
                }
            });
        }
    }

    /**
     * Event-Handler für das `input`-Event auf Formularfeldern.
     * 
     * @internal
     * @param {Event} e - Das ausgelöste Input-Event.
     * @returns {void}
     */
    #handleInput(e) {
        const name = typeof FormFieldService !== 'undefined' && typeof FormFieldService.getFieldName === 'function'
            ? FormFieldService.getFieldName(e.target)
            : (e.target.name || e.target.dataset.name);

        if (!name || !this.#model) return;

        const val = typeof FormFieldService !== 'undefined' && typeof FormFieldService.getValue === 'function'
            ? FormFieldService.getValue(e.target)
            : e.target.value;

        if (this.#validateOnChange) {
            this.#updateField(name, val, true);
        } else {
            this.#model.setFieldValue(name, val, false);
        }
    }

    /**
     * Event-Handler für das `change`-Event auf Formularfeldern.
     * 
     * @internal
     * @param {Event} e - Das ausgelöste Change-Event.
     * @returns {void}
     */
    #handleChange(e) {
        const name = typeof FormFieldService !== 'undefined' && typeof FormFieldService.getFieldName === 'function'
            ? FormFieldService.getFieldName(e.target)
            : (e.target.name || e.target.dataset.name);

        if (name && this.#model) {
            const val = typeof FormFieldService !== 'undefined' && typeof FormFieldService.getValue === 'function'
                ? FormFieldService.getValue(e.target)
                : e.target.value;

            this.#updateField(name, val, true);
        }
    }

    /**
     * Event-Handler für das `focusout` (Blur)-Event auf Formularfeldern.
     * 
     * @internal
     * @param {FocusEvent} e - Das ausgelöste Blur/Focusout-Event.
     * @returns {void}
     */
    #handleBlur(e) {
        if (!this.#validateOnBlur || !this.#model) return;

        const name = typeof FormFieldService !== 'undefined' && typeof FormFieldService.getFieldName === 'function'
            ? FormFieldService.getFieldName(e.target)
            : (e.target.name || e.target.dataset.name);

        if (name) {
            const val = typeof FormFieldService !== 'undefined' && typeof FormFieldService.getValue === 'function'
                ? FormFieldService.getValue(e.target)
                : e.target.value;

            this.#updateField(name, val, true);
        }
    }

    /**
     * Aktualisiert den Wert eines Feldes im Model und stößt optional das UI-Update an.
     * 
     * @internal
     * @param {string} name - Name des Feldes.
     * @param {any} value - Neuer Feldwert.
     * @param {boolean} [triggerValidation=true] - Gibt an, ob die Feld-UI direkt validiert werden soll.
     * @returns {void}
     */
    #updateField(name, value, triggerValidation = true) {
        if (!this.#model) return;

        this.#model.setFieldValue(name, value, true);

        if (triggerValidation) {
            this.updateFieldUI(name);
        }
    }

    /**
     * Aktualisiert die visuelle Darstellung eines Feldes (Fehlermeldungen, CSS-Klassen, ARIA-Attribute).
     * 
     * @public
     * @param {string} name - Der Name des zu aktualisierenden Feldes.
     * @returns {void}
     */
    updateFieldUI(name) {
        if (!this.#model || !this._container) return;

        const field = this.#model.getField(name);
        if (!field) return;

        const escapedName = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(name) : name;
        const fieldEl = this._container.querySelector(`[name="${escapedName}"], [data-name="${escapedName}"]`);
        if (!fieldEl) return;

        const wrapper = fieldEl.closest('.form-group') || fieldEl.parentElement;
        const hasError = Boolean(field.error && field.isTouched);

        if (typeof ModifierDOM !== 'undefined' && typeof ModifierDOM.toggleClass === 'function') {
            ModifierDOM.toggleClass(wrapper, 'has-error', hasError);
            ModifierDOM.toggleClass(fieldEl, 'is-invalid', hasError);
            ModifierDOM.attr(fieldEl, 'aria-invalid', hasError);
        } else {
            if (wrapper) wrapper.classList.toggle('has-error', hasError);
            fieldEl.classList.toggle('is-invalid', hasError);
            fieldEl.setAttribute('aria-invalid', String(hasError));
        }

        const errorEl = wrapper?.querySelector('[data-target="field-error"]') || wrapper?.querySelector('.error-message');
        if (errorEl) {
            errorEl.textContent = hasError ? field.error : '';
            if (typeof ModifierDOM !== 'undefined' && typeof ModifierDOM.toggleClass === 'function') {
                ModifierDOM.toggleClass(errorEl, 'is-hidden', !hasError);
            } else {
                errorEl.classList.toggle('is-hidden', !hasError);
            }
        }
    }

    /**
     * Validiert das gesamte Formular und sendet die Daten an den Endpunkt via Fetcher oder Web-API.
     * 
     * @public
     * @returns {Promise<void>}
     * @throws {Error} Wirft einen Fehler bei HTTP- oder Netzwerk-Übertragungsfehlern.
     */
    async submit() {
        if (!this.#model || this.#model.isSubmitting || !this._container) return;

        const isValid = this.#model.validateAll();
        const payload = this.#model.toPayload();

        Object.keys(payload).forEach(name => this.updateFieldUI(name));

        if (!isValid) {
            this.#focusFirstInvalidField();
            return;
        }

        this.#model.setSubmitting(true);
        this.#toggleSubmittingUI(true);

        const url = this._container.action || this._container.dataset.url;
        const method = (this._container.method || this._container.dataset.method || 'POST').toUpperCase();
        const submitSignal = this.getSignal('formSubmit');

        try {
            let response;
            if (typeof this.fetcher?.request === 'function') {
                response = await this.fetcher.request(url, {
                    method: method,
                    body: payload,
                    signal: submitSignal
                });
            } else if (method === 'POST' && typeof this.fetcher?.post === 'function') {
                response = await this.fetcher.post(url, payload, { signal: submitSignal });
            } else {
                const res = await fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                    signal: submitSignal
                });
                if (!res.ok) throw new Error(`HTTP Fehler ${res.status}`);
                response = await res.json();
            }

            if (submitSignal.aborted || this.signal.aborted) return;

            this.#model.setSubmitResult(true);
            this.#showFormMessage('Formular erfolgreich abgesendet!', 'success');

            if (this._dispatcher) {
                this._dispatcher.emit('form:success', { response, payload: this.#model.toPayload() });
            }

            if (this._container.dataset.resetOnSuccess !== 'false') {
                this.reset();
            }

        } catch (error) {
            if (error.name !== 'AbortError' && !submitSignal.aborted && !this.signal.aborted) {
                const errorMsg = error.message || 'Beim Absenden ist ein Fehler aufgetreten.';
                this.#model.setSubmitResult(false, errorMsg);
                this.#showFormMessage(errorMsg, 'error');

                if (this._dispatcher) {
                    this._dispatcher.emit('form:error', { error });
                }
            }
        } finally {
            if (!this.signal.aborted && this.#model) {
                this.#model.setSubmitting(false);
                this.#toggleSubmittingUI(false);
            }
            this.clearTask('formSubmit');
        }
    }

    /**
     * Setzt das Model und das Formular-UI auf den Ursprungszustand zurück.
     * 
     * @public
     * @returns {void}
     */
    reset() {
        if (!this.#model || !this._container) return;

        this.#model.reset();
        if (typeof this._container.reset === 'function') {
            this._container.reset();
        }

        const fields = this.#model.toPayload();
        Object.keys(fields).forEach(name => {
            const escapedName = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(name) : name;
            const fieldEl = this._container.querySelector(`[name="${escapedName}"]`);
            if (fieldEl) {
                const wrapper = fieldEl.closest('.form-group') || fieldEl.parentElement;
                if (typeof ModifierDOM !== 'undefined' && typeof ModifierDOM.removeClass === 'function') {
                    ModifierDOM.removeClass(wrapper, 'has-error');
                    ModifierDOM.removeClass(fieldEl, 'is-invalid');
                } else {
                    if (wrapper) wrapper.classList.remove('has-error');
                    fieldEl.classList.remove('is-invalid');
                }
            }
        });

        this.#hideFormMessage();
    }

    /**
     * Setzt den Fokus auf das erste ungültige Feld im Formular.
     * 
     * @internal
     * @returns {void}
     */
    #focusFirstInvalidField() {
        if (!this.#model || !this._container) return;
        const errors = this.#model.getErrors();
        const firstErrorName = Object.keys(errors)[0];
        if (firstErrorName) {
            const escapedName = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(firstErrorName) : firstErrorName;
            const el = this._container.querySelector(`[name="${escapedName}"], [data-name="${escapedName}"]`);
            if (el && typeof el.focus === 'function') {
                el.focus();
            }
        }
    }

    /**
     * Aktiviert oder deaktiviert den Absende-Status im UI (Submit-Button Loading-State, CSS-Klassen).
     * 
     * @internal
     * @param {boolean} isSubmitting - Flag für den Absendevorgang.
     * @returns {void}
     */
    #toggleSubmittingUI(isSubmitting) {
        if (!this._container) return;

        const submitBtn = this._container.querySelector('[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = isSubmitting;
            if (typeof ModifierDOM !== 'undefined' && typeof ModifierDOM.toggleClass === 'function') {
                ModifierDOM.toggleClass(submitBtn, 'is-loading', isSubmitting);
            } else {
                submitBtn.classList.toggle('is-loading', isSubmitting);
            }
        }

        if (typeof ModifierDOM !== 'undefined' && typeof ModifierDOM.toggleClass === 'function') {
            ModifierDOM.toggleClass(this._container, 'is-submitting', isSubmitting);
        } else {
            this._container.classList.toggle('is-submitting', isSubmitting);
        }
    }

    /**
     * Zeigt eine allgemeine Formular-Statusmeldung (Erfolg/Fehler) im DOM an.
     * 
     * @internal
     * @param {string} msg - Die anzuzeigende Nachricht.
     * @param {FormMessageType} [type='error'] - Der Typ der Nachricht ('error' oder 'success').
     * @returns {void}
     */
    #showFormMessage(msg, type = 'error') {
        if (!this._container) return;

        const msgEl = this._container.querySelector('[data-target="form-message"]');
        if (msgEl) {
            msgEl.textContent = msg;
            if (typeof ModifierDOM !== 'undefined' && typeof ModifierDOM.removeClass === 'function') {
                ModifierDOM.removeClass(msgEl, 'is-hidden success error');
                ModifierDOM.addClass(msgEl, type);
            } else {
                msgEl.classList.remove('is-hidden', 'success', 'error');
                msgEl.classList.add(type);
            }
        }
    }

    /**
     * Blendet die allgemeine Formular-Statusmeldung im DOM aus.
     * 
     * @internal
     * @returns {void}
     */
    #hideFormMessage() {
        if (!this._container) return;

        const msgEl = this._container.querySelector('[data-target="form-message"]');
        if (msgEl) {
            if (typeof ModifierDOM !== 'undefined' && typeof ModifierDOM.addClass === 'function') {
                ModifierDOM.addClass(msgEl, 'is-hidden');
            } else {
                msgEl.classList.add('is-hidden');
            }
        }
    }

    /**
     * Rendert die Formular-Komponente vollständig neu via `RenderService`.
     * 
     * @internal
     * @returns {Promise<void>}
     */
    async #renderFull() {
        if (!this.#model || this.signal.aborted) return;

        try {
            const templateName = this._container.dataset.template || "form-component";
            const renderService = this.renderService;

            if (renderService && typeof renderService.paste === 'function') {
                const renderData = typeof this.#model.toRenderData === 'function' 
                    ? this.#model.toRenderData() 
                    : this.#model.toPayload();

                await renderService.paste(this._container, templateName, renderData);

                if (this.signal.aborted) return;
                LoggerService.debug(`[ControllerForm.#renderFull()] HTML für '${this._sliceKey}' erfolgreich im DOM aktualisiert.`);
            }
        } catch (error) {
            if (!this.signal.aborted) {
                LoggerService.error("[ControllerForm.#renderFull()] Render-Fehler", error);
            }
        }
    }
}

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
 * @property {(event: string, callback: (data?: any) => void) => void} on - Registriert einen Event-Listener.
 * @property {(event: string, data?: any) => void} emit - Löst ein Event aus.
 */
/**
 * Zentraler State-Store der Anwendung.
 * @typedef {Object} Store
 * @property {(sliceKey: string) => any} getState - Holt den aktuellen Zustand eines Redux/State-Slices.
 */
/**
 * HTTP-Fetcher Service für AJAX/API-Anfragen.
 * @typedef {Object} Fetcher
 * @property {(url: string, options?: { method?: string, body?: any, signal?: AbortSignal }) => Promise<any>} [request] - Generische Request-Methode.
 * @property {(url: string, payload?: any, options?: { signal?: AbortSignal }) => Promise<any>} [post] - Convenience-Methode für POST-Requests.
 */
/**
 * Statische Utility-Klasse zur sicheren DOM-Manipulation.
 * @typedef {Object} ModifierDOM
 * @property {(element: Element | null, className: string, force?: boolean) => void} toggleClass - Schaltet CSS-Klassen um.
 * @property {(element: Element | null, className: string) => void} addClass - Fügt eine CSS-Klasse hinzu.
 * @property {(element: Element | null, className: string) => void} removeClass - Entfernt eine CSS-Klasse.
 * @property {(element: Element | null, attrName: string, value: any) => void} attr - Setzt ein Attribut am Element.
 */
/**
 * Validierungsregeln für ein Formularfeld.
 * @typedef {Record<string, any>} FieldRules
 */
/**
 * Repräsentiert die Datenstruktur eines einzelnen Feldes im Model.
 * @typedef {Object} FormFieldState
 * @property {any} value - Der aktuelle Wert des Feldes.
 * @property {FieldRules} rules - Die zugehörigen Validierungsregeln.
 * @property {string | null} [error] - Aktueller Fehler oder null.
 * @property {boolean} [isTouched] - Flag, ob das Feld angefasst wurde.
 */
/**
 * Instanz eines Formular-Models im Aspis-Framework.
 * @typedef {Object} ModelForm
 * @property {boolean} isSubmitting - Status der Formular-Übermittlung.
 * @property {(name: string, value: any, triggerValidation?: boolean) => void} setFieldValue - Setzt einen Feldwert.
 * @property {(name: string) => FormFieldState | undefined} getField - Holt ein Feld-Objekt.
 * @property {() => boolean} validateAll - Validiert alle Felder des Formulars.
 * @property {() => Record<string, any>} toPayload - Gibt die Formulardaten als Plain Object zurück.
 * @property {(isSubmitting: boolean) => void} setSubmitting - Setzt den Submitting-Status.
 * @property {(success: boolean, errorMsg?: string) => void} setSubmitResult - Speichert das Absendeergebnis.
 * @property {() => void} reset - Setzt das Model auf den Initialzustand zurück.
 * @property {() => Record<string, string>} getErrors - Gibt alle aktuellen Feldfehler zurück.
 * @property {() => Record<string, any>} [toRenderData] - Bereitet Daten für das Rendering auf.
 */
/**
 * Konfigurationsoptionen für den ControllerForm.
 * @typedef {Object} ControllerFormOptions
 * @property {string} [sliceKey='forms.mainForm'] - Key für den zugewiesenen State-Slice im Store.
 * @property {boolean} [validateOnBlur=true] - Steuert, ob Felder beim Verlassen (Blur) validiert werden.
 * @property {boolean} [validateOnChange=false] - Steuert, ob Felder bei jeder Eingabe (Input) validiert werden.
 * @property {any} [layout] - Optionales Layout-Objekt für das Model.
 * @property {RenderService} [renderService] - Expliziter RenderService.
 * @property {ObserverRegistry} [registry] - Registry-Instanz zum Auflösen von Services.
 */
/**
 * State-Slice für Formulardaten aus dem Zentral-Store.
 * @typedef {Object} FormSlice
 * @property {ModelForm} [model] - Die aktuell übergebene Model-Instanz.
 */
/**
 * Typ für Meldungsarten des Formulars.
 * @typedef {'error' | 'success' | string} FormMessageType
 */
/**
 * Event-Payload für das 'dropdown:change' Dispatcher-Event.
 * @typedef {Object} DropdownChangeEventData
 * @property {string} name - Feldname des Dropdowns.
 * @property {any} value - Neuer Wert des Dropdowns.
 * @property {HTMLElement} container - DOM-Container des Dropdowns zur Zugehörigkeitsprüfung.
 */
/**
 * Event-Payload beim erfolgreichen Absenden des Formulars ('form:success').
 * @typedef {Object} FormSuccessEventData
 * @property {any} response - Die vom Server zurückgelieferte Antwort.
 * @property {Record<string, any>} payload - Die abgesendeten Formulardaten.
 */
/**
 * Event-Payload beim fehlerhaften Absenden des Formulars ('form:error').
 * @typedef {Object} FormErrorEventData
 * @property {Error | any} error - Das aufgetretene Fehler-Objekt.
 */