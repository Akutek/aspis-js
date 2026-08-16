import { ReactiveEffect } from "./";
/**
 * Konfiguration für ein spezifisches DOM-Target innerhalb eines State-Slices.
 * @typedef {Object} TargetConfig
 * @property {string} selector - CSS-Selektor für das Ziel-Element.
 * @property {Record<string, string>} [bindClasses] - Mapping von State-Keys zu CSS-Klassenschlüsseln.
 */
/**
 * Konfiguration und Style-Binding eines State-Slices.
 * @typedef {Object} SliceConfig
 * @property {Record<string, string>} [styles] - Mapping von Style-Konstanten zu CSS-Klassen.
 * @property {Record<string, TargetConfig>} [targets] - Ziel-Elemente und deren Bindings.
 */
/**
 * Definition eines einzelnen State-Slices im Store.
 * @typedef {Object} StateSlice
 * @property {Record<string, any>} [initialState] - Initialer Zustand des Slices.
 * @property {SliceConfig} [config] - Layout- und Binding-Konfiguration.
 */
/**
 * Struktur der `state-manifest.json`.
 * @typedef {Object} StateManifest
 * @property {{ strictMode?: boolean }} [settings] - Globale Framework-Einstellungen.
 * @property {Record<string, string>} [globalStyles] - App-weit gültige CSS-Statusklassen.
 * @property {Record<string, StateSlice>} [slices] - Deklarierte Zustandsobjekte (z. B. 'app.ui', 'features.filter').
 */
/**
 * Detail-Payload für das CustomEvent `aspis:data-mutation`.
 * @typedef {Object} AspisMutationEventDetail
 * @property {string | string[]} path - Der oder die geänderten State-Pfade.
 * @property {string[]} paths - Liste aller geänderten Pfade.
 * @property {string} [dependsOn] - Wert aus dem `data-depends-on` Attribut des Ziel-Elements.
 */
/**
 * Interface für einen reaktiven Effekt.
 * @typedef {Object} ReactiveEffect
 * @property {function(): void} run - Führt die verknüpfte Funktion aus und erfasst Abhängigkeiten.
 * @property {function(): void} stop - Stoppt den Effekt und entfernt ihn aus allen Trackern.
 * @property {function(string): void} trackPath - Registriert einen beobachteten Pfad im Effekt.
 */

/**
 * Der reaktive Haupt-Store des Aspis-Frameworks.
 * Verwaltet den hierarchischen Zustand über Proxies, verarbeitet Abhängigkeiten zwischen States/DOM,
 * feuert CustomEvents und verwalte Reaktivität via Effekte.
 * 
 * @public
 * @extends {EventTarget}
 */
export class Store extends EventTarget {
    /**
     * Das geladene State-Manifest der Anwendung.
     * @public
     * @type {StateManifest}
     */
    manifest;

    /**
     * Zuordnung von State-Pfade auf Sets von Reaktivitäts-Effekten (`ReactiveEffect`).
     * @internal
     * @type {Map<string, Set<ReactiveEffect>>}
     */
    #listeners = new Map();

    /**
     * Kaskadierende Logik-Abhängigkeiten zwischen State-Pfaden (Parent-Pfad -> Set von Child-Pfaden).
     * @internal
     * @type {Map<string, Set<string>>}
     */
    #dependencies = new Map();

    /**
     * Direkt an State-Pfade gebundene DOM-Elemente für automatische UI-Updates.
     * @internal
     * @type {Map<string, Set<HTMLElement>>}
     */
    #domDependencies = new Map();

    /**
     * Unstrukturierte Rohdaten-Ablage des Stores.
     * @internal
     * @type {Record<string, any>}
     */
    #data = {};

    /**
     * Das tiefen-geproxyte Objekt, das Zugriff auf den hierarchischen State bietet.
     * @internal
     * @type {Object}
     */
    #stateProxy;

    /**
     * Caching-Speicher für erzeugte Sub-Proxies zur Vermeidung doppelter Proxy-Instanziierung.
     * @internal
     * @type {WeakMap<object, object>}
     */
    #proxyCache = new WeakMap();

