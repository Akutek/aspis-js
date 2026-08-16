import { TargetResolver, ModifierDOM } from "./";

/**
 * Funktion zum Aufheben eines aktiven Effect-Subscriptions.
 * @typedef {() => void} UnsubscribeFunction
 */
/**
 * Konfiguration für ein bestimmtes Target inklusive Klassen-Bindings.
 * @typedef {Object} TargetConfig
 * @property {string} selector - Der CSS-Selektor des Ziel-Elements.
 * @property {Record<string, string>} [bindClasses] - Mapping von State-Eigenschaften zu Style-Schlüsseln.
 */
/**
 * Konfiguration innerhalb eines State-Slices.
 * @typedef {Object} SliceConfig
 * @property {Record<string, TargetConfig>} [targets] - Target-Konfigurationen für die Elementauflösung.
 * @property {Record<string, string>} [styles] - Mapping von Style-Schlüsseln zu CSS-Klassennamen.
 */
/**
 * Repräsentiert ein State-Slice im Aspis-Store.
 * @typedef {Object.<string, any>} StateSlice
 * @property {SliceConfig} [config] - Konfiguration für Targets und Styles.
 */
/**
 * Interface/Struktur des Aspis State-Stores.
 * @typedef {Object} Store
 * @property {(sliceKey: string) => StateSlice | undefined} getSlice - Liefert das State-Slice für einen Schlüssel zurück.
 * @property {(effectFn: () => void) => UnsubscribeFunction} effect - Registriert eine reaktive Effect-Funktion.
 */
/**
 * Map, die Ziel-Namen den aufgelösten HTML-Elementen zuordnet.
 * @typedef {Map<string, HTMLElement>} ResolvedTargetsMap
 */

/**
 * Bindet reaktive State-Änderungen eines Slices automatisch an DOM-Element-Klassen im Aspis-Framework.
 * 
 * @public
 */
export class ManifestBinder {
    /**
     * Das übergeordnete HTML-Container-Element.
     * @internal
     * @type {HTMLElement}
     */
    #container;

    /**
     * Die Aspis Store-Instanz.
     * @internal
     * @type {Store}
     */
    #store;

    /**
     * Der Schlüssel des gebundenen State-Slices.
     * @internal
     * @type {string}
     */
    #sliceKey;

    /**
     * Map der aktuell aufgelösten Ziel-DOM-Elemente.
     * @internal
     * @type {ResolvedTargetsMap}
     */
    #resolvedTargets;

    /**
     * Liste von Unsubscribe-Funktionen für registrierte Store-Effects.
     * @internal
     * @type {UnsubscribeFunction[]}
     */
    #unsubscribeEffects = [];

    /**
     * Erstellt eine neue Instanz des ManifestBinders.
     * 
     * @public
     * @param {HTMLElement} container - Das Wurzel-HTML-Element für die Target-Suche.
     * @param {Store} store - Die Store-Instanz für reaktive Bindings.
     * @param {string} sliceKey - Der eindeutige Schlüssel des zu bindenden State-Slices.
     */
    constructor(container, store, sliceKey) {
        this.#container = container;
        this.#store = store;
        this.#sliceKey = sliceKey;
        this.#resolvedTargets = new Map();
    }

    /**
     * Löst die Ziel-Elemente auf und etabliert die reaktiven Klasse-Bindings basierend auf der Slice-Konfiguration.
     * 
     * @public
     * @returns {void}
     */
    bind() {
        const slice = this.#store.getSlice(this.#sliceKey);
        const targetsConfig = slice?.config?.targets;
        const stylesConfig = slice?.config?.styles;

        if (!targetsConfig || !stylesConfig) return;
        this.#resolvedTargets = TargetResolver.resolve(this.#container, targetsConfig);

        Object.entries(targetsConfig).forEach(([targetName, targetConfig]) => {
            const element = this.#resolvedTargets.get(targetName);
            if (!element || !targetConfig.bindClasses) return;

            Object.entries(targetConfig.bindClasses).forEach(([stateProp, styleKey]) => {
                const className = stylesConfig[styleKey];
                if (!className) return;

                const unsub = this.#store.effect(() => {
                    const currentSlice = this.#store.getSlice(this.#sliceKey);
                    const isConditionMet = !!currentSlice[stateProp];
                    ModifierDOM.toggleClass(element, className, isConditionMet);
                });

                this.#unsubscribeEffects.push(unsub);
            });
        });
        
        LoggerService.info(`[ManifestBinder.bind()] Auto-Bindings für '${this.#sliceKey}' erfolgreich etabliert.`);
    }

    /**
     * Löst alle aktiven Subscriptions und leert die aufgelösten Referenzen sauber auf.
     * 
     * @public
     * @returns {void}
     */
    unbind() {
        this.#unsubscribeEffects.forEach(unsub => unsub());
        this.#unsubscribeEffects = [];
        this.#resolvedTargets.clear();
        LoggerService.info(`[ManifestBinder.unbind()] Auto-Bindings für '${this.#sliceKey}' sauber gelöst.`);
    }
}