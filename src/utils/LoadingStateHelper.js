import { ModelLoadingBar } from "../models/ModelLoadingBar.js";
import { ModelSpinner } from "../models/ModelSpinner.js";

/**
 * Utility-Klasse des Aspis-Frameworks zur Steuerung und Initialisierung von visuellen Ladezuständen.
 * Liest Konfigurationsattribute (`data-loader`, `data-loader-template`) aus einem DOM-Container aus
 * und weist dem State-Proxy das entsprechende Lade-Modell zu.
 * 
 * @public
 */
export class LoadingStateHelper {
    /**
     * Versetzt den übergebenen State-Proxy in den Ladezustand und weist ihm ein passendes Lade-Modell zu.
     * 
     * @public
     * @static
     * @param {HTMLElement | null} container - Das DOM-Container-Element, das optionale `data-loader`- und `data-loader-template`-Attribute enthalten kann.
     * @param {LoadingStateProxy} stateProxy - Das reaktive State-Objekt, dessen Eigenschaften `error`, `isLoading` und `model` aktualisiert werden.
     * @param {string} [message='Lade...'] - Die anzuzeigende Lade-Nachricht.
     * @returns {void}
     */
    static apply(container, stateProxy, message = 'Lade...') {
        if (!stateProxy) return;

        stateProxy.error = null;
        stateProxy.isLoading = true;

        const loaderType = container?.dataset?.loader || 'spinner';
        const loaderTemplate = container?.dataset?.loaderTemplate || 'defaultSpinner';

        if (loaderType === 'bar' && typeof ModelLoadingBar !== 'undefined') {
            stateProxy.model = new ModelLoadingBar({ layout: loaderTemplate, message, progress: 0 });
        } else if (typeof ModelSpinner !== 'undefined') {
            stateProxy.model = new ModelSpinner({ layout: loaderTemplate, message });
        } else {
            stateProxy.model = {
                toRenderData: () => ({ layout: loaderTemplate, message })
            };
        }
    }
}

/**
 * Datenstruktur, die von der `toRenderData`-Methode eines Lade-Modells zurückgegeben wird.
 * @typedef {Object} LoadingRenderData
 * @property {string} layout - Das zu verwendende Template/Layout für die Ladeanzeige.
 * @property {string} message - Die anzuzeigende Lade-Nachricht.
 * @property {number} [progress] - Optionaler Fortschrittswert der Ladeanzeige.
 */
/**
 * Fallback-Objekt für Lade-Modelle, falls weder `ModelLoadingBar` noch `ModelSpinner` verfügbar sind.
 * @typedef {Object} LoadingModelFallback
 * @property {function(): LoadingRenderData} toRenderData - Gibt die für das Rendering benötigten Daten zurück.
 */
/**
 * Schnittstelle für Instanzen von `ModelLoadingBar`.
 * @typedef {Object} ModelLoadingBarInstance
 * @property {function(): LoadingRenderData} [toRenderData] - Gibt die Rendering-Daten zurück.
 */
/**
 * Schnittstelle für Instanzen von `ModelSpinner`.
 * @typedef {Object} ModelSpinnerInstance
 * @property {function(): LoadingRenderData} [toRenderData] - Gibt die Rendering-Daten zurück.
 */
/**
 * Typ für alle unterstützten Lade-Modelle.
 * @typedef {ModelLoadingBarInstance | ModelSpinnerInstance | LoadingModelFallback} LoadingModel
 */
/**
 * Reaktiver State-Proxy, der vom `LoadingStateHelper` beim Starten eines Ladevorgangs aktualisiert wird.
 * @typedef {Object} LoadingStateProxy
 * @property {any} error - Fehlerzustand (wird beim Anwenden des Ladezustands auf `null` zurückgesetzt).
 * @property {boolean} isLoading - Kennzeichnung, ob ein Ladevorgang aktiv ist.
 * @property {LoadingModel | null} [model] - Das erzeugte Lade-Modell zur visuellen Repräsentation.
 */