    /**
     * Gesammelte Konfigurationen (`config`) aller deklarierten State-Slices aus dem Manifest.
     * @internal
     * @type {Record<string, SliceConfig>}
     */
    #configs = {};

    /**
     * Queue für ausstehende Reaktivitäts-Effekte vor dem nächsten Flush.
     * @internal
     * @type {Set<ReactiveEffect>}
     */
    #effectQueue = new Set();

    /**
     * Map von DOM-Elementen auf deren ausstehende geänderte State-Pfade vor dem Batch-Update.
     * @internal
     * @type {Map<HTMLElement, Set<string>>}
     */
    #pendingDomUpdates = new Map();

    /**
     * Flag, ob aktuell ein Asynchroner Batch-Flush eingetaktet ist.
     * @internal
     * @type {boolean}
     */
    #isFlushPending = false;

    /**
     * Die ID des laufenden `requestAnimationFrame`-Timers (oder null).
     * @internal
     * @type {number|null}
     */
    #flushTimerId = null;

    /**
     * Der Stack der aktuell verarbeiteten Effekte zur automatischen Pfad-Erfassung (Tracking).
     * @internal
     * @type {ReactiveEffect[]}
     */
    #effectStack = [];

    /**
     * Flag, ob unvollständige Mutationen Fehler werfen oder nur warnen sollen.
     * @internal
     * @type {boolean}
     */
    #strictMode;

    /**
     * Erlaubte Root-Namespaces für Slices im Aspis-Framework.
     * @public
     * @static
     * @type {readonly string[]}
     */
    static ALLOWED_NAMESPACES = ['app', 'features', 'shared'];

    /**
     * Erstellt eine neue Store-Instanz, baut das Proxy-System anhand des Manifests auf
     * und injiziert die initiale Daten-Struktur.
     * 
     * @public
     * @param {StateManifest} [manifest={}] - Das geladene State-Manifest (`state-manifest.json`).
     * @param {Record<string, any>} [initialData={}] - Initiale Daten für `#data`.
     */
    constructor(manifest = {}, initialData = {}) {
        this.manifest = manifest;
        this.#strictMode = manifest.settings?.strictMode ?? true;
        super();
        this.#data = initialData;
        
        const extractedState = {
            app: {},
            features: {},
            shared: {}
        };

        if (manifest && manifest.slices) {
            Object.entries(manifest.slices).forEach(([slicePath, sliceContent]) => {
                const parts = slicePath.split('.');
                const namespace = parts[0];

                if (parts.length >= 2 && Store.ALLOWED_NAMESPACES.includes(namespace)) {
                    const sliceKey = parts.slice(1).join('.');
                    if (!extractedState[namespace]) extractedState[namespace] = {};
                    
                    const sliceObj = sliceContent.initialState || {};
                    
                    Object.defineProperty(sliceObj, 'config', {
                        value: sliceContent.config || {},
                        writable: true,
                        enumerable: false,
                        configurable: true
                    });

                    extractedState[namespace][sliceKey] = sliceObj;
                    this.#configs[slicePath] = sliceContent.config || {};
                } else {
                    console.warn(
                        `Aspis [Store-Bootstrap]: Ignoriere ungültigen Manifest-Pfad '${slicePath}'. ` +
                        `Erlaubte Namespaces: ${Store.ALLOWED_NAMESPACES.join(', ')} (Format: 'namespace.key').`
                    );
                }
            });
        }
        
        this.#stateProxy = this.#createDeepProxy(extractedState, "");
        console.log("Aspis [Store-Bootstrap]: Hierarchischer State-Baum erfolgreich initialisiert.", extractedState);
    }

    /**
     * Liefert den aktuell verarbeiteten Effekt von der Spitze des Reaktivitäts-Stacks.
     * 
     * @internal
     * @type {ReactiveEffect|null}
     */
    get _activeEffect() {
        return this.#effectStack[this.#effectStack.length - 1] || null;
    }

    /**
     * Gibt den reaktiven, tiefen-geproxyten State-Baum zurück.
     * 
     * @public
     * @type {Object}
     */
    get state() {
        return this.#stateProxy;
    }

    /**
     * Gibt eine schreibgeschützte (eingefrorene) Kopie der Rohdaten zurück.
     * 
     * @public
     * @type {Readonly<Record<string, any>>}
     */
    get data() {
        return Object.freeze({ ...this.#data });
    }

    /**
     * Navigiert sicher entlang eines Punkt-getrennten Pfads durch den State-Baum.
     * 
     * @public
     * @param {string} path - Punkt-getrennter Pfad (z. B. 'app.ui' oder 'features.filter').
     * @returns {any} Der Zustandsknoten am angegebenen Pfad.
     * @throws {Error} Wenn der Pfad ungültig oder nicht im Manifest deklariert ist.
     */
    getSlice(path) {
        if (!path || typeof path !== 'string') {
            throw new Error("Aspis [Store-Schutzschild]: getSlice verlangt einen gültigen Pfad-String.");
        }

        const parts = path.split('.');
        let current = this.#stateProxy;

        for (const part of parts) {
            if (current && typeof current === 'object' && part in current) {
                current = current[part];
            } else {
                throw new Error(`Aspis [Store-Schutzschild]: Zugriff verweigert! Das Feature/Slice "${path}" ist nicht im state-manifest.json deklariert.`);
            }
        }

        return current;
    }

    /**
     * Ruf die Konfiguration (`SliceConfig`) eines bestimmten Slices ab.
     * 
     * @public
     * @param {string} path - Vollständiger Slice-Pfad (z. B. 'features.gildeTable').
     * @returns {SliceConfig} Das Konfigurationsobjekt oder `{}` falls nicht vorhanden.
     */
    getConfig(path) {
        return this.#configs[path] || {};
    }

    /**
     * Ersetzt das komplette interne Rohdaten-Objekt (`#data`) und triggert Event-Listener.
     * 
     * @public
     * @param {Record<string, any>} newData - Das neue Daten-Objekt.
     * @returns {void}
     */
    updateData(newData) {
        this.#data = newData;
        this.#trigger('data', this.#data);
    }

    /**
     * Registriert eine reaktive Funktion, führt sie sofort aus und verfolgt deren State-Abhängigkeiten.
     * 
     * @public
     * @param {function(): void} fn - Die reaktiv auszuführende Funktion.
     * @returns {function(): void} Unsubscribe-Funktion zum Stoppen und Abmelden des Effekts.
     */
    effect(fn) {
        if (typeof fn !== 'function') return () => {};

        const rxEffect = new ReactiveEffect(this, fn);
        rxEffect.run();

        return () => {
            rxEffect.stop();
        };
    }

    /**
     * Legt einen Reaktivitäts-Effekt auf den Stack der aktiven Ausführungen.
     * 
     * @public
     * @param {ReactiveEffect} effect - Der gestartete Effekt.
     * @returns {void}
     */
    pushEffect(effect) {
        this.#effectStack.push(effect);
    }

    /**
     * Entfernt den obersten Reaktivitäts-Effekt vom Ausführungs-Stack.
     * 
     * @public
     * @returns {void}
     */
    popEffect() {
        this.#effectStack.pop();
    }

    /**
     * Registriert eine logische Kaskaden-Abhängigkeit zwischen zwei State-Pfaden ODER eine DOM-Element-Bindung an einen Pfad.
     * 
     * @public
     * @param {HTMLElement | string} targetOrPath - Ein DOM-Element ODER der elterliche State-Pfad.
     * @param {string} childPathOrDataPath - Der beobachtete State-Pfad (für DOM) ODER der abzusetzende Child-Pfad.
     * @returns {void}
     * @throws {Error} Bei ungültiger Parameter-Kombination.
     */
    addDependency(targetOrPath, childPathOrDataPath) {
        if (!targetOrPath || !childPathOrDataPath) {
            console.warn("Aspis [Store]: addDependency() abgebrochen - Parameter dürfen nicht leer sein.");
            return;
        }

        if (targetOrPath instanceof HTMLElement) {
            if (typeof childPathOrDataPath !== 'string' || !childPathOrDataPath.trim()) {
                console.warn("Aspis [Store]: DOM-Abhängigkeit benötigt einen gültigen Pfad-String.");
                return;
            }
            const path = childPathOrDataPath.trim();
            if (!this.#domDependencies.has(path)) {
                this.#domDependencies.set(path, new Set());
            }
            this.#domDependencies.get(path).add(targetOrPath);
            return;
        }

        if (typeof targetOrPath === 'string' && typeof childPathOrDataPath === 'string') {
            const parentPath = targetOrPath.trim();
            const childPath = childPathOrDataPath.trim();

            if (!parentPath || !childPath) {
                console.warn("Aspis [Store]: Pfad-Abhängigkeit enthält leere Pfad-Strings.");
                return;
            }

            if (!this.#dependencies.has(parentPath)) {
                this.#dependencies.set(parentPath, new Set());
            }
            this.#dependencies.get(parentPath).add(childPath);
            console.log(`Aspis [Store]: Logische Kaskade registriert [${parentPath} ──> ${childPath}]`);
            return;
        }

        throw new Error("Aspis [Store]: Ungültige Signatur in addDependency(). Erlaubt: (HTMLElement, String) oder (String, String).");
    }

    /**
     * Entfernt ein DOM-Element aus allen registrierten Pfad-Abhängigkeiten.
     * 
     * @public
     * @param {HTMLElement} targetElement - Das zu entfernende HTML-Element.
     * @returns {void}
     */
    removeDomDependencies(targetElement) {
        if (!(targetElement instanceof HTMLElement)) return;

        this.#domDependencies.forEach((elements, path) => {
            elements.delete(targetElement);
            if (elements.size === 0) {
                this.#domDependencies.delete(path);
            }
        });
    }

    /**
     * Erzwingt das sofortige Abarbeiten aller ausstehenden DOM-Updates und Reaktivitäts-Effekte.
     * Cancelled den ausstehenden Animation-Frame-Timer.
     * 
     * @public
     * @returns {void}
     */
    flush() {
        if (!this.#isFlushPending) return;

        if (this.#flushTimerId !== null && typeof cancelAnimationFrame !== 'undefined') {
            cancelAnimationFrame(this.#flushTimerId);
            this.#flushTimerId = null;
        }

        this.#flushQueue();
    }

    /**
     * Prüft, ob ein zusammengesetzter State-Pfad im deklarierten State-Baum des Manifests existiert.
     * 
     * @internal
     * @param {string} path - Der zu prüfende Pfad (z. B. 'app.ui.globalSpinner').
     * @returns {boolean} `true`, wenn der Pfad im Manifest oder initialen State erlaubt ist.
     */
    #isPathDeclared(path) {
        if (!path) return false;

        const parts = path.split('.');
        
        if (!Store.ALLOWED_NAMESPACES.includes(parts[0])) {
            return false;
        }

        let current = this.manifest?.slices;
        if (!current) return false;

        const slicePath = `${parts[0]}.${parts[1]}`;
        const slice = current[slicePath];

        if (!slice) return false;
        if (parts.length === 2) return true;

        let stateCursor = slice.initialState;
        for (let i = 2; i < parts.length; i++) {
            const key = parts[i];
            
            if (stateCursor === null || typeof stateCursor !== 'object' || !(key in stateCursor)) {
                return false;
            }
            stateCursor = stateCursor[key];
        }

        return true;
    }

    /**
     * Erzeugt rekursiv ein Deep-Proxy-Objekt um State-Zugriffe (`#track`) und Mutationen (`#trigger`) abzufangen.
     * 
     * @internal
     * @param {Object} target - Das zu wrappende Objekt.
     * @param {string} currentPath - Der bisherige hierarchische Pfad (z. B. 'features.filter').
     * @returns {Object} Das erzeugte Proxy-Objekt.
     */
    #createDeepProxy(target, currentPath) {
        if (target === null || typeof target !== 'object') {
            return target;
        }
        if (this.#proxyCache.has(target)) {
            return this.#proxyCache.get(target);
        }

        const storeContext = this;

        const proxy = new Proxy(target, {
            get(obj, prop) {
                const value = obj[prop];
                if (typeof prop === 'symbol') return value;

                const nextPath = currentPath ? `${currentPath}.${String(prop)}` : String(prop);
                storeContext.#track(nextPath);

                if (value !== null && typeof value === 'object') {
                    return storeContext.#createDeepProxy(value, nextPath);
                }
                return value;
            },

            set(obj, prop, value) {
                if (typeof prop === 'symbol') {
                    obj[prop] = value;
                    return true;
                }

                const nextPath = currentPath ? `${currentPath}.${String(prop)}` : String(prop);
                const oldValue = obj[prop];

                if (!(prop in obj) && !storeContext.#isPathDeclared(nextPath)) {
                    const errorMsg = `Aspis [Store-Schutzschild]: Mutation abgelehnt! Der State-Parameter "${nextPath}" ` +
                        `wurde nicht im state-manifest.json deklariert.`;

                    if (storeContext.#strictMode) {
                        throw new Error(errorMsg);
                    } else {
                        console.error(errorMsg);
                        return true;
                    }
                }

                if (oldValue !== value) {
                    obj[prop] = value;
                    storeContext.#trigger(nextPath, value);
                    storeContext.#handleDependencies(nextPath);
                }
                return true;
            }
        });

        this.#proxyCache.set(target, proxy);
        return proxy;
    }

    /**
     * Verknüpft einen ausgelesenen State-Pfad mit dem aktuell aktiven Reaktivitäts-Effekt.
     * 
     * @internal
     * @param {string} path - Der gelesene State-Pfad.
     * @returns {void}
     */
    #track(path) {
        if (this._activeEffect) {
            if (!this.#listeners.has(path)) {
                this.#listeners.set(path, new Set());
            }
            this.#listeners.get(path).add(this._activeEffect);
            this._activeEffect.trackPath(path);
        }
    }

    /**
     * Registriert eine State-Änderung, stellt Effekte und DOM-Updates in die Queue und löst CustomEvents aus.
     * 
     * @internal
     * @param {string} path - Der geänderte State-Pfad.
     * @param {any} value - Der neue Wert.
     * @returns {void}
     */
    #trigger(path, value) {
        const pathListeners = this.#listeners.get(path);
        if (pathListeners) {
            pathListeners.forEach(effect => this.#effectQueue.add(effect));
        }

        this.#domDependencies.forEach((elements, registeredDataPath) => {
            if (path === registeredDataPath || path.startsWith(registeredDataPath + '.')) {
                elements.forEach(element => {
                    if (!element.isConnected) {
                        elements.delete(element);
                        return;
                    }
                    if (!this.#pendingDomUpdates.has(element)) {
                        this.#pendingDomUpdates.set(element, new Set());
                    }
                    this.#pendingDomUpdates.get(element).add(path);
                });
            }
        });

        this.dispatchEvent(new CustomEvent(`store:${path}`, { 
            detail: { path, value } 
        }));
        this.dispatchEvent(new CustomEvent('store:mutation', { 
            detail: { path, value } 
        }));

        if (this.#effectQueue.size > 0 || this.#pendingDomUpdates.size > 0) {
            this.#queueFlush();
        }
    }

    /**
     * Dispatched das CustomEvent `aspis:data-mutation` an ein spezifisches DOM-Element.
     * 
     * @internal
     * @param {HTMLElement} element - Das Ziel-Element.
     * @param {Set<string>} triggeredPaths - Die geänderten Pfade für das Event-Detail.
     * @returns {void}
     */
    #triggerElementUpdate(element, triggeredPaths) {
        const pathArray = Array.from(triggeredPaths);
        const customEvent = new CustomEvent('aspis:data-mutation', { 
            bubbles: true, 
            detail: { 
                path: pathArray.length === 1 ? pathArray[0] : pathArray,
                paths: pathArray,
                dependsOn: element.dataset.dependsOn 
            } 
        });
        element.dispatchEvent(customEvent);
    }

    /**
     * Plant einen asynchronen Flush der Reaktivitäts-Queue via `requestAnimationFrame` oder Microtask.
     * 
     * @internal
     * @returns {void}
     */
    #queueFlush() {
        if (this.#isFlushPending) return;
        this.#isFlushPending = true;

        if (typeof requestAnimationFrame !== 'undefined') {
            this.#flushTimerId = requestAnimationFrame(() => {
                this.#flushTimerId = null;
                this.#flushQueue();
            });
        } else {
            queueMicrotask(() => {
                this.#flushQueue();
            });
        }
    }

    /**
     * Verarbeitet alle ausstehenden DOM-Updates und Effekte aus den Queues und setzt den Flush-Status zurück.
     * 
     * @internal
     * @returns {void}
     */
    #flushQueue() {
        try {
            if (this.#pendingDomUpdates.size > 0) {
                this.#pendingDomUpdates.forEach((paths, element) => {
                    this.#triggerElementUpdate(element, paths);
                });
            }

            if (this.#effectQueue.size > 0) {
                this.#effectQueue.forEach(effect => effect.run());
            }
        } catch (error) {
            console.error("Aspis [Store]: Fehler während des Queue-Flushes:", error);
        } finally {
            this.#pendingDomUpdates.clear();
            this.#effectQueue.clear();
            this.#isFlushPending = false;
            this.#flushTimerId = null;
        }
    }

    /**
     * Ermittelt den im Manifest (initialState) deklarierten Initialwert für einen Pfad.
     * 
     * @internal
     * @param {string} path - Der abzufragende State-Pfad.
     * @returns {any} Der ursprüngliche Wert aus dem initialState oder undefined.
     */
    #getInitialValue(path) {
        if (!path) return undefined;

        const parts = path.split('.');
        if (parts.length < 2) return undefined;

        const slicePath = `${parts[0]}.${parts[1]}`;
        const slice = this.manifest?.slices?.[slicePath];
        if (!slice || !slice.initialState) return undefined;

        let cursor = slice.initialState;
        for (let i = 2; i < parts.length; i++) {
            const key = parts[i];
            if (cursor === null || typeof cursor !== 'object' || !(key in cursor)) {
                return undefined;
            }
            cursor = cursor[key];
        }

        return cursor;
    }

    /**
 * Führt kaskadierende Mutationen aus, wenn ein Parent-Pfad mutiert wurde.
 * Setzt abhängige Child-Pfade typgerecht zurück ([], {}, initialer Wert oder null).
 * 
 * @internal
 * @param {string} parentPath - Der veränderte Elter-Pfad.
 * @returns {void}
 */
    #handleDependencies(parentPath) {
        const children = this.#dependencies.get(parentPath);
        if (!children) return;

        children.forEach(childPath => {
            console.log(`Aspis [Store-Kaskade]: Parent '${parentPath}' zwingt Child '${childPath}' zum Reset.`);
            
            const parts = childPath.split('.');
            let current = this.#stateProxy;
            
            for (let i = 0; i < parts.length - 1; i++) {
                current = current[parts[i]];
                if (!current) return;
            }

            const targetKey = parts[parts.length - 1];
            const initialVal = this.#getInitialValue(childPath);
            let resetValue = null;

            if (Array.isArray(initialVal) || Array.isArray(current[targetKey])) {
                resetValue = [];
            } else if (
                (initialVal !== null && typeof initialVal === 'object') || 
                (current[targetKey] !== null && typeof current[targetKey] === 'object')
            ) {
                resetValue = {};
            } else if (initialVal !== undefined) {
                resetValue = initialVal;
            }

            current[targetKey] = resetValue;
        });
    }

    /**
     * Löscht die Pfad-Registrierungen eines beendeten Effekts aus der `#listeners`-Map.
     * 
     * @internal
     * @param {ReactiveEffect} effect - Der zu entfernende Effekt.
     * @param {Set<string>} paths - Die Pfade, die der Effekt bisher beobachtet hat.
     * @returns {void}
     */
    _cleanupEffect(effect, paths) {
        paths.forEach(path => {
            const pathListeners = this.#listeners.get(path);
            if (pathListeners) {
                pathListeners.delete(effect);
                if (pathListeners.size === 0) {
                    this.#listeners.delete(path);
                }
            }
        });
    }
}