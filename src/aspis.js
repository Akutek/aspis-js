import { ControllerRegistry } from './core/ControllerRegistry.js';

Main.autoBoot();

/**
 * Interface für einen Service, der CSS-Klassen und Style-Cleanups auf Elementen verwaltet.
 * @typedef {Object} ClassService
 * @property {function(): void} [cleanup] - Entfernt gesetzte Klassen-Bindings und stellt den Ursprungszustand her.
 */
/**
 * Interface für eine Controller-Instanz im Aspis-Framework.
 * @typedef {Object} ControllerInstance
 * @property {ClassService} [classService] - Optionaler Service zur Verwaltung von Klassen-Bindings.
 * @property {function(): void} [destroy] - Lifecycle-Methode zum Aufräumen und Freigeben von Ressourcen.
 */
/**
 * Interface für den reaktiven Haupt-Store des Aspis-Frameworks.
 * @typedef {Object} Store
 * @property {function(HTMLElement): void} removeDomDependencies - Entfernt ein Element aus allen Store-Reaktivitäts-Trackern.
 */
/**
 * Interface für die Registry des Aspis-Frameworks zur Verwaltung von Services, Store und Controller-Instanzen.
 * @typedef {Object} ComponentRegistry
 * @property {function(string | HTMLElement): (Store | ControllerInstance | any)} get - Ruft einen Service über dessen Namen ODER einen Controller über dessen Element-Referenz ab.
 * @property {function(HTMLElement): boolean} delete - Entfernt die Zuordnung eines Controllers zu einem DOM-Element.
 */

/**
 * Interne Hilfsklasse des Aspis-Frameworks zum geordneten Abbau (Cleanup/Teardown) von Komponenten,
 * Controller-Instanzen und deren Reaktivitäts-Bindungen aus dem Store und DOM.
 * 
 * @internal
 */
class ComponentCleaner {
    /**
     * Referenz auf die zentral registrierte ComponentRegistry.
     * @internal
     * @type {ComponentRegistry}
     */
    #registry;

    /**
     * Erstellt eine neue Instanz des ComponentCleaners.
     * 
     * @public
     * @param {ComponentRegistry} registry - Die zentrale Registry zur Komponenten-Verwaltung.
     */
    constructor(registry) {
        this.#registry = registry;
    }

    /**
     * Räumt ein einzelnes DOM-Element auf: Entkoppelt Store-Abhängigkeiten, führt Lifecycle-Cleanup
     * des zugehörigen Controllers aus und entfernt diesen aus der Registry.
     * 
     * @public
     * @param {HTMLElement} element - Das aufzuräumende DOM-Element.
     * @returns {void}
     */
    clean(element) {
        if (!element || !this.#registry) return;

        const store = this.#registry.get('store');
        if (store && typeof store.removeDomDependencies === 'function') {
            store.removeDomDependencies(element);
        }

        const controller = this.#registry.get(element);
        if (!controller) return;

        try {
            if (controller.classService && typeof controller.classService.cleanup === 'function') {
                controller.classService.cleanup();
            }

            if (typeof controller.destroy === 'function') {
                controller.destroy();
            }
        } catch (error) {
            console.error(`Aspis [ComponentCleaner]: Fehler beim Zerstören von ${controller.constructor?.name || 'Controller'}:`, error);
        } finally {
            this.#registry.delete(element);
        }
    }

    /**
     * Durchsucht einen DOM-Teilbaum rückwärts (Bottom-Up) nach Elementen mit `data-controller`
     * und führt für jedes gefundene Element (inklusive Root) das Cleanup durch.
     * 
     * @public
     * @param {Element} rootElement - Das Wurzel-Element des abzubauenden DOM-Teilbaums.
     * @returns {void}
     */
    cleanTree(rootElement) {
        if (!rootElement || !(rootElement instanceof Element)) return;

        const targets = [];

        const children = rootElement.querySelectorAll('[data-controller]');
        for (const child of children) {
            targets.push(child);
        }

        if (typeof rootElement.matches === 'function' && rootElement.matches('[data-controller]')) {
            targets.push(rootElement);
        }

        for (let i = targets.length - 1; i >= 0; i--) {
            this.clean(targets[i]);
        }
    }
}

/**
 * Konfiguration für ein spezifisches DOM-Target innerhalb eines State-Slices.
 * @typedef {Object} TargetConfig
 * @property {string} selector - CSS-Selektor für das Ziel-Element (z. B. ':scope', '#global-spinner').
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
 * @property {Record<string, any>} initialState - Initialer Zustand des Slices.
 * @property {SliceConfig} [config] - Layout- und Binding-Konfiguration.
 */
/**
 * Struktur der `state-manifest.json`.
 * @typedef {Object} StateManifest
 * @property {{ strictMode: boolean }} [settings] - Globale Framework-Einstellungen.
 * @property {Record<string, string>} [globalStyles] - App-weit gültige CSS-Statusklassen.
 * @property {Record<string, StateSlice>} slices - Deklarierte Zustandsobjekte (z. B. 'app.ui', 'features.filter').
 */
/**
 * Konfiguration einer einzelnen Komponente aus `app-config.json`.
 * @typedef {Object} ComponentConfig
 * @property {string} type - Name der Controller-Klasse (z. B. 'ControllerTable').
 * @property {string} sliceKey - Zugeteilter State-Slice-Key im Store.
 * @property {string} events - Relativer Dateipfad zur Event-Konfiguration.
 */
/**
 * Struktur der `app-config.json`.
 * @typedef {Object} AppConfig
 * @property {Object} publicPaths - Basispfade für das Laden dynamischer Ressourcen.
 * @property {string} publicPaths.controllers - Ordnerpfad zu den Controller-Klassen.
 * @property {string} publicPaths.templates - Ordnerpfad zu den HTML/Template-Dateien.
 * @property {string} publicPaths.events - Ordnerpfad zu den Event-Konfigurationsdateien.
 * @property {Record<string, ComponentConfig>} components - Mapping von Custom-Element-Namen zu deren Konfiguration.
 */
/**
 * Struktur der `event-manifest.json`.
 * Map von Feature-Bereichen zu ihren jeweiligen Event-JSON-Dateipfaden.
 * @typedef {Record<string, { events: string }>} EventManifest
 */

/**
 * Haupt-Bootstrapper und Orchestrator des Aspis-Frameworks.
 * Lädt Manifeste, instanziiert zentrale Kern-Services im Container (`Registry`)
 * und bindet Controller-Instanzen an gescannte DOM-Knoten.
 * 
 * @public
 * @abstract
 */
class Main {
    /**
     * Bootet das Framework asynchron: Lädt Konfigurationen, baut den Service-Container
     * auf, scannt den DOM-Baum und startet alle Controller.
     * 
     * @public
     * @static
     * @async
     * @param {ControllerRegistry} controllerRegistry - Instanz zum dynamischen Import von Controllern.
     * @returns {Promise<Registry|undefined>} Der befüllte Service-Container (`Registry`) oder `undefined` bei einem kritischen Fehler.
     * @throws {Error} Wenn `controllerRegistry` fehlt oder keine `getAsync`-Methode besitzt.
     */
    static async boot(controllerRegistry) {
        if (!controllerRegistry || typeof controllerRegistry.getAsync !== 'function') {
            throw new Error("Aspis [Main]: Ungültige oder fehlende ControllerRegistry übergeben.");
        }
        try {
            const [config, stateManifest, eventManifest] = await Promise.all([
                fetch('./js/aspis/core/app-config.json').then(res => {
                    if (!res.ok) throw new Error("app-config.json konnte nicht geladen werden");
                    return res.json();
                }),
                fetch('./js/aspis/core/state-manifest.json').then(res => {
                    if (!res.ok) throw new Error("state-manifest.json konnte nicht geladen werden");
                    return res.json();
                }),
                fetch('./js/aspis/core/event-manifest.json').then(res => {
                    if (!res.ok) return {};
                    return res.json();
                }).catch(() => ({}))
            ]);

            const services = this.createServices(controllerRegistry, config, stateManifest, eventManifest);

            const scanResults = ScannerDOM.scan(document.body);
            await this.assignControllers(scanResults, services);

            console.info("Aspis [Main]: Anwendung erfolgreich gebootet.");
            return services;
        } catch (error) {
            console.error("Aspis [Main]: Kritischer Fehler beim Bootstrapping der Anwendung:", error);
        }
    }

    /**
     * Startet den Bootstrapping-Prozess automatisch nach dem `DOMContentLoaded`-Event.
     * 
     * @public
     * @static
     * @param {string} [registryPath='/src/controllers'] - Basis-Pfad zum Controller-Verzeichnis (siehe app-config.json).
     * @returns {void}
     */
    static autoBoot(registryPath = './controllers') {
        const start = () => {
            const loader = new ControllerRegistry(registryPath);
            this.boot(loader);
        };

        if (document.readyState === 'loading') {
            window.addEventListener('DOMContentLoaded', start);
        } else {
            start();
        }
    }

    /**
     * Initialisiert alle Kern-Services des Frameworks und registriert sie im Service-Container.
     * 
     * @public
     * @static
     * @param {ControllerRegistry} controllerRegistry - Registry für dynamische Modul-Imports.
     * @param {AppConfig} config - Geladene Konfiguration aus `app-config.json`.
     * @param {StateManifest} manifest - Geladenes State-Manifest aus `state-manifest.json`.
     * @param {EventManifest} [eventManifest={}] - Geladenes Event-Manifest aus `event-manifest.json`.
     * @returns {Registry} Der vollständig befüllte Service-Container.
     */
    static createServices(controllerRegistry, config, manifest, eventManifest) {
        const registry = new Registry();
        const cleaner = new ComponentCleaner(registry);
        const templates = new TemplateService();
        const renderService = new RenderService(templates, cleaner);

        registry.set('controllerRegistry', controllerRegistry);
        registry.set('config', config);
        registry.set('store', new Store(manifest));
        registry.set('eventManifest', eventManifest || {});
        registry.set('fetcher', new DatenFetcher());
        registry.set('dispatcher', new EventDispatcher());
        registry.set('modifierDOM', ModifierDOM);
        registry.set('cleaner', cleaner);
        registry.set('templates', templates);
        registry.set('renderService', renderService);

        return registry;
    }

    /**
     * Iteriert über alle gescannten DOM-Knoten und startet die zugehörigen Controller parallel.
     * 
     * @public
     * @static
     * @async
     * @param {ScanResult[]} scanResults - Liste der vom DOM-Scanner identifizierten Elemente.
     * @param {Registry} registry - Der zentrale Service-Container.
     * @returns {Promise<void>}
     */
    static async assignControllers(scanResults, registry) {
        const promises = scanResults.map(detectedNode => {
            return this.startController(detectedNode, registry);
        });

        await Promise.all(promises);
    }

    /**
     * Erzeugt eine Controller-Instanz, verdrahtet Store, Dispatcher & Dependencies und führt `start()` aus.
     * 
     * @public
     * @static
     * @async
     * @param {ScanResult} item - Einzelnes Scannergebnis für ein Element.
     * @param {Registry} registry - Der zentrale Service-Container.
     * @returns {Promise<void>}
     */
    static async startController(item, registry) {
        const config = registry.get('config');
        const componentConfig = config.components?.[item.type] || {};
        const controllerClassName = componentConfig.type || item.type;
        const controllerRegistry = registry.get('controllerRegistry');
        const ControllerClass = await controllerRegistry.getAsync(controllerClassName);

        if (!ControllerClass) {
            console.warn(`Aspis [Main]: Dynamischer Lookup fehlgeschlagen. Controller '${controllerClassName}' ist nicht in der Registry registriert.`);
            return;
        }

        try {
            const store = registry.get('store');
            const dispatcher = registry.get('dispatcher');
            const renderService = registry.get('renderService');
            const eventsBase = config.publicPaths?.events || '/src/events';
            const eventPath = componentConfig.events ? `${eventsBase}/${componentConfig.events}` : null;
            const sliceKey = componentConfig.sliceKey || null;
            const controllerInstance = new ControllerClass(item.element, store, dispatcher, { 
                eventPath, 
                sliceKey,
                registry,
                renderService
            });
            
            controllerInstance.layout = item.layout;

            registry.set(item.element, controllerInstance);

            const dependsOnAttr = item.element.dataset.dependsOn || item.element.getAttribute('data-depends-on');
            if (dependsOnAttr && typeof store.addDependency === 'function') {
                const paths = dependsOnAttr.split(',').map(path => path.trim()).filter(Boolean);
                paths.forEach(path => {
                    store.addDependency(item.element, path);
                    console.info(`Aspis [Main]: Reaktive PHP-Abhängigkeit registriert: <${item.type}> lauscht auf Pfad '${path}'`);
                });
            }

            await controllerInstance.start();

        } catch (error) {
            console.error(`Aspis [Main]: Fehler im Lebenszyklus beim Starten des Controllers '${item.type}':`, error);
        }
    }
}


/**
 * Interface für den reaktiven Haupt-Store des Aspis-Frameworks.
 * @typedef {Object} Store
 * @property {function(ReactiveEffect): void} pushEffect - Legt einen Reaktivitäts-Effekt auf den Ausführungs-Stack.
 * @property {function(): void} popEffect - Entfernt den obersten Reaktivitäts-Effekt vom Ausführungs-Stack.
 * @property {function(ReactiveEffect, Set<string>): void} _cleanupEffect - Entfernt die Listener-Registrierungen eines Effekts für gegebene Pfade.
 */

/**
 * Repräsentiert einen reaktiven Effekt im Aspis-Framework, der eine Funktion ausführt,
 * deren gelesene State-Pfade automatisch protokolliert und sich bei State-Änderungen erneut triggern lässt.
 * 
 * @internal
 */
class ReactiveEffect {
    /**
     * Referenz auf den verknüpften Store zur Steuerung des Effect-Stacks und Cleanups.
     * @internal
     * @type {Store}
     */
    #store;

    /**
     * Die reaktiv auszuführende Ziel-Funktion.
     * @internal
     * @type {function(): any}
     */
    #fn;

    /**
     * Menge aller State-Pfade, die während der letzten Ausführung dieses Effekts gelesen wurden.
     * @internal
     * @type {Set<string>}
     */
    #trackedPaths = new Set();

    /**
     * Erzeugt eine neue `ReactiveEffect`-Instanz.
     * 
     * @public
     * @param {Store} store - Die Store-Instanz, an die der Effekt gebunden ist.
     * @param {function(): any} fn - Die reaktiv auszuführende Funktion.
     */
    constructor(store, fn) {
        this.#store = store;
        this.#fn = fn;
    }

    /**
     * Führt die hinterlegte Funktion aus, registriert den Effekt auf dem Store-Stack
     * zur automatischen Pfad-Erfassung und stellt sicher, dass der Stack anschließend bereinigt wird.
     * 
     * @public
     * @returns {any} Der Rückgabewert der ausgeführten Funktion `#fn`.
     */
    run() {
        try {
            this.#store.pushEffect(this);
            return this.#fn();
        } finally {
            this.#store.popEffect();
        }
    }

    /**
     * Registriert einen beobachteten State-Pfad in der internen Tracking-Liste des Effekts.
     * 
     * @public
     * @param {string} path - Der vom State ausgelesene Punkt-getrennte Pfad.
     * @returns {void}
     */
    trackPath(path) {
        this.#trackedPaths.add(path);
    }

    /**
     * Stoppt den Effekt, meldet ihn von allen registrierten Pfad-Listenern des Stores ab
     * und leert die intern verfolgten Pfade.
     * 
     * @public
     * @returns {void}
     */
    stop() {
        this.#store._cleanupEffect(this, this.#trackedPaths);
        this.#trackedPaths.clear();
    }
}


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
class Store extends EventTarget {
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
                const pathDepth = nextPath.split('.').length;

                if (pathDepth <= 2 && !(prop in obj)) {
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
     * Führt kaskadierende Mutationen aus (setzt definierte Child-Pfade auf `null`), wenn ein Parent-Pfad mutiert wurde.
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
            }
            current[parts[parts.length - 1]] = null;
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


/**
 * Interface für eine Controller-Instanz mit optionaler Lifecycle-Cleanup-Methode.
 * @typedef {Object} ControllerInstance
 * @property {function(): void} [destroy] - Wird beim Löschen oder durch die FinalizationRegistry zur Bereinigung aufgerufen.
 */
/**
 * Known Services Mapping für präzise Autovervollständigung.
 * @typedef {Object} KnownServices
 * @property {import('./ControllerRegistry').ControllerRegistry} controllerRegistry - Dynamischer Import-Service.
 * @property {AppConfig} config - Globale Anwendungskonfiguration.
 * @property {Object} store - Redux-ähnlicher State-Store.
 * @property {EventManifest} eventManifest - Zuordnung von Feature-Events zu JSON-Dateien.
 * @property {Object} fetcher - HTTP-Abstraktion für API-Aufrufe.
 * @property {Object} dispatcher - Globaler Event-Bus / PubSub.
 * @property {Object} modifierDOM - Utility für direkte DOM-Manipulationen.
 * @property {Object} cleaner - Teardown- & Lifecycle-Service.
 * @property {Object} templates - Caching- & Render-Engine für Templates.
 * @property {Object} renderService - DOM-Injektions-Service.
 */
/**
 * Konfiguration der `app-config.json`.
 * @typedef {Object} AppConfig
 * @property {Object} publicPaths - Basispfade.
 * @property {string} publicPaths.controllers - Pfad zu Controllern.
 * @property {string} publicPaths.templates - Pfad zu Templates.
 * @property {string} publicPaths.events - Pfad zu Events.
 * @property {Record<string, Object>} components - Komponenten-Mapping.
 */
/**
 * Event-Manifest Struktur aus `event-manifest.json`.
 * @typedef {Record<string, { events: string }>} EventManifest
 */

/**
 * Inversion-of-Control (IoC) Container für das Aspis-Framework.
 * Speichert, verwaltet und liefert alle zentralen Instanzen und Konfigurationen 
 * während des Anwendungs-Lebenszyklus.
 * 
 * @public
 */
class Registry {
    /**
     * Speicher für globale Singleton-Services und Konfigurationen.
     * @internal
     * @type {Map<string, any>}
     */
    #services;

    /**
     * Speicher für DOM-Knoten-zu-Controller Bindings.
     * Nutzt WeakMap, damit nicht mehr genutzte DOM-Elemente vom GC erfasst werden können.
     * @internal
     * @type {WeakMap<HTMLElement, ControllerInstance>}
     */
    #elements;

    /**
     * Automatische Cleanup-Registry. Ruft `.destroy()` auf Controllern auf,
     * sobald deren HTML-Element im DOM vom Garbage Collector abgeräumt wurde.
     * @internal
     * @type {FinalizationRegistry<WeakRef<ControllerInstance>>}
     */
    #finalizer;

    /**
     * Initialisiert den Service-Speicher, den WeakMap-Controller-Speicher 
     * und bindet den GC-Cleanup-Finalizer.
     * 
     * @public
     */
    constructor() {
        this.#services = new Map();
        this.#elements = new WeakMap();

        this.#finalizer = new FinalizationRegistry((weakController) => {
            try {
                const controller = weakController.deref();
                if (controller && typeof controller.destroy === 'function') {
                    controller.destroy();
                }
            } catch (error) {
                console.error("Aspis [Registry]: Fehler beim GC-Cleanup:", error);
            }
        });
    }

    /**
     * Speichert einen Service (String-Key) oder verbindet einen Controller mit einem DOM-Element.
     * 
     * @public
     * @template {keyof KnownServices | string} K
     * @param {K | HTMLElement} key - Service-Name (String) ODER das HTML-Element des Controllers.
     * @param {K extends keyof KnownServices ? KnownServices[K] : ControllerInstance | any} value - Service-Instanz oder Controller.
     * @returns {void}
     * @throws {Error} Wenn ein String-Key bereits existiert oder der Key weder String noch HTMLElement ist.
     */
    set(key, value) {
        if (typeof key === 'string') {
            if (this.#services.has(key)) {
                throw new Error(`Aspis [Registry]: Key '${key}' ist bereits registriert.`);
            }
            this.#services.set(key, value);
            return;
        }

        if (key instanceof HTMLElement) {
            if (this.#elements.has(key)) {
                this.delete(key);
            }

            this.#elements.set(key, value);

            if (value && typeof value.destroy === 'function') {
                this.#finalizer.register(key, new WeakRef(value), key);
            }
            return;
        }
        
        throw new Error("Aspis [Registry]: Ungültiger Key-Typ in set().");
    }

    /**
     * Liest einen registrierten Service oder den zugehörigen Controller eines DOM-Elements aus.
     * 
     * @public
     * @template {keyof KnownServices | string} K
     * @param {K | HTMLElement} key - Der Service-Schlüssel oder das DOM-Element.
     * @returns {K extends keyof KnownServices ? KnownServices[K] : (ControllerInstance | null | any)} Der Service, Controller oder null.
     * @throws {Error} Wenn ein angeforderter String-Service nicht existiert.
     */
    get(key) {
        if (typeof key === 'string') {
            if (!this.#services.has(key)) {
                throw new Error(`Aspis [Registry]: Service '${key}' existiert nicht im Container.`);
            }
            return this.#services.get(key);
        }

        if (key instanceof HTMLElement) {
            return this.#elements.get(key) || null;
        }

        return null;
    }

    /**
     * Prüft das Vorhandensein eines Services oder eines Element-Controllers.
     * 
     * @public
     * @param {string | HTMLElement} key - Der zu prüfende Schlüssel.
     * @returns {boolean} `true`, wenn vorhanden, sonst `false`.
     */
    has(key) {
        if (typeof key === 'string') {
            return this.#services.has(key);
        }
        if (key instanceof HTMLElement) {
            return this.#elements.has(key);
        }
        return false;
    }

    /**
     * Entfernt einen Service oder deregistriert einen Controller von einem DOM-Element.
     * Führt bei Controller-Instanzen vorher `destroy()` aus und meldet sie vom GC-Finalizer ab.
     * 
     * @public
     * @param {string | HTMLElement} key - Der zu löschende Schlüssel.
     * @returns {boolean} `true`, wenn der Eintrag existierte und gelöscht wurde.
     */
    delete(key) {
        if (typeof key === 'string') {
            return this.#services.delete(key);
        }

        if (key instanceof HTMLElement) {
            const controller = this.#elements.get(key);

            if (controller && typeof controller.destroy === 'function') {
                try {
                    controller.destroy();
                } catch (error) {
                    console.error("Aspis [Registry]: Fehler beim destroy() Aufruf:", error);
                }
            }

            this.#finalizer.unregister(key);
            return this.#elements.delete(key);
        }

        return false;
    }

    /**
     * Leert ausschließlich alle registrierten Singleton-Services.
     * Die WeakMap `#elements` bleibt vom GC unberührt.
     * 
     * @public
     * @returns {void}
     */
    clearServices() {
        this.#services.clear();
    }
}


/**
 * Unterstützte HTTP-Methoden für Anfragen im Aspis-Framework.
 * @typedef {'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD'} HttpMethod
 */
/**
 * Key-Value-Map für URL-Query-Parameter.
 * @typedef {Record<string, string | number | boolean | null | undefined>} HttpParams
 */
/**
 * Key-Value-Map für HTTP-Header.
 * @typedef {Record<string, string>} HttpHeaders
 */
/**
 * Mitzusendender Payload-Datentyp für HTTP-Requests.
 * @typedef {Record<string, any> | FormData | string | Blob | ArrayBuffer | null} HttpBody
 */
/**
 * Möglicher Rückgabetyp einer DatenFetcher-Anfrage.
 * @template T
 * @typedef {T | boolean | string | null} FetchResult
 */
/**
 * Konfigurationsoptionen für die generische `request()`-Methode.
 * @typedef {Object} RequestOptions
 * @property {HttpParams} [params={}] - Query-Parameter für die URL.
 * @property {AbortSignal|null} [signal=null] - Optionales AbortSignal zum manuellen Stornieren.
 * @property {number} [timeout] - Timeout in Millisekunden.
 * @property {HttpHeaders} [headers={}] - Zusätzliche HTTP-Header.
 * @property {HttpMethod} [method='GET'] - Die zu verwendende HTTP-Methode.
 * @property {HttpBody} [body=null] - Der mitzusendende Request-Body.
 */
/**
 * Optionseinstellungen für spezifische HTTP-Methoden (`get`, `post`, `put`, `delete`).
 * @typedef {Object} HttpOptions
 * @property {HttpParams} [params] - Query-Parameter für die URL.
 * @property {AbortSignal|null} [signal] - Optionales AbortSignal zum Stornieren.
 * @property {number} [timeout] - Timeout in Millisekunden.
 * @property {HttpHeaders} [headers] - Zusätzliche HTTP-Header.
 * @property {HttpBody} [body] - Request-Body.
 */

/**
 * Service-Klasse des Aspis-Frameworks für asynchrone HTTP-Requests.
 * Bietet integrierte Timeout-Steuerung, automatische Signal-Kombination (AbortSignal) sowie
 * automatisches Parsing von JSON/Text-Antworten und Fehlerbehandlung.
 * 
 * @public
 */
class DatenFetcher {
    /**
     * Standard-Timeout in Millisekunden für alle Anfragen.
     * @internal
     * @type {number}
     */
    #defaultTimeoutMs;

    /**
     * Erzeugt eine neue Instanz des DatenFetchers.
     * 
     * @public
     * @param {number} [defaultTimeoutMs=8000] - Standard-Timeout für HTTP-Anfragen in Millisekunden.
     */
    constructor(defaultTimeoutMs = 8000) {
        this.#defaultTimeoutMs = defaultTimeoutMs;
    }

    /**
     * Führt einen konfigurierbaren HTTP-Request aus.
     * 
     * @public
     * @async
     * @template T
     * @param {string} url - Die Ziel-URL der HTTP-Anfrage.
     * @param {RequestOptions} [options={}] - Konfigurationsoptionen für die Anfrage.
     * @returns {Promise<FetchResult<T>>} Die geparsten Daten, `true` bei Status 204 (No Content), oder `null` bei Timeout/Abbruch.
     * @throws {Error} Wenn die übergebene URL ungültig ist oder ein HTTP-Fehlerstatus auftritt.
     */
    async request(url, { params = {}, signal = null, timeout = this.#defaultTimeoutMs, headers = {}, method = 'GET', body = null } = {}) {
        if (!url || typeof url !== 'string') {
            throw new Error("DatenFetcher: Keine gültige URL übergeben.");
        }

        const endpointUrl = new URL(url, window.location.origin);
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                endpointUrl.searchParams.append(key, value);
            }
        });

        const timeoutSignal = AbortSignal.timeout(timeout);

        let combinedSignal;

        if (!signal) {
            combinedSignal = timeoutSignal;
        } else if (typeof AbortSignal.any === 'function') {
            combinedSignal = AbortSignal.any([signal, timeoutSignal]);
        } else {
            const combinedController = new AbortController();

            const onAbort = (s) => {
                if (!combinedController.signal.aborted) {
                    combinedController.abort(s.reason);
                }
            };

            if (signal.aborted) {
                onAbort(signal);
            } else {
                signal.addEventListener('abort', () => onAbort(signal), { once: true });
            }

            if (timeoutSignal.aborted) {
                onAbort(timeoutSignal);
            } else {
                timeoutSignal.addEventListener('abort', () => onAbort(timeoutSignal), { once: true });
            }

            combinedSignal = combinedController.signal;
        }

        const fetchOptions = {
            method,
            headers: { ...headers },
            signal: combinedSignal
        };

        if (body && method !== 'GET') {
            if (typeof body === 'object' && !(body instanceof FormData)) {
                fetchOptions.headers['Content-Type'] = 'application/json';
                fetchOptions.body = JSON.stringify(body);
            } else {
                fetchOptions.body = body;
            }
        }

        try {
            const response = await fetch(endpointUrl.toString(), fetchOptions);

            if (!response.ok) {
                throw new Error(`HTTP-Fehler: Status ${response.status} (${response.statusText})`);
            }

            if (response.status === 204) {
                return true;
            }

            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            }

            return await response.text();

        } catch (error) {
            if (error.name === 'TimeoutError') {
                console.warn(`Aspis [DatenFetcher]: Request auf '${url}' überschritt das Timeout von ${timeout}ms.`);
                return null;
            }

            if (error.name === 'AbortError') {
                const reason = combinedSignal.reason || signal?.reason || 'Abgebrochen';
                console.info(`Aspis [DatenFetcher]: Request auf '${url}' storniert -> Grund: ${reason}`);
                return null; 
            }

            console.error(`Aspis [DatenFetcher]: Fehler bei ${method} ${url}:`, error);
            throw error;
        }
    }

    /**
     * Führt eine HTTP-GET-Anfrage aus.
     * 
     * @public
     * @async
     * @template T
     * @param {string} url - Die Ziel-URL.
     * @param {HttpParams} [params={}] - URL-Query-Parameter.
     * @param {HttpOptions} [options={}] - Zusätzliche Request-Optionen.
     * @returns {Promise<FetchResult<T>>} Die Antwortdaten oder `null` bei Abbruch/Timeout.
     * @throws {Error} Wenn ein HTTP-Fehler auftritt.
     */
    async get(url, params = {}, options = {}) {
        return this.request(url, { ...options, method: 'GET', params });
    }

    /**
     * Führt eine HTTP-POST-Anfrage aus.
     * 
     * @public
     * @async
     * @template T
     * @param {string} url - Die Ziel-URL.
     * @param {HttpBody} [body={}] - Der im Body zu übertragende Dateninhalt.
     * @param {HttpOptions} [options={}] - Zusätzliche Request-Optionen.
     * @returns {Promise<FetchResult<T>>} Die Antwortdaten oder `null` bei Abbruch/Timeout.
     * @throws {Error} Wenn ein HTTP-Fehler auftritt.
     */
    async post(url, body = {}, options = {}) {
        return this.request(url, { ...options, method: 'POST', body });
    }

    /**
     * Führt eine HTTP-PUT-Anfrage aus.
     * 
     * @public
     * @async
     * @template T
     * @param {string} url - Die Ziel-URL.
     * @param {HttpBody} [body={}] - Der im Body zu übertragende Dateninhalt.
     * @param {HttpOptions} [options={}] - Zusätzliche Request-Optionen.
     * @returns {Promise<FetchResult<T>>} Die Antwortdaten oder `null` bei Abbruch/Timeout.
     * @throws {Error} Wenn ein HTTP-Fehler auftritt.
     */
    async put(url, body = {}, options = {}) {
        return this.request(url, { ...options, method: 'PUT', body });
    }

    /**
     * Führt eine HTTP-DELETE-Anfrage aus.
     * 
     * @public
     * @async
     * @template T
     * @param {string} url - Die Ziel-URL.
     * @param {HttpOptions} [options={}] - Zusätzliche Request-Optionen.
     * @returns {Promise<FetchResult<T>>} Die Antwortdaten oder `null` bei Abbruch/Timeout.
     * @throws {Error} Wenn ein HTTP-Fehler auftritt.
     */
    async delete(url, options = {}) {
        return this.request(url, { ...options, method: 'DELETE' });
    }
}


/**
 * Ergebnis eines DOM-Scan-Vorgangs für ein Controller-Element.
 * @typedef {Object} ControllerScanResult
 * @property {HTMLElement} element - Das gescannte DOM-Element mit `data-controller`-Attribut.
 * @property {string} type - Der Typ/Name des Controllers (Inhalt von `data-controller`).
 * @property {string} layout - Das zugewiesene Layout (Inhalt von `data-layout` oder `"default"`).
 */

/**
 * Utility-Klasse des Aspis-Frameworks zum Scannen des DOMs nach Controller-Deklarationen.
 * Sucht nach Elementen mit dem `data-controller`-Attribut und liest deren Metadaten aus.
 * 
 * @public
 */
class ScannerDOM {
    /**
     * Durchsucht ein DOM-Element und dessen Kinder nach Elementen mit dem Attribut `data-controller`.
     * 
     * @public
     * @static
     * @param {ParentNode & Element} [rootElement=document.body] - Das Wurzel-Element, ab dem gescannt wird.
     * @returns {ControllerScanResult[]} Array mit den Analyse-Ergebnissen aller gefundenen Controller.
     */
    static scan(rootElement = document.body) {
        if (!rootElement || typeof rootElement.querySelectorAll !== 'function') {
            console.warn("Aspis [ScannerDOM]: Ungültiges oder fehlendes Root-Element übergeben. Scan abgebrochen.");
            return [];
        }

        const scanResults = [];

        if (typeof rootElement.matches === 'function' && rootElement.matches('[data-controller]')) {
            const parsed = this.#parseNode(rootElement);
            if (parsed) scanResults.push(parsed);
        }

        const elements = rootElement.querySelectorAll('[data-controller]');
        for (const element of elements) {
            const parsed = this.#parseNode(element);
            if (parsed) scanResults.push(parsed);
        }

        return scanResults;
    }

    /**
     * Liest die Controller-Metadaten (`data-controller` und `data-layout`) aus einem einzelnen DOM-Node aus.
     * 
     * @internal
     * @static
     * @param {HTMLElement} container - Das zu analysierende DOM-Element.
     * @returns {ControllerScanResult | null} Das extrahierte Objekt oder `null`, falls das Attribut leer/ungültig ist.
     */
    static #parseNode(container) {
        const type = container.dataset.controller || container.getAttribute('data-controller');
        if (!type || !type.trim()) {
            console.warn("Aspis [ScannerDOM]: Element mit leerem 'data-controller'-Attribut übersprungen:", container);
            return null;
        }

        const layout = container.dataset.layout || container.getAttribute('data-layout') || "default";

        return {
            element: container,
            type: type.trim(),
            layout: layout.trim()
        };
    }
}

/**
 * Konfigurations- oder Bezeichnerwert für das Layout eines Hauptmodells.
 * @typedef {string | Record<string, any>} LayoutConfig
 */
/**
 * Beliebiger JSON-Datensatz aus der Eingabe-Liste.
 * @typedef {Record<string, any>} JsonDataItem
 */
/**
 * Möglicher Eingabetyp für das JSON-Datenargument (Array oder beliebiger Wert).
 * @typedef {Array<JsonDataItem> | unknown} JsonDataInput
 */
/**
 * Schnittstelle für Instanzen von untergeordneten Modellen (Child-Instanzen).
 * @typedef {Record<string, any>} ChildModelInstance
 */
/**
 * Schnittstelle für das Hauptmodell mit optionaler Zeilen-Hinzufügen-Methode.
 * @typedef {Object} MainModelInstance
 * @property {function(ChildModelInstance): void} [appendRow] - Fügt eine erzeugte Kind-Instanz an das Hauptmodell an.
 */
/**
 * Statische Predicate-Funktion einer Kind-Klasse zur Ermittlung der Zuständigkeit für ein Daten-Item.
 * @callback CanHandlePredicate
 * @param {JsonDataItem} itemData - Der zu prüfende Einzel-Datensatz.
 * @returns {boolean} `true`, wenn die Klasse den Datensatz verarbeiten kann.
 */
/**
 * Konstruktor-Signatur zur Instanziierung einer Kind-Klasse.
 * @template {ChildModelInstance} [C=ChildModelInstance]
 * @typedef {new (itemData: JsonDataItem) => C} ChildClassConstructorFn
 */
/**
 * Statische Schnittstelle einer Kind-Klasse (Konstruktor + optionale `canHandle`-Methode).
 * @template {ChildModelInstance} [C=ChildModelInstance]
 * @typedef {ChildClassConstructorFn<C> & { canHandle?: CanHandlePredicate }} ChildClassConstructor
 */
/**
 * Gültiger Eingabetyp für das `ChildClasses`-Argument (Einzelklasse oder Array von Klassen).
 * @template {ChildModelInstance} [C=ChildModelInstance]
 * @typedef {ChildClassConstructor<C> | Array<ChildClassConstructor<C>>} ChildClassesInput
 */
/**
 * Konstruktor-Signatur für das Hauptmodell.
 * @template {MainModelInstance} [M=MainModelInstance]
 * @typedef {new (layout?: LayoutConfig) => M} MainClassConstructor
 */

/**
 * Zentrale Factory-Klasse des Aspis-Frameworks zur dynamischen Instanziierung
 * von Hauptmodellen und deren zugewiesenen Kind-Modellen anhand von strukturierten JSON-Daten.
 * 
 * @public
 */
class Factory {
    /**
     * Erzeugt eine Instanz des Hauptmodells (`MainClass`) und ordnet diesem dynamisch
     * erzeugte Kind-Instanzen (`ChildClasses`) basierend auf den übergebenen JSON-Daten zu.
     * 
     * @public
     * @static
     * @template {MainModelInstance} M
     * @template {ChildModelInstance} C
     * @param {MainClassConstructor<M>} MainClass - Die Konstruktor-Klasse des Hauptmodells.
     * @param {ChildClassesInput<C>} ChildClasses - Eine einzelne Kind-Modell-Klasse oder ein Array von Kind-Modell-Klassen.
     * @param {LayoutConfig} layout - Das zu verwendende Layout oder die Konfiguration für das Hauptmodell.
     * @param {JsonDataInput} jsonData - Array von Datenobjekten zur Erzeugung und Zuordnung der Kind-Instanzen.
     * @returns {M} Die erzeugte und gegebenenfalls mit Kind-Instanzen befüllte Hauptmodell-Instanz.
     */
    static create(MainClass, ChildClasses, layout, jsonData) {
        const mainInstance = new MainClass(layout);

        if (!Array.isArray(jsonData)) {
            return mainInstance;
        }

        const childBlueprints = Array.isArray(ChildClasses) ? ChildClasses : [ChildClasses];

        jsonData.forEach(itemData => {
            let matchedRowInstance = null;

            for (const ChildClass of childBlueprints) {
                if (typeof ChildClass.canHandle !== 'function' || ChildClass.canHandle(itemData)) {
                    matchedRowInstance = new ChildClass(itemData);
                    break;
                }
            }

            if (matchedRowInstance) {
                if (typeof mainInstance.appendRow === 'function') {
                    mainInstance.appendRow(matchedRowInstance);
                } else {
                    console.warn("Factory: Das Hauptmodell besitzt keine 'appendRow'-Schnittstelle.");
                }
            } else {
                console.warn("Factory: Kein passender Klassen-Blueprint für diesen Datensatz gefunden:", itemData);
            }
        });

        return mainInstance;
    }
}


/**
 * Generisches Key-Value-Objekt für Render-Daten.
 * @typedef {Record<string, any>} RenderData
 */
/**
 * Konfigurations- oder Datenobjekt für den Compile-Prozess von Templates.
 * @typedef {Object} TemplateCompileOptions
 * @property {RenderData} data - Die Daten, die in das Template gerendert werden sollen.
 */
/**
 * Interface für den Template-Service des Aspis-Frameworks.
 * Handles Compilation, Caching und das Laden von HTML-Templates.
 * @typedef {Object} TemplateService
 * @property {function(string, TemplateCompileOptions=): HTMLElement|Element|null} compile - Kompiliert ein Template direkt aus dem Cache oder Speicher.
 * @property {function(string): Promise<any>} get - Lädt die Template-Ressource asynchron nach, falls sie nicht vorhanden ist.
 */
/**
 * Interface für einen optionalen DOM-Tree-Cleaner (z. B. Event-Listener-Remover / Abort-Cleanup).
 * @typedef {Object} TreeCleaner
 * @property {function(HTMLElement): void} cleanTree - Säubert den DOM-Baum des Ziel-Elements von alten Listeners oder Subscriptions.
 */
/**
 * Schnittstelle für Objekte, die ein Aufbereiten ihrer Render-Daten über `toRenderData()` unterstützen.
 * @typedef {Object} RenderableItem
 * @property {function(): RenderData} toRenderData - Liefert die aufbereiteten Daten für das Rendering.
 */
/**
 * Beliebiges Element aus einer Datenliste für die Loop-Verarbeitung (Objekt mit `toRenderData` oder primitives JSON-Objekt).
 * @typedef {RenderableItem | RenderData} LoopItem
 */
/**
 * Möglicher Eingabetyp für Elemente, die in einen Ziel-Container zusammengefügt werden.
 * @typedef {Node | Array<Node>} AppendableElements
 */
/**
 * Interface für das globale GuardDOM-Utility zur HTML-Sanitisierung.
 * @typedef {Object} GuardDOMGlobal
 * @property {function(string): string} purify - Säubert einen HTML-String von potenziellen XSS-Vektoren.
 */
/**
 * Der Rückgabetyp der internen `#purifyElement`-Methode.
 * @typedef {Element | HTMLElement | null} PurifiedElement
 */

/**
 * Zentrale Rendering-Service-Klasse des Aspis-Frameworks.
 * Verwalter für das Asynchrone Kompilieren von Templates, Injizieren in das DOM,
 * Iterieren über Datenlisten und automatisches Anwenden von Sanitisierungs- und Cleanup-Routinen.
 * 
 * @public
 */
class RenderService {
    /**
     * Instanz des Template-Services zum Laden und Kompilieren.
     * @internal
     * @type {TemplateService}
     */
    #templates;

    /**
     * Optionaler TreeCleaner zum Säubern von DOM-Subtrees vor dem Auswechseln von Inhalten.
     * @internal
     * @type {TreeCleaner | null}
     */
    #cleaner;

    /**
     * Erzeugt eine neue Instanz des RenderService.
     * 
     * @public
     * @param {TemplateService} templateService - Der zu nutzende TemplateService.
     * @param {TreeCleaner|null} [cleaner=null] - Optionaler TreeCleaner für DOM-Bereinigungen.
     * @throws {Error} Wenn kein `templateService` übergeben wurde.
     */
    constructor(templateService, cleaner = null) {
        if (!templateService) {
            throw new Error("Aspis [RenderService]: TemplateService ist erforderlich.");
        }
        this.#templates = templateService;
        this.#cleaner = cleaner;
    }

    /**
     * Kompiliert ein Template mit den übergebenen Daten und fügt das gesäuberte Ergebnis
     * in den `targetContainer` ein (ersetzt dessen bisherigen Inhalt).
     * 
     * @public
     * @async
     * @param {HTMLElement} targetContainer - Das Ziel-Element im DOM, das den Inhalt aufnehmen soll.
     * @param {string} templateName - Der Name/Bezeichner des zu rendernden Templates.
     * @param {RenderData} [data={}] - Die Render-Daten für das Template.
     * @returns {Promise<Element>} Das erfolgreich erzeugte und injizierte DOM-Element.
     * @throws {Error} Wenn `targetContainer` kein gültiges `HTMLElement` ist oder das Rendering fehlschlägt.
     */
    async paste(targetContainer, templateName, data = {}) {
        if (!targetContainer || !(targetContainer instanceof HTMLElement)) {
            throw new Error("Aspis [RenderService]: Ungültiges Ziel-Element für paste().");
        }

        const element = await this.compile(templateName, data);
        if (!element) {
            throw new Error(`Aspis [RenderService]: Rendering für '${templateName}' fehlgeschlagen.`);
        }

        if (this.#cleaner && typeof this.#cleaner.cleanTree === 'function') {
            this.#cleaner.cleanTree(targetContainer);
        }

        const cleanElement = this.#purifyElement(element);
        targetContainer.replaceChildren(cleanElement);
        return cleanElement;
    }

    /**
     * Kompiliert ein Template mit Daten. Baut bei Bedarf eine Asynchron-Sperre auf,
     * um nicht geladene Templates aus der Quelle nachzuladen.
     * 
     * @public
     * @async
     * @param {string} templateName - Name des Templates.
     * @param {RenderData} [data={}] - Die Render-Daten.
     * @returns {Promise<HTMLElement | Element | null>} Das erzeugte DOM-Element oder `null`, wenn die Kompilierung fehlschlägt.
     */
    async compile(templateName, data = {}) {
        let element = this.#templates.compile(templateName, { data });

        if (!element) {
            const templateData = await this.#templates.get(templateName);
            if (templateData) {
                element = this.#templates.compile(templateName, { data });
            }
        }

        return element;
    }

    /**
     * Iteriert über ein Array von Daten-Objekten oder `RenderableItem`-Instanzen,
     * rendert für jedes Item das angegebene Template und liefert ein gesammeltes `DocumentFragment` zurück.
     * 
     * @public
     * @async
     * @param {string} templateName - Name des zu wiederholenden Templates.
     * @param {Array<LoopItem>} [list=[]] - Liste der Datenobjekte/Modelle.
     * @returns {Promise<DocumentFragment>} Ein `DocumentFragment` mit allen gerenderten und gesäuberten Elementen.
     */
    async loop(templateName, list = []) {
        if (!Array.isArray(list)) {
            console.warn("Aspis [RenderService]: loop() erwartet ein Array.");
            return document.createDocumentFragment();
        }

        const fragment = document.createDocumentFragment();

        for (const item of list) {
            const renderData = item && typeof item.toRenderData === 'function' 
                ? item.toRenderData() 
                : item;

            const element = await this.compile(templateName, renderData);
            if (element) {
                fragment.appendChild(this.#purifyElement(element));
            }
        }

        return fragment;
    }

    /**
     * Ersetzt die Kinder des Ziel-Containers durch ein einzelnes Element oder ein Array von Elementen.
     * 
     * @public
     * @param {HTMLElement} targetContainer - Das Ziel-DOM-Element.
     * @param {AppendableElements} [elements=[]] - Das einzufügende Node-Element oder ein Array davon.
     * @returns {void}
     * @throws {Error} Wenn `targetContainer` kein gültiges `HTMLElement` ist.
     */
    combine(targetContainer, elements = []) {
        if (!targetContainer || !(targetContainer instanceof HTMLElement)) {
            throw new Error("Aspis [RenderService]: Ungültiges Ziel-Element für combine().");
        }

        const nodeList = Array.isArray(elements) ? elements : [elements];
        targetContainer.replaceChildren(...nodeList);
    }

    /**
     * Säubert das übergebene DOM-Element über das globale `GuardDOM`-Utility (falls vorhanden).
     * 
     * @internal
     * @param {HTMLElement | Element | null} element - Das zu desinfizierende DOM-Element.
     * @returns {PurifiedElement} Das desinfizierte Element oder das Ausgangselement.
     */
    #purifyElement(element) {
        if (!element) return null;
        if (typeof GuardDOM !== 'undefined' && typeof GuardDOM.purify === 'function') {
            const cleanHtml = GuardDOM.purify(element.outerHTML);
            const template = document.createElement('template');
            template.innerHTML = cleanHtml;
            return template.content.firstElementChild || element;
        }
        return element;
    }
}


/**
 * Sanitizer-Funktion zur Bereinigung von Werten vor der HTML-Injektion.
 * @callback SanitizerFunction
 * @param {any} value - Der zu bereinigende Wert.
 * @returns {string} Der bereinigte/sanitisierte String.
 */
/**
 * Optionen zur Konfiguration der `TemplateService`-Instanz.
 * @typedef {Object} TemplateServiceOptions
 * @property {string} [basePath="./js/aspis/templates/"] - Basispfad für das Nachladen von externen Templates.
 * @property {SanitizerFunction|null} [sanitizer=null] - Benutzerdefinierte Sanitizer-Funktion. Fallback ist der interne Default-Sanitizer.
 * @property {boolean} [autoInit=true] - Steuert, ob beim Erzeugen direkt `init()` aufgerufen wird.
 */
/**
 * Konfigurationsobjekt, das als String (basePath) oder Optionsobjekt übergeben wird.
 * @typedef {string | TemplateServiceOptions} TemplateServiceConfig
 */
/**
 * Manifest- / Konfigurationsobjekt eines spezifischen Templates.
 * @typedef {Object} TemplateConfig
 * @property {string} [name] - Eindeutiger Name des Templates.
 * @property {Record<string, string>} [placeholder] - Platzhalter-Mapping.
 * @property {Record<string, string>} [slots] - Slot-Platzhalter.
 * @property {Record<string, string>} [attributes] - Attribut-Platzhalter.
 * @property {Record<string, string>} [files] - Mapping von Teil-Dateien beim Server-Fetch.
 * @property {string} [html] - Inline-HTML-String (optional).
 * @property {boolean} [partial] - Gibt an, ob es sich um ein Partial handelt.
 * @property {Record<string, any>} [events] - Registrierte Event-Handler oder Metadaten.
 * @property {Record<string, any>} [styles] - Stylesheet-Metadaten.
 * @property {Record<string, any>} [targets] - Target-Deklarationen.
 * @property {Record<string, any>} [bindings] - Data-Binding-Deklarationen.
 */
/**
 * Nach der Normalisierung im Cache gespeicherte Template-Struktur.
 * @typedef {Object} NormalizedTemplate
 * @property {string} id - Eindeutige Template-ID.
 * @property {string} role - Rolle des Templates (z.B. 'partial' oder 'container').
 * @property {boolean} isRoot - Gibt an, ob das Template ein Root-Element ist.
 * @property {string|null} childSlot - Standard-Child-Slot-Bezeichner.
 * @property {Array<string>} allowedChildren - Erlaubte Kind-Templates.
 * @property {Record<string, any>} events - Event-Konfigurationen.
 * @property {Record<string, any>} styles - Style-Konfigurationen.
 * @property {Record<string, any>} targets - DOM-Target-Zuordnungen.
 * @property {Record<string, any>} bindings - Data-Binding-Regeln.
 * @property {string} html - Aufbereiter HTML-Quelltext.
 * @property {Record<string, string>} slots - Map von Slot-Schlüsseln auf deren Platzhalter.
 * @property {Record<string, string>} attributes - Map von Attribut-Schlüsseln auf deren Platzhalter.
 * @property {Record<string, string>} data - Map von Daten-Schlüsseln auf deren Platzhalter.
 * @property {Array<[string, string]>} sortedData - Nach Länge absteigend sortierte Daten-Platzhalter-Paare.
 * @property {Array<[string, string]>} sortedAttributes - Nach Länge absteigend sortierte Attribut-Platzhalter-Paare.
 * @property {Record<string, string>} placeholder - Ursprüngliche Platzhalter-Map.
 * @property {TemplateConfig} config - Ursprüngliches Konfigurationsobjekt.
 */
/**
 * Möglicher Slot-Inhalt (einzelner Node, Array von Nodes, HTML/Text-String oder ein Array von Strings).
 * @typedef {Node | string | Array<Node | string>} SlotContent
 */
/**
 * Map von Slot-Namen zu den einzufügenden Inhalte-Nodes oder -Strings.
 * @typedef {Record<string, SlotContent>} SlotPayloadMap
 */
/**
 * Payload-Konfiguration für das Kompilieren eines Templates.
 * @typedef {Object} CompilePayload
 * @property {Record<string, any>} [data] - Daten-Ersatzwerte für Textplatzhalter.
 * @property {Record<string, any>} [attributes] - Werte für Attribut-Platzhalter.
 * @property {SlotPayloadMap} [slots] - Elemente oder Strings zur Befüllung von Slots.
 */
/**
 * Globales GuardDOM-Sicherheits-Utility (falls verfügbar).
 * @typedef {Object} GuardDOMGlobal
 * @property {function(any): string} [clean] - Bereinigt Eingabewerte.
 * @property {function(any): string} [purify] - Sanitisierte HTML-Strings.
 */

/**
 * Zentrale Template-Verwaltungs-Klasse des Aspis-Frameworks.
 * Zuständig für das Laden, Cachen, Parsing, Sanitisieren und Kompilieren
 * von HTML-Templates inkl. Slot-Handling und Data-Binding-Vorbereitungen.
 * 
 * @public
 */
class TemplateService {
    /**
     * Cache-Speicher für aufbereitete Template-Objekte.
     * @internal
     * @type {Map<string, NormalizedTemplate>}
     */
    #cache = new Map();

    /**
     * Basis-Pfad für das dynamische Nachladen von Server-Templates.
     * @internal
     * @type {string}
     */
    #basePath;

    /**
     * Aktive Sanitizer-Funktion zur Bereinigung von Datenwerten.
     * @internal
     * @type {SanitizerFunction}
     */
    #sanitizer;

    /**
     * Erzeugt eine neue Instanz des TemplateService.
     * 
     * @public
     * @param {TemplateServiceConfig} [config={}] - Basispfad als String oder Konfigurationsobjekt.
     */
    constructor(config = {}) {
        const options = typeof config === 'string' ? { basePath: config } : config;
        const { 
            basePath = "./js/aspis/templates/", 
            sanitizer = null, 
            autoInit = true 
        } = options;

        this.#basePath = basePath.endsWith('/') ? basePath : `${basePath}/`;
        this.#sanitizer = sanitizer || this.#defaultSanitizer.bind(this);

        if (autoInit) {
            this.init();
        }
    }

    /**
     * Liest im DOM vorhandene `<template>`-Elemente mit `data-config`-Attributen aus
     * und lädt diese in den internen Cache.
     * 
     * @public
     * @returns {void}
     */
    init() {
        const templateElements = document.querySelectorAll('template');
        
        templateElements.forEach(el => {
            const configAttr = el.dataset.config || el.getAttribute('data-config') || el.getAttribute('data-aspis-config');
            if (!configAttr) return;

            try {
                const config = JSON.parse(configAttr);
                const templateData = this.#normalizeTemplate(el.id, config, el.innerHTML);
                this.#cache.set(config.name || el.id, templateData);
            } catch (error) {
                console.error(`Aspis [TemplateService]: JSON-Parse-Fehler bei Template #${el.id}`, error);
            }
        });

        console.info(`Aspis [TemplateService]: Initialisiert. ${this.#cache.size} Templates aus dem DOM geladen.`);
    }

    /**
     * Prüft, ob ein Template unter dem angegebenen Namen im Cache vorhanden ist.
     * 
     * @public
     * @param {string} name - Der eindeutige Name des Templates.
     * @returns {boolean} `true`, wenn das Template im Cache existiert.
     */
    has(name) {
        return this.#cache.has(name);
    }

    /**
     * Leert den gesamten internen Template-Cache.
     * 
     * @public
     * @returns {void}
     */
    clearCache() {
        this.#cache.clear();
    }

    /**
     * Liefert das aufbereitete Template aus dem Cache oder versucht es asynchron vom Server zu laden.
     * 
     * @public
     * @async
     * @param {string} name - Der Name des Templates.
     * @returns {Promise<NormalizedTemplate | null>} Das geladene Template oder `null` im Fehlerfall.
     */
    async get(name) {
        if (this.#cache.has(name)) {
            return this.#cache.get(name);
        }

        console.warn(`Aspis [TemplateService]: '${name}' nicht im Cache. Starte dynamischen Fetch...`);
        try {
            return await this.#loadFromServer(name);
        } catch (error) {
            return null;
        }
    }

    /**
     * Kompiliert ein gecachtes Template anhand der übergebenen Payload (Daten, Attribute, Slots)
     * und erzeugt eine gebrauchsfertige HTML-Element-Instanz.
     * 
     * @public
     * @param {string} name - Name des zu kompilierenden Templates.
     * @param {CompilePayload} [payload={}] - Payload-Objekt mit Daten, Attributen und Slots.
     * @returns {Element | null} Das erzeugte DOM-Element oder `null` bei einem Fehler.
     */
    compile(name, payload = {}) {
        const template = this.#cache.get(name);
        if (!template) {
            console.error(`Aspis [TemplateService]: Template '${name}' nicht im Cache gefunden. Kompilierung abgebrochen.`);
            return null;
        }

        const payloadData = payload.data ?? {};
        const payloadAttributes = payload.attributes ?? {};
        const payloadSlots = payload.slots ?? {};

        let workingHtml = template.html;

        workingHtml = this.#replacePlaceholders(workingHtml, template.sortedData, payloadData);
        workingHtml = this.#replacePlaceholders(workingHtml, template.sortedAttributes, payloadAttributes);

        const fragment = document.createRange().createContextualFragment(workingHtml);
        const element = fragment.firstElementChild;

        if (!element) {
            console.error(`Aspis [TemplateService]: Transformation von '${name}' in den DOM fehlgeschlagen.`);
            return null;
        }

        this.#processSlots(element, template.slots, payloadSlots);

        return element;
    }

    /**
     * Liefert die für ein Template definierten Event-Konfigurationen zurück.
     * 
     * @public
     * @param {string} name - Name des Templates.
     * @returns {Record<string, any>} Event-Zuordnungen oder ein leeres Objekt.
     */
    getTemplateEvents(name) {
        return this.#cache.get(name)?.events ?? {};
    }

    /**
     * Ersetzt geordnete Platzhalter in einem HTML-String durch sanitisierte Werte.
     * 
     * @internal
     * @param {string} html - Der Ausgangs-HTML-String.
     * @param {Array<[string, string]>} sortedEntries - Sortierte Schlüssel-Platzhalter-Paare.
     * @param {Record<string, any>} values - Das Werte-Objekt für die Ersetzung.
     * @returns {string} Der verarbeitete HTML-String.
     */
    #replacePlaceholders(html, sortedEntries, values) {
        let result = html;
        for (const [key, placeholder] of sortedEntries) {
            const rawValue = values[key] ?? "";
            const cleanValue = this.#sanitizer(rawValue);
            result = result.replaceAll(placeholder, cleanValue);
        }
        return result;
    }

    /**
     * Ersetzt Slot-Platzhalter im erzeugten DOM-Baum durch die entsprechenden Payload-Inhalte.
     * 
     * @internal
     * @param {Element} rootElement - Das Wurzel-Element des kompilierten Templates.
     * @param {Record<string, string>} slotsMap - Das Mapping von Slot-Namen auf Platzhalter-Strings.
     * @param {SlotPayloadMap} payloadSlots - Die im Payload mitgegebenen Slot-Inhalte.
     * @returns {void}
     */
    #processSlots(rootElement, slotsMap, payloadSlots) {
        Object.entries(slotsMap).forEach(([key, placeholder]) => {
            const walker = document.createTreeWalker(rootElement, NodeFilter.SHOW_TEXT);
            let targetNode = null;
            let currentNode;

            while ((currentNode = walker.nextNode())) {
                if (currentNode.nodeValue.includes(placeholder)) {
                    targetNode = currentNode;
                    break;
                }
            }

            if (!targetNode) return;

            const parent = targetNode.parentNode;
            const slotContent = payloadSlots[key];

            if (!slotContent) {
                targetNode.remove();
                return;
            }

            if (Array.isArray(slotContent)) {
                slotContent.forEach(child => this.#appendSlotChild(parent, targetNode, child));
            } else {
                this.#appendSlotChild(parent, targetNode, slotContent);
            }

            targetNode.remove();
        });
    }

    /**
     * Fügt Slot-Inhalte vor einem Ziel-Textknoten ein.
     * 
     * @internal
     * @param {Node} parent - Das Vater-Element des Target-Nodes.
     * @param {Node} targetNode - Der zu ersetzende Text-Knoten mit dem Slot-Platzhalter.
     * @param {Node | string} content - Der einzufügende Knoten oder HTML/Text-String.
     * @returns {void}
     */
    #appendSlotChild(parent, targetNode, content) {
        if (content instanceof Node) {
            parent.insertBefore(content, targetNode);
        } else if (typeof content === "string") {
            const fragment = document.createRange().createContextualFragment(content);
            parent.insertBefore(fragment, targetNode);
        }
    }

    /**
     * Standard-Sanitizer zur Vorbeugung von XSS-Schwachstellen.
     * Nutzt `GuardDOM` falls vorhanden oder führt ein HTML-Entities-Escaping durch.
     * 
     * @internal
     * @param {any} val - Der zu sanitisierende Wert.
     * @returns {string} Der bereinigte String.
     */
    #defaultSanitizer(val) {
        if (typeof GuardDOM !== 'undefined') {
            if (typeof GuardDOM.clean === 'function') return GuardDOM.clean(val);
            if (typeof GuardDOM.purify === 'function') return GuardDOM.purify(val);
        }
        
        if (val === null || val === undefined) return '';
        return String(val)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /**
     * Lädt Manifest und Teildateien eines Templates per `fetch` vom Server.
     * 
     * @internal
     * @async
     * @param {string} name - Name des nachzuladenden Templates.
     * @returns {Promise<NormalizedTemplate>} Das geparste und normalisierte Template.
     * @throws {Error} Wenn das Manifest oder Teildateien nicht geladen werden können.
     */
    async #loadFromServer(name) {
        const url = `${this.#basePath}${name}/${name}.json`;
        
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Manifest für '${name}' nicht gefunden (Status ${response.status})`);
            const manifest = await response.json();

            let htmlString = "";
            if (manifest.files) {
                const fetchTasks = Object.entries(manifest.files).map(async ([, fileName]) => {
                    const htmlRes = await fetch(`${this.#basePath}${name}/${fileName}`);
                    if (!htmlRes.ok) throw new Error(`Teil-Datei '${fileName}' fehlt`);
                    return await htmlRes.text();
                });
                
                const htmlContents = await Promise.all(fetchTasks);
                htmlString = htmlContents.join("\n");
            } else if (manifest.html) {
                htmlString = manifest.html;
            }
            
            const templateData = this.#normalizeTemplate(name, manifest, htmlString);
            this.#cache.set(name, templateData);
            return templateData;
        } catch (error) {
            console.error(`Aspis [TemplateService]: Dynamischer Fetch für '${name}' fehlgeschlagen!`, error);
            throw error;
        }
    }

    /**
     * Normalisiert Rohteile eines Templates in ein einheitliches `NormalizedTemplate`-Objekt.
     * 
     * @internal
     * @param {string} id - Die ID / der Name des Templates.
     * @param {TemplateConfig} config - Die Manifest- / Template-Konfiguration.
     * @param {string} htmlString - Der ungefilterte HTML-String.
     * @returns {NormalizedTemplate} Das aufbereitete Template-Objekt.
     */
    #normalizeTemplate(id, config, htmlString) {
        const placeholders = config.placeholder || { ...config.slots, ...config.attributes } || {};
        const slots = {}, attributes = {}, data = {};

        Object.entries(placeholders).forEach(([key, value]) => {
            const isValuePlaceholder = String(value).startsWith('{{');
            const placeholder = isValuePlaceholder ? value : key;
            const cleanKey = placeholder.replace(/{{|}}/g, '');
            const type = isValuePlaceholder ? key : value;

            if (cleanKey.startsWith('slot') || ["temp", "temp-loop", "container"].includes(type)) {
                slots[cleanKey] = placeholder;
            } else if (cleanKey.startsWith('attr') || type === "attr") {
                attributes[cleanKey] = placeholder;
            } else {
                data[cleanKey] = placeholder;
            }
        });

        const sortByLengthDesc = (obj) => Object.entries(obj)
            .sort(([, a], [, b]) => b.length - a.length);

        const defaults = {
            id: id || config.name,
            role: config.partial ? 'partial' : 'container',
            isRoot: false,
            childSlot: null,
            allowedChildren: [],
            events: {},
            styles: {},
            targets: {},
            bindings: {}
        };

        return {
            ...defaults,
            ...config,
            html: htmlString.trim(),
            slots,
            attributes,
            data,
            sortedData: sortByLengthDesc(data),
            sortedAttributes: sortByLengthDesc(attributes),
            placeholder: placeholders,
            config
        };
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

/**
 * Zentrale Event-Dispatcher-Klasse des Aspis-Frameworks.
 * Bietet Publisher-Subscriber-Funktionalitäten (Pub/Sub), asynchrone Event-Verteilung via Microtasks,
 * Klick-Außerhalb-Erkennung (Click-Outside) sowie die Verwaltung globaler Dokument-Events.
 * 
 * @public
 */
class EventDispatcher {
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
                    console.error(`Aspis [EventDispatcher]: Fehler bei '${eventName}':`, error);
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
 * Zulässiger Eingabetyp für DOM-Ziel-Elemente (Einzelnes Element, Iterable/Array von Elementen oder Falsy-Wert).
 * @typedef {Element | Iterable<Element> | Array<Element> | null | undefined} DOMTarget
 */
/**
 * Style-Konfiguration innerhalb eines Slices.
 * @typedef {Object} SliceConfig
 * @property {Record<string, string>} [styles] - Mapping von Style-Schlüsseln zu CSS-Klassennamen.
 */
/**
 * Repräsentiert ein State-Slice-Objekt im Store.
 * @typedef {Object} StateSlice
 * @property {SliceConfig} [config] - Layout- und Binding-Konfiguration.
 * @property {Record<string, string>} [styles] - Direktes Style-Mapping auf Slice-Ebene.
 */
/**
 * Erlaubte Datentypen für Attribut-Werte.
 * @typedef {string | number | boolean | null | undefined} AttributeValue
 */

/**
 * Utility-Klasse des Aspis-Frameworks zur sicheren DOM-Manipulation
 * (Sichtbarkeit, Klassen-Management und Attribut-Steuerung).
 * 
 * @public
 */
class ModifierDOM {
    /**
     * Prüft, ob das übergebene Objekt eine gültige DOM-Element-Instanz ist.
     * 
     * @internal
     * @static
     * @param {any} target - Das zu prüfende Objekt.
     * @returns {boolean} `true`, wenn das Objekt eine `Element`-Instanz ist, sonst `false`.
     */
    static #isValid(target) {
        return target instanceof Element;
    }

    /**
     * Normalisiert verschiedene Eingabeformen (Element, Iterable, Array) in eine Liste von DOM-Elementen.
     * 
     * @internal
     * @static
     * @param {DOMTarget} target - Das zu normalisierende Ziel-Element oder Iterable.
     * @returns {Element[]} Array aus den extrahierten DOM-Elementen.
     */
    static #normalize(target) {
        if (!target) return [];
        if (target instanceof Element) return [target];
        if (typeof target[Symbol.iterator] === 'function' && typeof target !== 'string') {
            return Array.from(target);
        }
        return [];
    }

    /**
     * Macht das oder die Ziel-Elemente sichtbar (entfernt das `hidden`-Attribut sowie die `is-hidden`-Klasse).
     * 
     * @public
     * @static
     * @param {DOMTarget} target - Das oder die aufzuzeigenden DOM-Elemente.
     * @returns {void}
     */
    static show(target) {
        this.#normalize(target).forEach(el => {
            if (!this.#isValid(el)) return;
            el.removeAttribute('hidden');
            el.classList.remove('is-hidden');
        });
    }

    /**
     * Versteckt das oder die Ziel-Elemente (setzt das `hidden`-Attribut und fügt die `is-hidden`-Klasse hinzu).
     * 
     * @public
     * @static
     * @param {DOMTarget} target - Das oder die zu versteckenden DOM-Elemente.
     * @returns {void}
     */
    static hide(target) {
        this.#normalize(target).forEach(el => {
            if (!this.#isValid(el)) return;
            el.setAttribute('hidden', '');
            el.classList.add('is-hidden');
        });
    }

    /**
     * Fügt eine oder mehrere Leerzeichen-getrennte CSS-Klassen zu den Ziel-Elementen hinzu.
     * 
     * @public
     * @static
     * @param {DOMTarget} target - Das oder die Ziel-Elemente.
     * @param {string} classNames - Ein oder mehrere Leerzeichen-getrennte CSS-Klassennamen.
     * @returns {void}
     */
    static addClass(target, classNames) {
        if (!classNames || typeof classNames !== 'string') return;
        const classes = classNames.split(/\s+/).filter(Boolean);
        if (classes.length === 0) return;

        this.#normalize(target).forEach(el => {
            if (!this.#isValid(el)) return;
            el.classList.add(...classes);
        });
    }

    /**
     * Entfernt eine oder mehrere Leerzeichen-getrennte CSS-Klassen von den Ziel-Elementen.
     * 
     * @public
     * @static
     * @param {DOMTarget} target - Das oder die Ziel-Elemente.
     * @param {string} classNames - Ein oder mehrere Leerzeichen-getrennte CSS-Klassennamen.
     * @returns {void}
     */
    static removeClass(target, classNames) {
        if (!classNames || typeof classNames !== 'string') return;
        const classes = classNames.split(/\s+/).filter(Boolean);
        if (classes.length === 0) return;

        this.#normalize(target).forEach(el => {
            if (!this.#isValid(el)) return;
            el.classList.remove(...classes);
        });
    }

    /**
     * Schaltet eine oder mehrere Leerzeichen-getrennte CSS-Klassen auf den Ziel-Elementen um.
     * 
     * @public
     * @static
     * @param {DOMTarget} target - Das oder die Ziel-Elemente.
     * @param {string} className - Ein oder mehrere Leerzeichen-getrennte CSS-Klassennamen.
     * @param {boolean} [force] - Optionaler Schalter: `true` erzwingt Hinzufügen, `false` Entfernen.
     * @returns {void}
     */
    static toggleClass(target, className, force) {
        if (!className || typeof className !== 'string') return;
        const classes = className.split(/\s+/).filter(Boolean);

        this.#normalize(target).forEach(el => {
            if (!this.#isValid(el)) return;

            classes.forEach(cls => {
                if (force !== undefined) {
                    el.classList.toggle(cls, !!force);
                } else {
                    el.classList.toggle(cls);
                }
            });
        });
    }

    /**
     * Schaltet eine CSS-Klasse basierend auf einer State-Slice-Konfiguration um.
     * 
     * @public
     * @static
     * @param {DOMTarget} target - Das oder die Ziel-Elemente.
     * @param {StateSlice} slice - Das State-Slice mit der Style-Konfiguration.
     * @param {string} styleKey - Der Schlüssel des Styles im Slice.
     * @param {boolean} isActive - Bestimmt, ob die Klasse hinzugefügt (`true`) oder entfernt (`false`) wird.
     * @returns {void}
     */
    static toggleSliceClass(target, slice, styleKey, isActive) {
        if (!slice) return;

        const classMapping = slice?.config?.styles?.[styleKey] 
            || slice?.styles?.[styleKey] 
            || slice?.[styleKey] 
            || styleKey;

        if (typeof classMapping === 'string') {
            if (isActive) {
                this.addClass(target, classMapping);
            } else {
                this.removeClass(target, classMapping);
            }
        }
    }

    /**
     * Setzt, aktualisiert oder entfernt ein HTML-Attribut auf den Ziel-Elementen.
     * 
     * @public
     * @static
     * @param {DOMTarget} target - Das oder die Ziel-Elemente.
     * @param {string} attrName - Der Name des HTML-Attributes.
     * @param {AttributeValue} value - Der Wert (`null`/`undefined`/`false` entfernt das Attribut, `true` setzt ein Boolean/Aria-Attribut).
     * @returns {void}
     */
    static attr(target, attrName, value) {
        if (!attrName || typeof attrName !== 'string') return;

        this.#normalize(target).forEach(el => {
            if (!this.#isValid(el)) return;
            
            if (value === null || value === undefined || value === false) {
                el.removeAttribute(attrName);
            } else if (value === true) {
                el.setAttribute(attrName, attrName.startsWith('aria-') ? 'true' : '');
            } else {
                el.setAttribute(attrName, String(value));
            }
        });
    }
}


/**
 * Konfiguration für ein einzelnes Ziel-Element.
 * @typedef {Object} TargetConfig
 * @property {string} selector - Der CSS-Selektor zur Elementauswahl (z. B. '.my-class' oder ':scope').
 */
/**
 * Zuordnung von Ziel-Namen zu ihren jeweiligen Selektor-Konfigurationen.
 * @typedef {Record<string, TargetConfig>} TargetsConfig
 */
/**
 * Map, die aufgelöste Ziel-Namen den entsprechenden HTML-Elementen zuordnet.
 * @typedef {Map<string, HTMLElement>} ResolvedTargetsMap
 */

/**
 * Utility-Klasse des Aspis-Frameworks zur Auflösung von DOM-Ziel-Elementen basierend auf Konfigurationsobjekten.
 * 
 * @public
 */
class TargetResolver {
    /**
     * Löst Ziel-Elemente innerhalb eines Container-Elements anhand einer gegebenen Konfiguration auf.
     * 
     * @public
     * @static
     * @param {HTMLElement | null | undefined} container - Das übergeordnete Container-Element, in dem gesucht wird.
     * @param {TargetsConfig | null | undefined} targetsConfig - Konfigurationsobjekt mit den zu suchenden Selektoren.
     * @returns {ResolvedTargetsMap} Eine Map mit den Ziel-Namen als Schlüssel und den gefundenen HTML-Elementen als Werte.
     */
    static resolve(container, targetsConfig) {
        const resolvedTargets = new Map();
        if (!targetsConfig || !(container instanceof HTMLElement)) return resolvedTargets;

        Object.entries(targetsConfig).forEach(([targetName, config]) => {
            let element = null;

            if (config.selector === ':scope') {
                element = container;
            } else {
                element = container.querySelector(config.selector);
            }

            if (element) {
                resolvedTargets.set(targetName, element);
            } else {
                console.warn(`[TargetResolver]: Element für Selektor '${config.selector}' nicht im DOM gefunden.`);
            }
        });

        return resolvedTargets;
    }
}


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
class ManifestBinder {
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
        
        console.log(`[ManifestBinder]: Auto-Bindings für '${this.#sliceKey}' erfolgreich etabliert.`);
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
        console.log(`[ManifestBinder]: Auto-Bindings für '${this.#sliceKey}' sauber gelöst.`);
    }
}

/**
 * Zuordnung/Interface der Observer-Registry im Aspis-Framework.
 * @typedef {Object.<string, any>} ObserverRegistry
 */
/**
 * Zulässiges Ziel-Element für Beobachtungen.
 * @typedef {Node} ObserverTarget
 */

/**
 * Abstrakte Basisklasse für alle Observer-Implementierungen des Aspis-Frameworks.
 * 
 * @abstract
 * @public
 */
class BaseObserver {
    /**
     * Referenz auf die zugewiesene Observer-Registry.
     * @internal
     * @type {ObserverRegistry | null}
     */
    #registry;

    /**
     * Indikator, ob die Beobachtung aktuell aktiv ist.
     * @internal
     * @type {boolean}
     */
    #isObserving = false;

    /**
     * Set der aktuell beobachteten DOM-Knoten.
     * @internal
     * @type {Set<Node>}
     */
    #targets = new Set();

    /**
     * Erstellt eine neue Instanz des BaseObservers.
     * 
     * @public
     * @param {ObserverRegistry} registry - Die Registry-Instanz zur Verwaltung des Observers.
     * @throws {TypeError} Wirft einen Fehler, wenn die abstrakte Klasse direkt instanziiert wird.
     */
    constructor(registry) {
        if (new.target === BaseObserver) {
            throw new TypeError("Aspis [BaseObserver]: Instanziierung der abstrakten Basisklasse ist nicht erlaubt.");
        }
        this.#registry = registry;
    }

    /**
     * Liefert die aktuell zugewiesene Observer-Registry.
     * 
     * @public
     * @type {ObserverRegistry | null}
     */
    get registry() {
        return this.#registry;
    }

    /**
     * Gibt an, ob der Observer derzeit aktiv Beobachtungen durchführt.
     * 
     * @public
     * @type {boolean}
     */
    get isObserving() {
        return this.#isObserving;
    }

    /**
     * Liefert eine Kopie aller aktuell beobachteten DOM-Knoten als Array.
     * 
     * @public
     * @type {Node[]}
     */
    get targets() {
        return Array.from(this.#targets);
    }

    /**
     * Aktiviert den Observer und fügt optional ein erstes Ziel-Element hinzu.
     * 
     * @public
     * @param {ObserverTarget} [target] - Optionales DOM-Ziel-Element, das sofort beobachtet werden soll.
     * @returns {void}
     */
    start(target) {
        this.#isObserving = true;
        if (target) {
            this.#targets.add(target);
        }
    }

    /**
     * Deaktiviert den Observer und entfernt alle bisher registrierten Ziel-Elemente.
     * 
     * @public
     * @returns {void}
     */
    stop() {
        this.#isObserving = false;
        this.#targets.clear();
    }

    /**
     * Registriert ein neues DOM-Ziel-Element für die Beobachtung.
     * 
     * @public
     * @param {ObserverTarget} target - Das hinzuzufügende DOM-Element (muss eine Instanz von `Node` sein).
     * @returns {void}
     */
    observe(target) {
        if (!(target instanceof Node)) return;
        this.#targets.add(target);
    }

    /**
     * Entfernt ein bestimmtes DOM-Ziel-Element aus der Beobachtung.
     * 
     * @public
     * @param {ObserverTarget} target - Das zu entfernende DOM-Ziel-Element.
     * @returns {void}
     */
    unobserve(target) {
        this.#targets.delete(target);
    }

    /**
     * Stoppt die Beobachtung vollständig und hebt die Referenz auf die Registry auf.
     * 
     * @public
     * @returns {void}
     */
    destroy() {
        this.stop();
        this.#registry = null;
    }
}

/**
 * Interface des Cleaner-Services zur Bereinigung von DOM-Bäumen.
 * @typedef {Object} CleanerService
 * @property {(node: HTMLElement) => void} cleanTree - Bereinigt Instanzen und Binding-Referenzen im übergebenen DOM-Baum.
 */
/**
 * Registry-Interface für Services und Manager im Aspis-Framework.
 * @typedef {Object} ObserverRegistry
 * @property {(key: string) => any} get - Holt eine registrierte Service-Instanz (z. B. 'cleaner').
 */
/**
 * Zulässiges Ziel-Element für Mutation-Beobachtungen.
 * @typedef {Node} ObserverTarget
 */
/**
 * Konfigurationsobjekt für den nativen MutationObserver der Web-API.
 * @typedef {MutationObserverInit} ObserverConfig
 */
/**
 * Repräsentiert das Ergebnis eines DOM-Scans.
 * @typedef {Object.<string, any>} ScanResult
 */

/**
 * Observer-Klasse des Aspis-Frameworks zur Überwachung von DOM-Mutationen
 * (Hinzufügen und Entfernen von DOM-Knoten) sowie zur automatischen Lifecycle-Steuerung von Controllern.
 * 
 * @public
 * @extends {BaseObserver}
 */
class MutationObserverDOM extends BaseObserver {
    /**
     * Referenz auf die native `MutationObserver`-Instanz der Web-API.
     * @internal
     * @type {MutationObserver | null}
     */
    #nativeObserver = null;

    /**
     * Startet die Mutation-Beobachtung auf dem Ziel-Element.
     * 
     * @public
     * @param {ObserverTarget} [target=document.body] - Das zu überwachende DOM-Ziel-Element.
     * @param {ObserverConfig} [config={ childList: true, subtree: true }] - Konfiguration für den MutationObserver.
     * @returns {void}
     */
    start(target = document.body, config = { childList: true, subtree: true }) {
        if (this.isObserving) return;

        this.#nativeObserver = new MutationObserver((mutations) => this.#handleMutations(mutations));
        this.#nativeObserver.observe(target, config);

        super.start(target);
        console.info("Aspis [MutationObserverDOM]: Wächter aktiv.");
    }

    /**
     * Fügt ein weiteres Ziel-Element zur laufenden Mutation-Beobachtung hinzu.
     * 
     * @public
     * @param {ObserverTarget} target - Das hinzuzufügende DOM-Ziel-Element.
     * @param {ObserverConfig} [config={ childList: true, subtree: true }] - Konfiguration für den MutationObserver.
     * @returns {void}
     */
    observe(target, config = { childList: true, subtree: true }) {
        if (!(target instanceof Node)) return;
        super.observe(target);
        if (this.#nativeObserver) {
            this.#nativeObserver.observe(target, config);
        }
    }

    /**
     * Stoppt die globale Mutation-Beobachtung und trennt den nativen Observer.
     * 
     * @public
     * @override
     * @returns {void}
     */
    stop() {
        if (this.#nativeObserver) {
            this.#nativeObserver.disconnect();
            this.#nativeObserver = null;
        }
        super.stop();
        console.info("Aspis [MutationObserverDOM]: Wächter gestoppt.");
    }

    /**
     * Verarbeitet auftretende DOM-Mutationen, führt automatische Aufräumarbeiten durch
     * und initialisiert nachgeladene Controller im DOM.
     * 
     * @internal
     * @param {MutationRecord[]} mutations - Array der vom Browser gelieferten MutationRecords.
     * @returns {Promise<void>}
     */
    async #handleMutations(mutations) {
        const addedNodes = [];
        const cleaner = this.registry?.get('cleaner');

        for (const mutation of mutations) {
            mutation.removedNodes.forEach(node => {
                if (node instanceof HTMLElement) {
                    cleaner?.cleanTree(node);
                }
            });

            mutation.addedNodes.forEach(node => {
                if (node instanceof HTMLElement) {
                    addedNodes.push(node);
                }
            });
        }

        if (addedNodes.length > 0 && typeof ScannerDOM !== 'undefined' && typeof Main !== 'undefined') {
            for (const rootNode of addedNodes) {
                const scanResults = ScannerDOM.scan(rootNode);
                if (scanResults.length > 0) {
                    await Main.assignControllers(scanResults, this.registry);
                    console.info(`Aspis [MutationObserverDOM]: ${scanResults.length} neue Controller im nachgeladenen DOM entdeckt und initialisiert.`);
                }
            }
        }
    }

    /**
     * Zerstört die Observer-Instanz, stoppt alle Listeners und löst Referenzen auf.
     * 
     * @public
     * @override
     * @returns {void}
     */
    destroy() {
        this.stop();
        super.destroy();
    }
}

/**
 * Mögliche Eingabetypen für die Textbereinigung und Escaping.
 * @typedef {string | number | boolean | null | undefined | any} SafeInput
 */
/**
 * Der Rückgabewert der Textbereinigung (bereinigter String, Number oder Boolean).
 * @typedef {string | number | boolean} CleanResult
 */

/**
 * Mögliche Eingabetypen für die HTML-Bereinigung.
 * @typedef {string | any} HTMLInput
 */

/**
 * Utility-Klasse des Aspis-Frameworks zur Bereinigung und Entschärfung (Sanitization)
 * von Strings und HTML-Inhalten zum Schutz vor Cross-Site Scripting (XSS).
 * 
 * @public
 */
class GuardDOM {
    /**
     * Konvertiert einen unsicheren Eingabewert in einen HTML-escapeten String.
     * Primitive Typen wie `boolean` oder `number` werden direkt unverändert zurückgegeben,
     * `null` und `undefined` liefern einen leeren String.
     * 
     * @public
     * @static
     * @param {SafeInput} unsafeText - Der zu bereinigende/escapende Wert.
     * @returns {CleanResult} Der escapete String oder der ursprüngliche primitive Wert.
     */
    static clean(unsafeText) {
        if (typeof unsafeText === 'boolean' || typeof unsafeText === 'number') return unsafeText;
        if (unsafeText === null || unsafeText === undefined) return '';
        const str = String(unsafeText);
        
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    /**
     * Bereinigt einen HTML-String, indem verbotene Tags (z. B. `<script>`), Event-Handler (`on*`)
     * und unsichere URIs (`javascript:`, `vbscript:`, `data:text/html`) entfernt bzw. entschärft werden.
     * 
     * @public
     * @static
     * @template {HTMLInput} T
     * @param {T} rawHTML - Der zu bereinigende HTML-String oder ein unmanipulierter Wert.
     * @returns {T extends string ? string : T} Der bereinigte HTML-String oder der unveränderte Eingabewert.
     */
    static purify(rawHTML) {
        if (typeof rawHTML !== 'string') return rawHTML;

        const parser = new DOMParser();
        const doc = parser.parseFromString(rawHTML, 'text/html');
        const forbiddenTags = new Set(['SCRIPT', 'IFRAME', 'OBJECT', 'EMBED', 'FRAME', 'FRAMESET']);
        const allElements = doc.body.querySelectorAll('*');
        
        allElements.forEach(element => {
            if (forbiddenTags.has(element.tagName)) {
                element.remove();
                console.warn(`Aspis [GuardDOM]: Gefährlicher Tag <${element.tagName.toLowerCase()}> wurde entfernt.`);
                return;
            }

            Array.from(element.attributes).forEach(attr => {
                const attrName = attr.name.toLowerCase();
                const attrValue = attr.value.trim().toLowerCase();

                if (attrName.startsWith('on')) {
                    element.removeAttribute(attr.name);
                    console.warn(`Aspis [GuardDOM]: Event-Handler '${attr.name}' entfernt.`);
                }

                if (['href', 'src', 'action', 'data'].includes(attrName)) {
                    if (attrValue.startsWith('javascript:') || attrValue.startsWith('vbscript:') || attrValue.startsWith('data:text/html')) {
                        element.setAttribute(attr.name, '#');
                        console.warn(`Aspis [GuardDOM]: Unsichere URL in '${attr.name}' auf '#' zurückgesetzt.`);
                    }
                }
            });
        });

        return doc.body.innerHTML;
    }
}

/**
 * Mögliche Typen für Werte von Formularelementen (String, Boolean, Array von Strings oder Null).
 * @typedef {string | boolean | string[] | null} FormFieldValue
 */
/**
 * Validierungsregeln für ein Formularfeld.
 * @typedef {Record<string, any>} FieldRules
 */
/**
 * Repräsentiert den vollständigen State-Zustand eines Formularfeldes.
 * @typedef {Object} FieldState
 * @property {FormFieldValue} value - Der aktuelle Wert des Feldes.
 * @property {FieldRules} rules - Die zugewiesenen Validierungsregeln.
 * @property {string | null} error - Die aktuelle Fehlermeldung oder `null`, wenn gültig.
 * @property {boolean} isTouched - Indikator, ob das Feld bereits fokussiert/verlassen wurde.
 * @property {boolean} isDirty - Indikator, ob der Wert vom Initialwert abweicht.
 */

/**
 * Service-Klasse des Aspis-Frameworks zum Auslesen von Feldnamen und Werten aus DOM-Elementen
 * sowie zur Erzeugung standardisierter Formularfeld-States.
 * 
 * @public
 */
class FormFieldService {
    /**
     * Ermittelt den logischen Namen eines DOM-Elements (basiert auf `name`, `data-name` oder `id`).
     * 
     * @public
     * @static
     * @param {Element | any} element - Das zu prüfende DOM-Element.
     * @returns {string | null} Der gefundene Name oder `null`, wenn kein Name ermittelt werden konnte.
     */
    static getFieldName(element) {
        if (!(element instanceof Element)) return null;
        return element.name || element.dataset.name || element.id || null;
    }

    /**
     * Liest den aktuellen Wert eines Formular- oder DOM-Elements aus.
     * Berücksichtigt `data-value`, Checkboxen, Radiobuttons (inkl. Gruppenprüfung im Formular) und Multiple-Selects.
     * 
     * @public
     * @static
     * @param {Element | HTMLInputElement | HTMLSelectElement | HTMLElement | any} element - Das DOM-Element, dessen Wert ausgelesen werden soll.
     * @returns {FormFieldValue} Der ausgelesene Wert oder `null`, wenn kein gültiges Element übergeben wurde.
     */
    static getValue(element) {
        if (!(element instanceof Element)) return null;

        if (element.dataset.value !== undefined) {
            return element.dataset.value;
        }

        if (element.type === 'checkbox') return element.checked;
        if (element.type === 'radio') {
            const form = element.form || element.closest('form');
            if (form && element.name) {
                const checked = form.querySelector(`input[name="${CSS.escape(element.name)}"]:checked`);
                return checked ? checked.value : '';
            }
            return element.checked ? element.value : '';
        }

        if (element.tagName === 'SELECT' && element.multiple) {
            return Array.from(element.selectedOptions).map(opt => opt.value);
        }

        return element.value ?? '';
    }

    /**
     * Erstellt ein standardisiertes State-Objekt für ein Formularfeld.
     * 
     * @public
     * @static
     * @param {FormFieldValue} [initialValue=''] - Der anfängliche Wert des Feldes.
     * @param {FieldRules} [rules={}] - Ein Objekt mit den Validierungsregeln für das Feld.
     * @returns {FieldState} Das initialisierte Feld-State-Objekt.
     */
    static createFieldState(initialValue = '', rules = {}) {
        return {
            value: initialValue,
            rules: rules,
            error: null,
            isTouched: false,
            isDirty: false
        };
    }
}


/**
 * Validator-Funktion zur Überprüfung eines Wertes.
 * @typedef {(value: any, param?: any) => boolean} ValidationRuleFn
 */
/**
 * Objektstruktur für eine erweiterte Regel-Konfiguration.
 * @typedef {Object} RuleConfigObject
 * @property {any} [param] - Der Parameter für die Regel (z. B. Mindestlänge oder Regex-Muster).
 * @property {string} [message] - Die benutzerdefinierte Fehlermeldung.
 */
/**
 * Tupel-Struktur für eine kompakte Regel-Konfiguration: [Parameter, Fehlermeldung].
 * @typedef {[any, string]} RuleConfigTuple
 */
/**
 * Mögliche Konfigurationsformen für eine einzelne Validierungsregel.
 * @typedef {boolean | string | RuleConfigTuple | RuleConfigObject} RuleConfig
 */
/**
 * Mapping von Regel-Namen zu ihren jeweiligen Konfigurationen für ein Feld.
 * @typedef {Record<string, RuleConfig>} FieldRules
 */
/**
 * Key-Value-Objekt der zu validierenden Formularwerte.
 * @typedef {Record<string, any>} FormValues
 */
/**
 * Validierungsschema für ein gesamtes Formular (Mapping von Feldnamen zu FieldRules).
 * @typedef {Record<string, FieldRules>} FormSchema
 */
/**
 * Mapping von Feldnamen zu ihren jeweiligen Fehlermeldungen.
 * @typedef {Record<string, string>} FormErrors
 */

/**
 * Service-Klasse des Aspis-Frameworks zur Validierung einzelner Formularfelder
 * sowie kompletter Formular-Datensätze anhand konfigurierbarer Prüfregeln.
 * 
 * @public
 */
class ValidationService {

    /**
     * Interne Registry der verfügbaren Validierungsregeln.
     * @internal
     * @type {Record<string, ValidationRuleFn>}
     */
    static #rules = {
        required: (value) => {
            if (value === null || value === undefined) return false;
            if (typeof value === 'string') return value.trim().length > 0;
            if (Array.isArray(value)) return value.length > 0;
            return true;
        },
        email: (value) => {
            if (!value) return true;
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
        },
        minLength: (value, param) => {
            if (!value) return true;
            return String(value).length >= Number(param);
        },
        maxLength: (value, param) => {
            if (!value) return true;
            return String(value).length <= Number(param);
        },
        numeric: (value) => {
            if (!value) return true;
            return !isNaN(parseFloat(value)) && isFinite(value);
        },
        pattern: (value, param) => {
            if (!value) return true;
            const regex = new RegExp(param);
            return regex.test(value);
        }
    };

    /**
     * Registriert eine neue benutzerdefinierte Validierungsregel im Service.
     * 
     * @public
     * @static
     * @param {string} name - Der eindeutige Name der Validierungsregel.
     * @param {ValidationRuleFn} fn - Die Prüffunktion, die `true` bei Gültigkeit und `false` bei einem Fehler zurückgibt.
     * @returns {void}
     */
    static registerRule(name, fn) {
        if (typeof fn === 'function') {
            this.#rules[name] = fn;
        }
    }

    /**
     * Validiert einen einzelnen Wert gegen ein Set definierter Regeln.
     * 
     * @public
     * @static
     * @param {any} value - Der zu prüfende Wert.
     * @param {FieldRules} [rules={}] - Ein Objekt mit den anzuwendenden Validierungsregeln.
     * @returns {string | null} Die erste aufgetretene Fehlermeldung oder `null`, wenn der Wert gültig ist.
     */
    static validateField(value, rules = {}) {
        for (const [ruleName, config] of Object.entries(rules)) {
            let param = null;
            let message = "Ungültiger Wert";

            if (Array.isArray(config)) {
                [param, message] = config;
            } else if (typeof config === 'string') {
                message = config;
            } else if (typeof config === 'object' && config !== null) {
                param = config.param;
                message = config.message || message;
            }

            const ruleFn = this.#rules[ruleName];
            if (ruleFn && !ruleFn(value, param)) {
                return message;
            }
        }
        return null;
    }

    /**
     * Validiert ein komplettes Objekt von Formularwerten gegen ein definiertes Schema.
     * 
     * @public
     * @static
     * @param {FormValues} values - Key-Value-Paare der Formularfeld-Werte.
     * @param {FormSchema} [schema={}] - Das Schema mit den Validierungsregeln pro Feld.
     * @returns {FormErrors} Ein Objekt, das fehlgeschlagenen Feldern ihre jeweilige Fehlermeldung zuordnet.
     */
    static validateForm(values, schema = {}) {
        const errors = {};

        for (const [fieldName, rules] of Object.entries(schema)) {
            const fieldValue = values[fieldName];
            const error = this.validateField(fieldValue, rules);

            if (error) {
                errors[fieldName] = error;
            }
        }
        return errors;
    }
}


// ----------------------------------------------------------------------------


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


/**
 * Interface für den reaktiven Haupt-Store des Aspis-Frameworks.
 * @typedef {Object} Store
 * @property {function(HTMLElement, string): void} addDependency - Registriert eine DOM-Element-Bindung an einen State-Pfad.
 * @property {function(HTMLElement): void} removeDomDependencies - Entfernt ein Element aus allen Store-Reaktivitäts-Trackern.
 */

/**
 * Utility-Klasse des Aspis-Frameworks zum Scannen und Verwalten von DOM-Abhängigkeiten.
 * Liest `data-depends-on`-Attribute aus und registriert bzw. entfernt die entsprechenden Bindungen im Store.
 * 
 * @public
 */
class DomDependencyScanner {
    /**
     * Scannt einen DOM-Container (sowie das Root-Element) nach `data-depends-on`-Attributen
     * und registriert alle gefundenen State-Pfade als Abhängigkeiten im Store.
     * 
     * @public
     * @static
     * @param {HTMLElement} container - Das Wurzel-Element, ab dem gescannt wird.
     * @param {Store} store - Die Store-Instanz, in der die Abhängigkeiten registriert werden.
     * @returns {void}
     */
    static register(container, store) {
        if (!container || !store || typeof store.addDependency !== 'function') return;

        const elements = [];
        if (container.dataset?.dependsOn) {
            elements.push(container);
        }

        const childElements = container.querySelectorAll('[data-depends-on]');
        elements.push(...childElements);

        elements.forEach(element => {
            const rawAttr = element.dataset.dependsOn;
            if (!rawAttr) return;

            const paths = rawAttr.split(/[\s,]+/).map(p => p.trim()).filter(Boolean);
            paths.forEach(path => {
                store.addDependency(element, path);
            });
        });
    }

    /**
     * Entfernt alle registrierten Store-Abhängigkeiten für einen DOM-Container
     * und dessen Unterelemente mit `data-depends-on`-Attributen.
     * 
     * @public
     * @static
     * @param {HTMLElement} container - Das Wurzel-Element des abzumeldenden DOM-Teilbaums.
     * @param {Store} store - Die Store-Instanz, aus der die Abhängigkeiten entfernt werden.
     * @returns {void}
     */
    static unregister(container, store) {
        if (!container || !store || typeof store.removeDomDependencies !== 'function') return;

        store.removeDomDependencies(container);

        const childElements = container.querySelectorAll('[data-depends-on]');
        childElements.forEach(child => store.removeDomDependencies(child));
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

/**
 * Utility-Klasse des Aspis-Frameworks zur Steuerung und Initialisierung von visuellen Ladezuständen.
 * Liest Konfigurationsattribute (`data-loader`, `data-loader-template`) aus einem DOM-Container aus
 * und weist dem State-Proxy das entsprechende Lade-Modell zu.
 * 
 * @public
 */
class LoadingStateHelper {
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

/**
 * Verwalter für delegierte DOM-Events und globale Dispatcher-Abonnements innerhalb des Aspis-Frameworks.
 * Kapselt das Event-Handling auf Container-Ebene und unterstützt dynamisches Event-Mapping via Remote-Path oder dataset.
 * 
 * @public
 */
class EventDelegator {
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
            console.warn(`Aspis [${this.#target.constructor.name}]: delegate() abgebrochen — kein Container vorhanden.`);
            return;
        }

        if (typeof handler !== 'function') {
            console.warn(`Aspis [${this.#target.constructor.name}]: Handler für Event '${eventName}' ist keine Funktion.`);
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
                    console.error(`Aspis [${this.#target.constructor.name}]: Fehler beim Laden von '${this.#options.eventPath}':`, e);
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
                console.error(`Aspis [${this.#target.constructor.name}]: Fehler beim Parsen von data-events an <${this.#target.constructor.name}>:`, e);
            }
        }

        Object.entries(eventMap).forEach(([eventName, methodName]) => {
            if (typeof this.#target[methodName] === 'function') {
                const unsub = this.#dispatcher.on(eventName, (payload) => this.#target[methodName](payload));
                this.#unsubscribeEvents.push(unsub);
            } else {
                console.warn(`Aspis [${this.#target.constructor.name}]: Event '${eventName}' verweist auf nicht existierende Methode '${methodName}' in ${this.#target.constructor.name}.`);
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
 * Konfigurationsoptionen für die Initialisierung von BaseModel-Instanzen.
 * @typedef {Object} ModelOptions
 * @property {string} [layout='default'] - Der Name oder Bezeichner des zu verwendenden Templates/Layouts.
 * @property {Record<string, any>} [key: string] - Beliebige weitere optionale Daten oder Konfigurationseigenschaften.
 */
/**
 * Interface für globale HTML-Bereinigungs-Utilities (GuardDOM).
 * @typedef {Object} GuardDOMInterface
 * @property {function(string): string} clean - Bereinigt einen Eingabestring von potenziell gefährlichem HTML/XSS-Code.
 */
/**
 * Generische Datenstruktur, wie sie von Unterklassen für Render-Prozesse aufbereitet wird.
 * @typedef {Record<string, any>} ModelRenderData
 */

/**
 * Abstrakte Basisklasse für Datenmodelle im Aspis-Framework.
 * Stellt Kernfunktionen zur Layoutverwaltung, Daten-Sanitisierung und Schnittstellen
 * für die Template-Aufbereitung bereit.
 * 
 * @public
 */
class BaseModel {
    /**
     * Der Name des aktuell zugewiesenen Layout-Templates.
     * @internal
     * @type {string}
     */
    _layout = 'default';

    /**
     * Konfigurationseinstellungen des Modells.
     * @internal
     * @type {ModelOptions}
     */
    _options = {};

    /**
     * Erzeugt eine neue Instanz des BaseModel.
     * 
     * @public
     * @param {ModelOptions} [options={}] - Optionale Konfigurationsobjekte zur Initialisierung.
     */
    constructor(options = {}) {
        this._options = typeof options === 'object' && options !== null ? { ...options } : {};
        if (this._options.layout) {
            this._layout = String(this._options.layout);
        }
    }

    /**
     * Bereinigt rekursiv Strings, Arrays und Objekte, um XSS-Schwachstellen zu vermeiden.
     * Nutzt `GuardDOM.clean`, falls verfügbar, und behält DOM-Nodes unberührt.
     * 
     * @internal
     * @template T
     * @param {T} data - Die zu bereinigenden Daten (String, Array, Objekt oder primitive Werte).
     * @returns {T} Die bereinigte Datenstruktur des gleichen Typs.
     */
    _sanitize(data) {
        if (typeof data === 'string') {
            return typeof GuardDOM !== 'undefined' ? GuardDOM.clean(data) : data;
        }
        if (Array.isArray(data)) {
            return data.map(item => this._sanitize(item));
        }
        if (data !== null && typeof data === 'object' && !(data instanceof Node)) {
            const cleanObj = {};
            for (const [key, value] of Object.entries(data)) {
                cleanObj[key] = this._sanitize(value);
            }
            return cleanObj;
        }
        return data;
    }

    /**
     * Setzt das anzuwendende Layout-Template.
     * 
     * @public
     * @param {string|any} layout - Der Bezeichner des gewünschten Layouts.
     * @returns {void}
     */
    setLayout(layout) {
        this._layout = String(layout);
    }

    /**
     * Der Bezeichner des aktuell eingestellten Layouts.
     * 
     * @public
     * @type {string}
     */
    get layout() {
        return this._layout;
    }

    /**
     * Bereitet die Modelldaten für das Template-Rendering auf.
     * Muss von konkreten Unterklassen überschrieben werden.
     * 
     * @public
     * @abstract
     * @returns {ModelRenderData} Das aufbereitete Datenobjekt für den Render-Prozess.
     * @throws {Error} Wenn die abstrakte Methode nicht in der abgeleiteten Klasse implementiert wurde.
     */
    toRenderData() {
        throw new Error(`Aspis [BaseModel]: '${this.constructor.name}' muss die Methode 'toRenderData()' implementieren.`);
    }
}


/**
 * Basis-Optionen für Modelle im Aspis-Framework.
 * @typedef {Object} BaseModelOptions
 * @property {string} [layout='default'] - Das zugewiesene Template-Layout des Modells.
 */
/**
 * Basisklasse BaseModel im Aspis-Framework.
 * @typedef {Object} BaseModel
 * @property {string} _layout - Das zugewiesene Template-Layout des Modells.
 * @property {(input: string) => string} _sanitize - Sanitizes-Methode zur Bereinigung von Strings zur Vermeidung von XSS.
 */
/**
 * Optionsobjekt zur Initialisierung des ModelLoader.
 * @typedef {Object} ModelLoaderOptionsObject
 * @property {string} [message='Lade...'] - Die anzuzeigende Lade-Nachricht.
 * @property {string} [layout='default'] - Das zu verwendende Template-Layout.
 */
/**
 * Erlaubte Parameter-Typen für den Konstruktor des `ModelLoader` (Optionsobjekt oder direkter Nachrichten-String).
 * @typedef {ModelLoaderOptionsObject | string} ModelLoaderOptions
 */
/**
 * Für das Template-Rendering aufbereitete Datenstruktur des Lade-Modells.
 * @typedef {Object} ModelLoaderRenderData
 * @property {string} layout - Das zu verwendende Template-Layout.
 * @property {string} message - Die bereinigte Lade-Nachricht.
 */

/**
 * Modell-Klasse des Aspis-Frameworks zur Repräsentation von Ladezuständen (Loader/Spinner) und Lade-Nachrichten.
 * 
 * @public
 * @extends {BaseModel}
 */
class ModelLoader extends BaseModel {
    /**
     * Die intern gespeicherte, bereinigte Lade-Nachricht.
     * @internal
     * @type {string}
     */
    #message;

    /**
     * Erstellt eine neue Instanz des ModelLoader.
     * 
     * @public
     * @param {ModelLoaderOptions} [options={}] - Konfigurationsoptionen oder direkt die Lade-Nachricht als String.
     */
    constructor(options = {}) {
        const opts = typeof options === 'string'
            ? { message: options }
            : (options && typeof options === 'object' ? options : {});

        super(opts);
        this.setMessage(opts.message);
    }

    /**
     * Liefert die aktuell gesetzte Lade-Nachricht zurück.
     * 
     * @public
     * @type {string}
     */
    get message() {
        return this.#message;
    }

    /**
     * Setzt die Lade-Nachricht, führt eine Typkonvertierung durch, wendet bei leeren Werten den Standardtext ('Lade...') an und bereinigt den String.
     * 
     * @public
     * @param {any} [msg] - Die zu setzende Nachricht (wird intern zu String konvertiert).
     * @returns {void}
     */
    setMessage(msg) {
        const str = (msg !== null && msg !== undefined) ? String(msg) : '';
        const rawMsg = str || 'Lade...';
        this.#message = this._sanitize(rawMsg);
    }

    /**
     * Bereitet die Daten des Lade-Modells für die Übergabe an das Rendering-System vor.
     * 
     * @public
     * @returns {ModelLoaderRenderData} Das Rendering-Datenobjekt mit Layout und Nachricht.
     */
    toRenderData() {
        return {
            layout: this._layout,
            message: this.#message
        };
    }
}


/**
 * Basis-Optionen für Modelle im Aspis-Framework.
 * @typedef {Object} BaseModelOptions
 * @property {string} [layout='default'] - Das zugewiesene Template-Layout des Modells.
 */
/**
 * Basisklasse BaseModel im Aspis-Framework.
 * @typedef {Object} BaseModel
 * @property {string} _layout - Das zugewiesene Template-Layout des Modells.
 * @property {(input: string) => string} _sanitize - Sanitizes-Methode zur Bereinigung von Strings zur Vermeidung von XSS.
 */
/**
 * Optionsobjekt zur Initialisierung des ModelLoader.
 * @typedef {Object} ModelLoaderOptionsObject
 * @property {string} [message='Lade...'] - Die anzuzeigende Lade-Nachricht.
 * @property {string} [layout='default'] - Das zu verwendende Template-Layout.
 */
/**
 * Erlaubte Parameter-Typen für den Konstruktor des `ModelLoader`.
 * @typedef {ModelLoaderOptionsObject | string} ModelLoaderOptions
 */
/**
 * Modell-Klasse des Aspis-Frameworks zur Repräsentation von Ladezuständen.
 * @typedef {Object} ModelLoader
 * @property {string} message - Liefert die aktuell gesetzte Lade-Nachricht zurück.
 * @property {(msg?: any) => void} setMessage - Setzt die Lade-Nachricht.
 * @property {() => { layout: string, message: string }} toRenderData - Bereitet die Daten für das Rendering vor.
 */
/**
 * Optionsobjekt zur Initialisierung des ModelSpinner.
 * @typedef {Object} ModelSpinnerOptionsObject
 * @property {string} [message='Lade Daten...'] - Die anzuzeigende Lade-Nachricht des Spinners.
 * @property {string} [layout='spinner'] - Das zu verwendende Spinner-Template-Layout.
 */
/**
 * Erlaubte Parameter-Typen für den Konstruktor des `ModelSpinner` (Optionsobjekt oder direkter Nachrichten-String).
 * @typedef {ModelSpinnerOptionsObject | string} ModelSpinnerOptions
 */

/**
 * Spezialisierte Modell-Klasse des Aspis-Frameworks zur Repräsentation eines visuellen Ladeindikators (Spinner) mit Standard-Layout 'spinner'.
 * 
 * @public
 * @extends {ModelLoader}
 */
class ModelSpinner extends ModelLoader {
    /**
     * Erstellt eine neue Instanz des ModelSpinner und setzt Standardwerte für Nachricht ('Lade Daten...') und Layout ('spinner').
     * 
     * @public
     * @param {ModelSpinnerOptions} [options={}] - Konfigurationsoptionen für den Spinner oder direkt die Lade-Nachricht als String.
     */
    constructor(options = {}) {
        let message = 'Lade Daten...';
        let layout = 'spinner';

        if (typeof options === 'string') {
            message = options;
        } else if (options && typeof options === 'object') {
            message = options.message || 'Lade Daten...';
            layout = options.layout || 'spinner';
        }

        super({
            layout: layout,
            message: message
        });
    }
}


/**
 * Basis-Optionen für Modelle im Aspis-Framework.
 * @typedef {Object} BaseModelOptions
 * @property {string} [layout='default'] - Das zugewiesene Template-Layout des Modells.
 */
/**
 * Basisklasse BaseModel im Aspis-Framework.
 * @typedef {Object} BaseModel
 * @property {string} _layout - Das zugewiesene Template-Layout des Modells.
 * @property {(input: string) => string} _sanitize - Sanitizes-Methode zur Bereinigung von Strings zur Vermeidung von XSS.
 */
/**
 * Optionsobjekt zur Initialisierung des ModelLoader.
 * @typedef {Object} ModelLoaderOptionsObject
 * @property {string} [message='Lade...'] - Die anzuzeigende Lade-Nachricht.
 * @property {string} [layout='default'] - Das zu verwendende Template-Layout.
 */
/**
 * Erlaubte Parameter-Typen für den Konstruktor des `ModelLoader`.
 * @typedef {ModelLoaderOptionsObject | string} ModelLoaderOptions
 */
/**
 * Für das Template-Rendering aufbereitete Datenstruktur des Lade-Modells.
 * @typedef {Object} ModelLoaderRenderData
 * @property {string} layout - Das zu verwendende Template-Layout.
 * @property {string} message - Die bereinigte Lade-Nachricht.
 */
/**
 * Modell-Klasse des Aspis-Frameworks zur Repräsentation von Ladezuständen.
 * @typedef {Object} ModelLoader
 * @property {string} message - Liefert die aktuell gesetzte Lade-Nachricht zurück.
 * @property {(msg?: any) => void} setMessage - Setzt die Lade-Nachricht.
 * @property {() => ModelLoaderRenderData} toRenderData - Bereitet die Daten für das Rendering vor.
 */
/**
 * Optionsobjekt zur Initialisierung des ModelLoadingBar.
 * @typedef {Object} ModelLoadingBarOptionsObject
 * @property {number} [progress=0] - Der anfängliche Fortschrittswert in Prozent (0–100).
 * @property {string} [message='Lade...'] - Die anzuzeigende Lade-Nachricht.
 * @property {string} [layout='bar'] - Das zu verwendende Ladebalken-Template-Layout.
 */
/**
 * Erlaubte Parameter-Typen für den Konstruktor des `ModelLoadingBar` (Optionsobjekt, direkter Nachrichten-String oder direkter Fortschrittswert als Zahl).
 * @typedef {ModelLoadingBarOptionsObject | string | number} ModelLoadingBarOptions
 */
/**
 * Für das Template-Rendering aufbereitete Datenstruktur des Ladebalken-Modells.
 * @typedef {Object} ModelLoadingBarRenderData
 * @property {string} layout - Das zu verwendende Template-Layout.
 * @property {string} message - Die bereinigte Lade-Nachricht.
 * @property {number} progress - Der aktuelle Fortschrittswert in Prozent (0–100).
 */

/**
 * Modell-Klasse des Aspis-Frameworks zur Repräsentation einer Fortschrittsanzeige (Loading Bar) mit prozentualem Status.
 * 
 * @public
 * @extends {ModelLoader}
 */
class ModelLoadingBar extends ModelLoader {
    /**
     * Der interne Fortschrittswert in Prozent (begrenzt auf 0 bis 100).
     * @internal
     * @type {number}
     */
    #progress = 0;

    /**
     * Erstellt eine neue Instanz des ModelLoadingBar.
     * 
     * @public
     * @param {ModelLoadingBarOptions} [options={}] - Konfigurationsoptionen für die Fortschrittsanzeige, eine Zahl als Fortschrittswert oder ein String als Lade-Nachricht.
     */
    constructor(options = {}) {
        let progressVal = 0;
        let message = 'Lade...';
        let layout = 'bar';

        if (typeof options === 'number') {
            progressVal = options;
        } else if (typeof options === 'string') {
            message = options;
        } else if (options && typeof options === 'object') {
            progressVal = options.progress;
            message = options.message || 'Lade...';
            layout = options.layout || 'bar';
        }

        super({
            layout: layout,
            message: message
        });

        this.setProgress(progressVal);
    }

    /**
     * Liefert den aktuellen Fortschrittswert in Prozent zurück.
     * 
     * @public
     * @type {number}
     */
    get progress() {
        return this.#progress;
    }

    /**
     * Setzt den Fortschrittswert in Prozent. Konvertiert den Eingabewert zu einer Zahl und begrenzt diesen strikt auf den Bereich von 0 bis 100.
     * 
     * @public
     * @param {any} percent - Der zu setzende Fortschrittswert (wird zu `Number` konvertiert; ungültige/NaN-Werte werden auf 0 gesetzt).
     * @returns {void}
     */
    setProgress(percent) {
        const val = Number(percent);
        if (Number.isNaN(val)) {
            this.#progress = 0;
            return;
        }
        this.#progress = Math.min(100, Math.max(0, val));
    }

    /**
     * Bereitet die Daten der Fortschrittsanzeige für das Rendering-System vor.
     * 
     * @public
     * @returns {ModelLoadingBarRenderData} Das aufbereitete Datenobjekt mit Layout-, Nachrichten- und Fortschrittsdaten.
     */
    toRenderData() {
        return {
            ...super.toRenderData(),
            progress: this.#progress
        };
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
class ControllerTable extends BaseController {
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
                console.error("[ControllerTable]: Fehler im loadData-Ablauf", error);
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
            console.error("[ControllerTable]: Fehler beim Generieren der Reload-URL", e);
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
                console.log(`[ControllerTable]: HTML für '${this._sliceKey}' erfolgreich ins DOM injiziert.`);
            } else {
                console.warn("[ControllerTable]: RenderService ist nicht verfügbar.");
            }
        } catch (error) {
            if (!this.signal.aborted) {
                console.error("[ControllerTable]: Render-Fehler", error);
            }
        }
    }
}


/**
 * Basis-Optionen für Modelle im Aspis-Framework.
 * @typedef {Object} BaseModelOptions
 * @property {string} [layout='default'] - Das zugewiesene Template-Layout des Modells.
 */
/**
 * Basisklasse BaseModel im Aspis-Framework.
 * @typedef {Object} BaseModel
 * @property {string} _layout - Das zugewiesene Template-Layout des Modells.
 * @property {<T>(input: T) => T} _sanitize - Sanitizes-Methode zur Bereinigung von Eingaben zur Vermeidung von XSS.
 */
/**
 * Optionsobjekt zur Initialisierung des ModelTable.
 * @typedef {Object} ModelTableOptionsObject
 * @property {string} [layout='default'] - Das zu verwendende Template-Layout der Tabelle.
 */
/**
 * Erlaubte Parameter-Typen für die Optionen des `ModelTable` (Optionsobjekt oder direkter Layout-String).
 * @typedef {ModelTableOptionsObject | string} ModelTableOptions
 */
/**
 * Struktur der Rohdaten, die an `ModelTable` übergeben werden können.
 * Can either be a array of row items directly, or an object containing a `rows` or `data` array.
 * @typedef {Array<Record<string, any> | InstanceType<typeof ModelTable.Row>> | { rows?: Array<Record<string, any> | InstanceType<typeof ModelTable.Row>>, data?: Array<Record<string, any> | InstanceType<typeof ModelTable.Row>> }} ModelTableRawData
 */
/**
 * Für das Template-Rendering aufbereitete Datenstruktur einer Tabellenzeile.
 * @typedef {Record<string, any>} ModelTableRowRenderData
 */
/**
 * Für das Template-Rendering aufbereitete Datenstruktur des Tabellen-Modells.
 * @typedef {Object} ModelTableRenderData
 * @property {string} layout - Das zu verwendende Template-Layout.
 * @property {ModelTableRowRenderData[]} rows - Die aufbereiteten Daten aller Tabellenzeilen.
 */

/**
 * Modell-Klasse des Aspis-Frameworks zur Repräsentation und Manipulation von Tabellendaten.
 * 
 * @public
 * @extends {BaseModel}
 */
class ModelTable extends BaseModel {
    /**
     * Statische geschachtelte Klasse zur Repräsentation einer einzelnen Tabellenzeile.
     * 
     * @public
     * @static
     * @extends {BaseModel}
     */
    static Row = class ModelTableRow extends BaseModel {
        /**
         * Die intern gespeicherten, bereinigten Daten der Zeile.
         * @internal
         * @type {Record<string, any>}
         */
        #data = {};

        /**
         * Erstellt eine neue Instanz einer Tabellenzeile.
         * 
         * @public
         * @param {Record<string, any>} [data={}] - Die Daten der Zeile als Schlüssel-Wert-Paare.
         */
        constructor(data = {}) {
            super();
            if (data && typeof data === 'object') {
                this.#data = this._sanitize(data);
            }
        }

        /**
         * Ruft den Wert eines bestimmten Schlüssels aus den Zeilendaten ab.
         * 
         * @public
         * @param {string} key - Der Name des abzurufenden Feldes.
         * @returns {any} Der Wert des Feldes oder `undefined`, wenn der Schlüssel nicht existiert.
         */
        get(key) {
            return this.#data[key];
        }

        /**
         * Bereitet die Daten der Zeile für das Template-Rendering vor.
         * 
         * @public
         * @returns {ModelTableRowRenderData} Eine flache Kopie der internen Zeilendaten.
         */
        toRenderData() {
            return { ...this.#data };
        }

        /**
         * Prüft statisch, ob die übergebenen Daten von einer `ModelTableRow`-Instanz verarbeitet werden können.
         * 
         * @public
         * @static
         * @param {any} data - Der zu prüfende Wert.
         * @returns {boolean} `true`, wenn es sich um ein valides Objekt handelt, sonst `false`.
         */
        static canHandle(data) {
            return data && typeof data === 'object';
        }
    };

    /**
     * Alias-Referenz auf `ModelTable.Row` zur konsistenten Nutzung im Framework.
     * 
     * @public
     * @static
     * @type {typeof ModelTable.Row}
     */
    static Item = ModelTable.Row;

    /**
     * Die interne Liste aller verwalteten Zeilen-Instanzen.
     * @internal
     * @type {InstanceType<typeof ModelTable.Row>[]}
     */
    #rows = [];

    /**
     * Erstellt eine neue Instanz des ModelTable.
     * 
     * @public
     * @param {ModelTableRawData} [rawData=[]] - Die Rohdaten für die Tabelle (Array oder Objekt mit `rows`/`data`).
     * @param {ModelTableOptions} [options={}] - Konfigurationsoptionen oder direkt der Layout-Name als String.
     */
    constructor(rawData = [], options = {}) {
        const opts = typeof options === 'string' ? { layout: options } : options;
        super(opts);

        const list = Array.isArray(rawData)
            ? rawData
            : (rawData?.rows || rawData?.data || []);

        this.buildRows(list);
    }

    /**
     * Liefert eine flache Kopie des Arrays aller Tabellenzeilen zurück.
     * 
     * @public
     * @type {InstanceType<typeof ModelTable.Row>[]}
     */
    get rows() {
        return [...this.#rows];
    }

    /**
     * Baut das interne Zeilen-Array aus den übergebenen Rohdaten auf.
     * Filtert ungültige Daten heraus und konvertiert Plain Objects in `ModelTable.Row`-Instanzen.
     * 
     * @public
     * @param {Array<Record<string, any> | InstanceType<typeof ModelTable.Row>>} rawData - Array von Datenobjekten oder bereits instanziierten `ModelTable.Row`-Objekten.
     * @returns {void}
     */
    buildRows(rawData) {
        this.#rows = rawData
            .filter(data => ModelTable.Row.canHandle(data))
            .map(data => data instanceof ModelTable.Row ? data : new ModelTable.Row(data));
    }

    /**
     * Fügt eine einzelne Zeile oder ein Datenobjekt ans Ende der Tabelle an.
     * 
     * @public
     * @param {Record<string, any> | InstanceType<typeof ModelTable.Row>} data - Eine `ModelTable.Row`-Instanz oder ein entsprechendes Datenobjekt.
     * @returns {void}
     */
    appendRow(data) {
        if (data instanceof ModelTable.Row) {
            this.#rows.push(data);
        } else if (data && typeof data === 'object') {
            this.#rows.push(new ModelTable.Row(data));
        }
    }

    /**
     * Leert alle gespeicherten Zeilen aus der Tabelle.
     * 
     * @public
     * @returns {void}
     */
    clearRows() {
        this.#rows = [];
    }

    /**
     * Bereitet die Gesamtdaten der Tabelle für das Rendering-System vor.
     * 
     * @public
     * @returns {ModelTableRenderData} Das aufbereitete Datenobjekt mit Layout und Zeilen-Render-Daten.
     */
    toRenderData() {
        return {
            layout: this._layout,
            rows: this.#rows.map(row => row.toRenderData())
        };
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
class ControllerAccordion extends BaseController {
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
                console.error("[ControllerAccordion]: Fehler im loadData-Ablauf", error);
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
                console.log(`[ControllerAccordion]: HTML für '${this._sliceKey}' erfolgreich im DOM aktualisiert.`);
            } else {
                console.warn("[ControllerAccordion]: RenderService ist nicht verfügbar.");
            }
        } catch (error) {
            if (!this.signal.aborted) {
                console.error("[ControllerAccordion]: Render-Fehler", error);
            }
        }
    }
}


/**
 * Basis-Optionen für Modelle im Aspis-Framework.
 * @typedef {Object} BaseModelOptions
 * @property {string} [layout='default'] - Das zugewiesene Template-Layout des Modells.
 */
/**
 * Basisklasse BaseModel im Aspis-Framework.
 * @typedef {Object} BaseModel
 * @property {string} _layout - Das zugewiesene Template-Layout des Modells.
 * @property {<T>(input: T) => T} _sanitize - Sanitizes-Methode zur Bereinigung von Eingaben zur Vermeidung von XSS.
 */
/**
 * Rohdaten für ein einzelnes Accordion-Element.
 * @typedef {Object} ModelAccordionItemRawData
 * @property {string} [id] - Eindeutige ID des Elements (wird automatisch generiert, wenn nicht angegeben).
 * @property {string} [title=''] - Titel/Header des Accordion-Elements.
 * @property {string} [content=''] - Inhalt des Accordion-Elements.
 * @property {boolean} [isOpen=false] - Gibt an, ob das Element initial geöffnet ist.
 * @property {boolean} [disabled=false] - Gibt an, ob das Element deaktiviert ist.
 */
/**
 * Für das Template-Rendering aufbereitete Datenstruktur eines Accordion-Elements.
 * @typedef {Object} ModelAccordionItemRenderData
 * @property {string} id - Eindeutige ID des Elements.
 * @property {string} title - Bereinigter Titel des Elements.
 * @property {string} content - Bereinigter Inhalt des Elements.
 * @property {boolean} isOpen - Öffnungsstatus des Elements.
 * @property {boolean} disabled - Deaktivierungsstatus des Elements.
 */
/**
 * Optionsobjekt zur Initialisierung des ModelAccordion.
 * @typedef {Object} ModelAccordionOptionsObject
 * @property {string} [layout='default'] - Das zu verwendende Template-Layout.
 * @property {boolean} [singleOpen=false] - Wenn true, kann jeweils nur ein Element gleichzeitig geöffnet sein.
 */
/**
 * Erlaubte Parameter-Typen für die Optionen des `ModelAccordion` (Optionsobjekt oder direkter Layout-String).
 * @typedef {ModelAccordionOptionsObject | string} ModelAccordionOptions
 */
/**
 * Struktur der Rohdaten, die an `ModelAccordion` übergeben werden können.
 * Array von Elemente-Objekten oder ein Objekt mit `items`- bzw. `data`-Array.
 * @typedef {Array<ModelAccordionItemRawData | InstanceType<typeof ModelAccordion.Item>> | { items?: Array<ModelAccordionItemRawData | InstanceType<typeof ModelAccordion.Item>>, data?: Array<ModelAccordionItemRawData | InstanceType<typeof ModelAccordion.Item>> }} ModelAccordionRawData
 */
/**
 * Für das Template-Rendering aufbereitete Datenstruktur des Accordion-Modells.
 * @typedef {Object} ModelAccordionRenderData
 * @property {string} layout - Das zu verwendende Template-Layout.
 * @property {boolean} singleOpen - Modus für Einzelanzeige geöffneter Elemente.
 * @property {ModelAccordionItemRenderData[]} items - Aufbereitete Daten aller Accordion-Elements.
 */

/**
 * Modell-Klasse des Aspis-Frameworks zur Repräsentation und Steuerung eines Akkordeon-Steuerelements (Accordion).
 * 
 * @public
 * @extends {BaseModel}
 */
class ModelAccordion extends BaseModel {
    /**
     * Statische geschachtelte Klasse zur Repräsentation eines einzelnen Accordion-Eintrags.
     * 
     * @public
     * @static
     * @extends {BaseModel}
     */
    static Item = class ModelAccordionItem extends BaseModel {
        /**
         * Eindeutige ID des Accordion-Elements.
         * @internal
         * @type {string}
         */
        #id;

        /**
         * Der Titel des Accordion-Elements.
         * @internal
         * @type {string}
         */
        #title;

        /**
         * Der Text/Inhalt des Accordion-Elements.
         * @internal
         * @type {string}
         */
        #content;

        /**
         * Status, ob das Element geöffnet ist.
         * @internal
         * @type {boolean}
         */
        #isOpen;

        /**
         * Status, ob das Element deaktiviert ist.
         * @internal
         * @type {boolean}
         */
        #disabled;

        /**
         * Erstellt eine neue Instanz eines Accordion-Elements.
         * 
         * @public
         * @param {ModelAccordionItemRawData} [data={}] - Die Initialisierungsdaten des Elements.
         */
        constructor(data = {}) {
            super();
            const sanitized = this._sanitize(data);

            const rawId = sanitized.id || `acc-item-${Math.random().toString(36).substring(2, 9)}`;
            this.#id = String(rawId);
            this.#title = String(sanitized.title || '');
            this.#content = String(sanitized.content || '');
            this.#isOpen = Boolean(data.isOpen);
            this.#disabled = Boolean(data.disabled);
        }

        /**
         * Liefert die ID des Elements zurück.
         * 
         * @public
         * @type {string}
         */
        get id() { return this.#id; }

        /**
         * Liefert den Titel des Elements zurück.
         * 
         * @public
         * @type {string}
         */
        get title() { return this.#title; }

        /**
         * Liefert den Inhalt des Elements zurück.
         * 
         * @public
         * @type {string}
         */
        get content() { return this.#content; }

        /**
         * Liefert den Öffnungsstatus des Elements zurück.
         * 
         * @public
         * @type {boolean}
         */
        get isOpen() { return this.#isOpen; }

        /**
         * Liefert den Deaktivierungsstatus des Elements zurück.
         * 
         * @public
         * @type {boolean}
         */
        get disabled() { return this.#disabled; }

        /**
         * Setzt den Öffnungsstatus des Elements. Bei deaktivierten Elementen erfolgt keine Änderung.
         * 
         * @public
         * @param {boolean} open - Der neue Öffnungsstatus.
         * @returns {void}
         */
        setOpen(open) {
            if (this.#disabled) return;
            this.#isOpen = Boolean(open);
        }

        /**
         * Wechselt den Öffnungsstatus des Elements (Öffnen/Schließen). Bei deaktivierten Elementen erfolgt keine Änderung.
         * 
         * @public
         * @returns {void}
         */
        toggle() {
            if (this.#disabled) return;
            this.#isOpen = !this.#isOpen;
        }

        /**
         * Bereitet die Daten des Elements für das Rendering vor.
         * 
         * @public
         * @returns {ModelAccordionItemRenderData} Objekt mit allen Render-Daten des Elements.
         */
        toRenderData() {
            return {
                id: this.#id,
                title: this.#title,
                content: this.#content,
                isOpen: this.#isOpen,
                disabled: this.#disabled
            };
        }

        /**
         * Prüft statisch, ob die übergebenen Daten von einer `ModelAccordionItem`-Instanz verarbeitet werden können.
         * 
         * @public
         * @static
         * @param {any} data - Der zu prüfende Wert.
         * @returns {boolean} `true`, wenn es sich um ein valides Objekt handelt, sonst `false`.
         */
        static canHandle(data) {
            return data && typeof data === 'object';
        }
    };

    /**
     * Die interne Liste aller verwalteten Accordion-Elements.
     * @internal
     * @type {InstanceType<typeof ModelAccordion.Item>[]}
     */
    #items = [];

    /**
     * Modus-Flag: Wenn `true`, darf maximal ein Element gleichzeitig geöffnet sein.
     * @internal
     * @type {boolean}
     */
    #singleOpen = false;

    /**
     * Erstellt eine neue Instanz des ModelAccordion.
     * 
     * @public
     * @param {ModelAccordionRawData} [rawData=[]] - Die Rohdaten für das Akkordeon (Array oder Objekt mit `items`/`data`).
     * @param {ModelAccordionOptions} [options={}] - Konfigurationsoptionen oder direkt der Layout-Name als String.
     */
    constructor(rawData = [], options = {}) {
        const opts = typeof options === 'string' ? { layout: options } : options;
        super(opts);

        this.#singleOpen = Boolean(opts.singleOpen);

        const list = Array.isArray(rawData)
            ? rawData
            : (rawData?.items || rawData?.data || []);

        this.buildItems(list);
    }

    /**
     * Liefert zurück, ob der Single-Open-Modus aktiv ist.
     * 
     * @public
     * @type {boolean}
     */
    get singleOpen() { return this.#singleOpen; }

    /**
     * Liefert eine flache Kopie des Arrays aller Accordion-Elements zurück.
     * 
     * @public
     * @type {InstanceType<typeof ModelAccordion.Item>[]}
     */
    get items() { return [...this.#items]; }

    /**
     * Erstellt die interne Element-Liste aus den übergebenen Rohdaten.
     * Ungültige Daten werden gefiltert, Plain Objects in `ModelAccordion.Item`-Instanzen konvertiert.
     * 
     * @public
     * @param {Array<ModelAccordionItemRawData | InstanceType<typeof ModelAccordion.Item>>} rawData - Liste von Datenobjekten oder Instanzen.
     * @returns {void}
     */
    buildItems(rawData) {
        this.#items = rawData
            .filter(data => ModelAccordion.Item.canHandle(data))
            .map(data => data instanceof ModelAccordion.Item ? data : new ModelAccordion.Item(data));
    }

    /**
     * Sucht ein Element anhand seiner ID.
     * 
     * @public
     * @param {string} itemId - Die gesuchte Element-ID.
     * @returns {InstanceType<typeof ModelAccordion.Item>|null} Das gefundene Element oder `null`.
     */
    getItem(itemId) {
        return this.#items.find(item => item.id === itemId) || null;
    }

    /**
     * Umschaltet den Status eines Elements über dessen ID.
     * Beachtet die `singleOpen`-Regel und schließt bei Bedarf andere Elemente.
     * 
     * @public
     * @param {string} itemId - Die ID des umzuschaltenden Elements.
     * @returns {InstanceType<typeof ModelAccordion.Item>|null} Das geänderte Element oder `null`, falls es nicht existiert oder deaktiviert ist.
     */
    toggleItem(itemId) {
        const targetItem = this.getItem(itemId);
        if (!targetItem || targetItem.disabled) return null;

        const nextState = !targetItem.isOpen;

        if (this.#singleOpen && nextState) {
            this.#items.forEach(item => {
                if (item.id !== itemId) item.setOpen(false);
            });
        }

        targetItem.setOpen(nextState);
        return targetItem;
    }

    /**
     * Öffnet ein bestimmtes Element anhand seiner ID.
     * Beachtet die `singleOpen`-Regel und schließt ggf. alle anderen Elemente.
     * 
     * @public
     * @param {string} itemId - Die ID des zu öffnenden Elements.
     * @returns {void}
     */
    openItem(itemId) {
        const targetItem = this.getItem(itemId);
        if (!targetItem || targetItem.disabled) return;

        if (this.#singleOpen) {
            this.#items.forEach(item => item.setOpen(false));
        }
        targetItem.setOpen(true);
    }

    /**
     * Schließt ein bestimmtes Element anhand seiner ID.
     * 
     * @public
     * @param {string} itemId - Die ID des zu schließenden Elements.
     * @returns {void}
     */
    closeItem(itemId) {
        const targetItem = this.getItem(itemId);
        if (targetItem) {
            targetItem.setOpen(false);
        }
    }

    /**
     * Öffnet alle Elemente des Akkordeons.
     * Wird ignoriert, wenn `singleOpen` aktiv ist.
     * 
     * @public
     * @returns {void}
     */
    openAll() {
        if (this.#singleOpen) return;
        this.#items.forEach(item => item.setOpen(true));
    }

    /**
     * Schließt alle Elemente des Akkordeons.
     * 
     * @public
     * @returns {void}
     */
    closeAll() {
        this.#items.forEach(item => item.setOpen(false));
    }

    /**
     * Bereitet die Gesamtdaten des Akkordeons für das Rendering-System vor.
     * 
     * @public
     * @returns {ModelAccordionRenderData} Das aufbereitete Datenobjekt mit Layout, Konfiguration und Render-Daten aller Elemente.
     */
    toRenderData() {
        return {
            layout: this._layout,
            singleOpen: this.#singleOpen,
            items: this.#items.map(item => item.toRenderData())
        };
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

/**
 * Controller-Klasse des Aspis-Frameworks zur Steuerung von HTML-Formularen,
 * automatischen Event-Bindings, Validierungen, Rendering und Absendevorgängen (Submit).
 * 
 * @public
 * @extends {BaseController}
 */
class ControllerForm extends BaseController {
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
                console.warn(`[ControllerForm]: Ungültiges JSON in data-rules für ${el.name}`, e);
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
                console.log(`[ControllerForm]: HTML für '${this._sliceKey}' erfolgreich im DOM aktualisiert.`);
            }
        } catch (error) {
            if (!this.signal.aborted) {
                console.error("[ControllerForm]: Render-Fehler", error);
            }
        }
    }
}


/**
 * Basis-Optionen für Modelle im Aspis-Framework.
 * @typedef {Object} BaseModelOptions
 * @property {string} [layout='default'] - Das zugewiesene Template-Layout des Modells.
 */
/**
 * Basisklasse BaseModel im Aspis-Framework.
 * @typedef {Object} BaseModel
 * @property {string} _layout - Das zugewiesene Template-Layout des Modells.
 * @property {<T>(input: T) => T} _sanitize - Sanitizes-Methode zur Bereinigung von Eingaben zur Vermeidung von XSS.
 */
/**
 * Validierungsregeln für ein Formularfeld.
 * @typedef {Record<string, any>} FormFieldRules
 */
/**
 * Konfigurationsobjekt für die Erstellung eines Formularfeldes.
 * @typedef {Object} FormFieldConfig
 * @property {any} [value=''] - Der initiale Wert des Feldes.
 * @property {FormFieldRules} [rules={}] - Die Validierungsregeln für das Feld.
 */
/**
 * Zuordnung von Feldnamen zu ihrer jeweiligen Feldkonfiguration.
 * @typedef {Record<string, FormFieldConfig>} InitialFieldsMap
 */
/**
 * Interner Zustand eines verwalteten Formularfeldes.
 * @typedef {Object} FormField
 * @property {any} value - Der aktuelle Wert des Feldes.
 * @property {any} initialValue - Der ursprüngliche Initialwert des Feldes.
 * @property {string|null} error - Die aktuelle Fehlermeldung oder null, wenn valide.
 * @property {boolean} isTouched - Gibt an, ob das Feld vom Benutzer fokussiert/interagiert wurde.
 * @property {boolean} isDirty - Gibt an, ob sich der Wert vom Initialwert unterscheidet.
 * @property {FormFieldRules} rules - Die für das Feld definierten Validierungsregeln.
 */
/**
 * Zuordnung von Feldnamen zu ihren Fehlermeldungen.
 * @typedef {Record<string, string>} FormErrorsMap
 */
/**
 * Aufbereitetes Payload-Objekt für den Formularversand (Feldname -> Wert).
 * @typedef {Record<string, any>} FormPayload
 */

/**
 * Modell-Klasse des Aspis-Frameworks zur Verwaltung von Formularzuständen,
 * Feldvalidierung und Übermittlungsstatus.
 * 
 * @public
 * @extends {BaseModel}
 */
class ModelForm extends BaseModel {
    /**
     * Interne Map aller verwalteten Formularfelder keyed by Feldname.
     * @internal
     * @type {Map<string, FormField>}
     */
    #fields = new Map();

    /**
     * Status, ob das Formular aktuell abgesendet wird.
     * @internal
     * @type {boolean}
     */
    #isSubmitting = false;

    /**
     * Fehlermeldung des letzten Absendevorgangs oder null.
     * @internal
     * @type {string|null}
     */
    #submitError = null;

    /**
     * Status, ob der letzte Absendevorgang erfolgreich war.
     * @internal
     * @type {boolean}
     */
    #submitSuccess = false;

    /**
     * Erstellt eine neue Instanz des ModelForm.
     * 
     * @public
     * @param {InitialFieldsMap} [initialFields={}] - Initiales Objekt mit Feldkonfigurationen.
     * @param {BaseModelOptions} [options={}] - Optionen zur Initialisierung des Basismodells.
     */
    constructor(initialFields = {}, options = {}) {
        super(options);

        Object.entries(initialFields).forEach(([name, config]) => {
            this.addField(name, config.value, config.rules);
        });
    }

    /**
     * Liefert zurück, ob das Formular sich gerade im Absendevorgang befindet.
     * 
     * @public
     * @type {boolean}
     */
    get isSubmitting() { return this.#isSubmitting; }

    /**
     * Liefert die Fehlermeldung des letzten Absendevorgangs zurück oder null.
     * 
     * @public
     * @type {string|null}
     */
    get submitError() { return this.#submitError; }

    /**
     * Liefert zurück, ob das Formular erfolgreich abgesendet wurde.
     * 
     * @public
     * @type {boolean}
     */
    get submitSuccess() { return this.#submitSuccess; }

    /**
     * Prüft, ob alle Formularfelder valide sind (keine Fehler enthalten).
     * 
     * @public
     * @type {boolean}
     */
    get isValid() {
        for (const [_, field] of this.#fields) {
            if (field.error) return false;
        }
        return true;
    }

    /**
     * Prüft, ob mindestens ein Feld im Formular verändert wurde.
     * 
     * @public
     * @type {boolean}
     */
    get isDirty() {
        for (const [_, field] of this.#fields) {
            if (field.isDirty) return true;
        }
        return false;
    }

    /**
     * Fügt dem Formular ein neues Feld hinzu.
     * 
     * @public
     * @param {string} name - Der eindeutige Name des Feldes.
     * @param {any} [initialValue=''] - Der initiale Wert des Feldes.
     * @param {FormFieldRules} [rules={}] - Validierungsregeln für das Feld.
     * @returns {void}
     */
    addField(name, initialValue = '', rules = {}) {
        if (!name) return;

        const cleanVal = typeof initialValue === 'object' && initialValue !== null 
            ? this._sanitize(initialValue) 
            : String(this._sanitize(initialValue ?? ''));

        this.#fields.set(name, {
            value: cleanVal,
            initialValue: cleanVal,
            error: null,
            isTouched: false,
            isDirty: false,
            rules: rules || {}
        });
    }

    /**
     * Setzt den Wert eines Feldes, aktualisiert den Dirty-Status und führt die Validierung aus.
     * 
     * @public
     * @param {string} name - Der Name des anzupassenden Feldes.
     * @param {any} rawValue - Der neue, unbereinigte Wert.
     * @param {boolean} [markTouched=true] - Markiert das Feld als interagiert (`isTouched`).
     * @returns {void}
     */
    setFieldValue(name, rawValue, markTouched = true) {
        const field = this.#fields.get(name);
        if (!field) return;

        const value = typeof rawValue === 'object' && rawValue !== null 
            ? this._sanitize(rawValue) 
            : String(this._sanitize(rawValue ?? ''));

        field.value = value;
        field.isDirty = field.value !== field.initialValue;
        if (markTouched) field.isTouched = true;

        this.validateField(name);
    }

    /**
     * Liefert das Feldobjekt anhand des Feldnamens zurück.
     * 
     * @public
     * @param {string} name - Der Name des gesuchten Feldes.
     * @returns {FormField|null} Das Feldobjekt oder null, falls es nicht existiert.
     */
    getField(name) {
        return this.#fields.get(name) || null;
    }

    /**
     * Sammelt alle aktuellen Fehler im Formular und gibt diese als Schlüssel-Wert-Paare zurück.
     * 
     * @public
     * @returns {FormErrorsMap} Ein Objekt mit Feldnamen als Keys und den entsprechenden Fehlermeldungen.
     */
    getErrors() {
        const errors = {};
        this.#fields.forEach((field, name) => {
            if (field.error) errors[name] = field.error;
        });
        return errors;
    }

    /**
     * Validiert ein einzelnes Formularfeld über den `ValidationService` (falls verfügbar).
     * 
     * @public
     * @param {string} name - Der Name des zu validierenden Feldes.
     * @returns {boolean} `true`, wenn das Feld gültig ist, sonst `false`.
     */
    validateField(name) {
        const field = this.#fields.get(name);
        if (!field) return true;

        if (typeof ValidationService !== 'undefined') {
            field.error = ValidationService.validateField(field.value, field.rules);
        } else {
            field.error = null;
        }

        return !field.error;
    }

    /**
     * Markiert alle Felder als berührt (`isTouched`) und validiert diese.
     * 
     * @public
     * @returns {boolean} `true`, wenn das gesamte Formular gültig ist, sonst `false`.
     */
    validateAll() {
        let allValid = true;
        this.#fields.forEach((field, name) => {
            field.isTouched = true;
            const valid = this.validateField(name);
            if (!valid) allValid = false;
        });
        return allValid;
    }

    /**
     * Setzt den Absendestatus des Formulars und setzt vorherige Ergebnisse zurück.
     * 
     * @public
     * @param {any} state - Der neue Status (wird zu `boolean` konvertiert).
     * @returns {void}
     */
    setSubmitting(state) {
        this.#isSubmitting = Boolean(state);
        if (state) {
            this.#submitError = null;
            this.#submitSuccess = false;
        }
    }

    /**
     * Setzt das Ergebnis des Absendevorgangs.
     * 
     * @public
     * @param {any} success - Erfolgsstatus des Absendevorgangs (wird zu `boolean` konvertiert).
     * @param {string|null} [errorMessage=null] - Optionale Fehlermeldung bei Misserfolg.
     * @returns {void}
     */
    setSubmitResult(success, errorMessage = null) {
        this.#isSubmitting = false;
        this.#submitSuccess = Boolean(success);
        this.#submitError = errorMessage;
    }

    /**
     * Exportiert die aktuellen Feldwerte als Schlüssel-Wert-Objekt (Payload).
     * 
     * @public
     * @returns {FormPayload} Ein Objekt aller Feldnamen mit ihren aktuellen Werten.
     */
    toPayload() {
        const payload = {};
        this.#fields.forEach((field, name) => {
            payload[name] = field.value;
        });
        return payload;
    }

    /**
     * Setzt alle Felder auf ihre Initialwerte zurück und löscht Fehler- sowie Absendestatus.
     * 
     * @public
     * @returns {void}
     */
    reset() {
        this.#fields.forEach((field) => {
            field.value = field.initialValue;
            field.error = null;
            field.isTouched = false;
            field.isDirty = false;
        });
        this.#submitError = null;
        this.#submitSuccess = false;
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
class ControllerCustomDropdown extends BaseController {
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


/**
 * Basis-Optionen für Modelle im Aspis-Framework.
 * @typedef {Object} BaseModelOptions
 * @property {string} [layout='default'] - Das zugewiesene Template-Layout des Modells.
 */
/**
 * Basisklasse BaseModel im Aspis-Framework.
 * @typedef {Object} BaseModel
 * @property {string} _layout - Das zugewiesene Template-Layout des Modells.
 * @property {<T>(input: T) => T} _sanitize - Sanitizes-Methode zur Bereinigung von Eingaben zur Vermeidung von XSS.
 */
/**
 * Rohdaten zur Erstellung eines Dropdown-Eintrags.
 * @typedef {Object} ModelCustomDropdownItemRawData
 * @property {string} [value] - Der Wert des Eintrags.
 * @property {string} [id] - Alternative Schlüsselbezeichnung für den Wert des Eintrags.
 * @property {string} [label] - Die Bezeichnung/Anzeigetext des Eintrags.
 * @property {string} [title] - Alternative Schlüsselbezeichnung für die Bezeichnung des Eintrags.
 * @property {boolean} [disabled=false] - Gibt an, ob der Eintrag deaktiviert ist.
 */
/**
 * Funktion zur Bereinigung/Sanitizing von Strings.
 * @typedef {(val: any) => string} SanitizeFunction
 */
/**
 * Für das Template-Rendering aufbereitete Datenstruktur eines Dropdown-Eintrags.
 * @typedef {Object} ModelCustomDropdownItemRenderData
 * @property {string} value - Der bereinigte Wert des Eintrags.
 * @property {string} label - Die bereinigte Anzeigebezeichnung des Eintrags.
 * @property {boolean} disabled - Deaktivierungsstatus des Eintrags.
 * @property {boolean} isSelected - Gibt an, ob der Eintrag aktuell ausgewählt ist.
 * @property {boolean} isFocused - Gibt an, ob der Eintrag aktuell den Fokus besitzt.
 */
/**
 * Validierungsregeln für das Dropdown-Feld.
 * @typedef {Record<string, any>} CustomDropdownRules
 */
/**
 * Zustandsobjekt eines Formularfeldes im Dropdown.
 * @typedef {Object} CustomDropdownFieldState
 * @property {string} value - Der aktuelle Wert des Feldes.
 * @property {CustomDropdownRules} rules - Die definierten Validierungsregeln.
 * @property {string|null} error - Fehlermeldung oder null, wenn valide.
 * @property {boolean} isTouched - Gibt an, ob der Benutzer mit dem Feld interagiert hat.
 */
/**
 * Optionsobjekt zur Initialisierung des ModelCustomDropdown.
 * @typedef {Object} ModelCustomDropdownOptionsObject
 * @property {string} [layout='default'] - Das zu verwendende Template-Layout.
 * @property {string} [value=''] - Der initial ausgewählte Wert.
 * @property {CustomDropdownRules} [rules={}] - Validierungsregeln für das Feld.
 */
/**
 * Erlaubte Parameter-Typen für die Optionen des `ModelCustomDropdown` (Optionsobjekt oder direkter Layout-String).
 * @typedef {ModelCustomDropdownOptionsObject | string} ModelCustomDropdownOptions
 */
/**
 * Struktur der Rohdaten für die Optionen des Dropdowns.
 * Array von Elemente-Objekten/Instanzen oder ein Objekt mit `options`- bzw. `data`-Array.
 * @typedef {Array<ModelCustomDropdownItemRawData | InstanceType<typeof ModelCustomDropdown.Item>> | { options?: Array<ModelCustomDropdownItemRawData | InstanceType<typeof ModelCustomDropdown.Item>>, data?: Array<ModelCustomDropdownItemRawData | InstanceType<typeof ModelCustomDropdown.Item>> }} ModelCustomDropdownRawData
 */
/**
 * Für das Template-Rendering aufbereitete Datenstruktur des Dropdown-Modells.
 * @typedef {Object} ModelCustomDropdownRenderData
 * @property {string} layout - Das zu verwendende Template-Layout.
 * @property {boolean} isOpen - Öffnungsstatus des Menüs.
 * @property {string} value - Der aktuell ausgewählte Wert.
 * @property {string} selectedLabel - Bezeichnung des ausgewählten Eintrags oder Standardtext.
 * @property {string|null} error - Aktuelle Fehlermeldung oder null.
 * @property {boolean} isInvalid - Gibt an, ob ein Validierungsfehler vorliegt.
 * @property {ModelCustomDropdownItemRenderData[]} options - Liste aller aufbereiteten Optionen.
 */

/**
 * Modell-Klasse des Aspis-Frameworks zur Repräsentation und Steuerung eines benutzerdefinierten Dropdown-Steuerelements mit Tastaturnavigation und Validierung.
 * 
 * @public
 * @extends {BaseModel}
 */
class ModelCustomDropdown extends BaseModel {
    /**
     * Statische geschachtelte Klasse zur Repräsentation eines einzelnen Dropdown-Eintrags.
     * 
     * @public
     * @static
     */
    static Item = class ModelCustomDropdownItem {
        /**
         * Der bereinigte Wert des Eintrags.
         * @internal
         * @type {string}
         */
        #value;

        /**
         * Die bereinigte Anzeigebezeichnung des Eintrags.
         * @internal
         * @type {string}
         */
        #label;

        /**
         * Deaktivierungsstatus des Eintrags.
         * @internal
         * @type {boolean}
         */
        #disabled;

        /**
         * Erstellt eine neue Instanz eines Dropdown-Eintrags.
         * 
         * @public
         * @param {ModelCustomDropdownItemRawData} [data={}] - Rohdaten des Eintrags.
         * @param {SanitizeFunction} [sanitizeFn=(v) => String(v ?? '')] - Funktion zur Bereinigung von Strings.
         */
        constructor(data = {}, sanitizeFn = (v) => String(v ?? '')) {
            const rawVal = data.value ?? data.id ?? '';
            const rawLabel = data.label ?? data.title ?? String(rawVal);
            
            this.#value = sanitizeFn(rawVal);
            this.#label = sanitizeFn(rawLabel);
            this.#disabled = Boolean(data.disabled);
        }

        /**
         * Liefert den Wert des Eintrags zurück.
         * 
         * @public
         * @type {string}
         */
        get value() { return this.#value; }

        /**
         * Liefert die Anzeigebezeichnung des Eintrags zurück.
         * 
         * @public
         * @type {string}
         */
        get label() { return this.#label; }

        /**
         * Liefert den Deaktivierungsstatus des Eintrags zurück.
         * 
         * @public
         * @type {boolean}
         */
        get disabled() { return this.#disabled; }

        /**
         * Bereitet die Daten des Eintrags für das Rendering-System vor.
         * 
         * @public
         * @param {boolean} [isSelected=false] - Kennzeichnung, ob der Eintrag ausgewählt ist.
         * @param {boolean} [isFocused=false] - Kennzeichnung, ob der Eintrag fokussiert ist.
         * @returns {ModelCustomDropdownItemRenderData} Das aufbereitete Render-Datenobjekt des Eintrags.
         */
        toRenderData(isSelected = false, isFocused = false) {
            return {
                value: this.#value,
                label: this.#label,
                disabled: this.#disabled,
                isSelected,
                isFocused
            };
        }
    };

    /**
     * Die interne Liste aller verwalteten Dropdown-Einträge.
     * @internal
     * @type {InstanceType<typeof ModelCustomDropdown.Item>[]}
     */
    #items = [];

    /**
     * Der Index des aktuell ausgewählten Eintrags (-1 falls keiner).
     * @internal
     * @type {number}
     */
    #selectedIndex = -1;

    /**
     * Der Index des aktuell fokussierten Eintrags (-1 falls keiner).
     * @internal
     * @type {number}
     */
    #focusedIndex = -1;

    /**
     * Status, ob das Dropdown-Menü aktuell geöffnet ist.
     * @internal
     * @type {boolean}
     */
    #isOpen = false;

    /**
     * Der interne Feldzustand (Wert, Validierungsregeln, Fehlerzustand).
     * @internal
     * @type {CustomDropdownFieldState}
     */
    #fieldState;

    /**
     * Erstellt eine neue Instanz des ModelCustomDropdown.
     * 
     * @public
     * @param {ModelCustomDropdownRawData} [rawData=[]] - Optionseinträge (Array oder Objekt mit `options`/`data`).
     * @param {ModelCustomDropdownOptions} [options={}] - Konfigurationsoptionen oder direkt der Layout-Name als String.
     */
    constructor(rawData = [], options = {}) {
        const opts = typeof options === 'string' ? { layout: options } : options;
        super(opts);

        if (typeof FormFieldService !== 'undefined' && typeof FormFieldService.createFieldState === 'function') {
            this.#fieldState = FormFieldService.createFieldState(opts.value || '', opts.rules || {});
        } else {
            this.#fieldState = {
                value: this._sanitize(opts.value || ''),
                rules: opts.rules || {},
                error: null,
                isTouched: false
            };
        }

        this.setOptions(rawData);

        if (opts.value !== undefined) {
            this.selectByValue(opts.value, false);
        }
    }

    /**
     * Liefert zurück, ob das Dropdown-Menü geöffnet ist.
     * 
     * @public
     * @type {boolean}
     */
    get isOpen() { return this.#isOpen; }

    /**
     * Liefert den Index des aktuell fokussierten Eintrags zurück.
     * 
     * @public
     * @type {number}
     */
    get focusedIndex() { return this.#focusedIndex; }

    /**
     * Liefert den Index des aktuell ausgewählten Eintrags zurück.
     * 
     * @public
     * @type {number}
     */
    get selectedIndex() { return this.#selectedIndex; }

    /**
     * Liefert den aktuell ausgewählten Dropdown-Eintrag zurück oder null.
     * 
     * @public
     * @type {InstanceType<typeof ModelCustomDropdown.Item>|null}
     */
    get selectedItem() { return this.#items[this.#selectedIndex] || null; }

    /**
     * Liefert den aktuell gewählten Wert des Feldzustands zurück.
     * 
     * @public
     * @type {string}
     */
    get value() { return this.#fieldState.value; }

    /**
     * Liefert die aktuelle Fehlermeldung des Feldzustands zurück.
     * 
     * @public
     * @type {string|null}
     */
    get error() { return this.#fieldState.error; }

    /**
     * Aktualisiert die Optionseinträge des Dropdowns und synchronisiert Selektion sowie Fokus.
     * 
     * @public
     * @param {ModelCustomDropdownRawData} [rawData=[]] - Die neuen Optionseinträge.
     * @returns {void}
     */
    setOptions(rawData = []) {
        const list = Array.isArray(rawData) ? rawData : (rawData?.options || rawData?.data || []);
        const sanitizeFn = (val) => this._sanitize(val);
        
        this.#items = list.map(item => item instanceof ModelCustomDropdown.Item ? item : new ModelCustomDropdown.Item(item, sanitizeFn));
        this.#selectedIndex = this.#items.findIndex(item => item.value === this.#fieldState.value);
        this.#focusedIndex = this.#selectedIndex >= 0 ? this.#selectedIndex : 0;
    }

    /**
     * Setzt den Öffnungsstatus des Dropdowns. Setzt den Fokus bei Öffnen auf die aktuelle Selektion.
     * 
     * @public
     * @param {any} open - Der neue Öffnungsstatus (wird zu `boolean` konvertiert).
     * @returns {void}
     */
    setOpen(open) {
        this.#isOpen = Boolean(open);
        if (this.#isOpen) {
            this.#focusedIndex = this.#selectedIndex >= 0 ? this.#selectedIndex : 0;
        }
    }

    /**
     * Wählt einen Eintrag anhand seines Wertes aus und aktualisiert Zustand und Fokus.
     * 
     * @public
     * @param {any} val - Der auszuwählende Wert.
     * @param {boolean} [triggerValidation=true] - Gibt an, ob im Anschluss die Validierung ausgeführt werden soll.
     * @returns {boolean} `true`, wenn ein passender (nicht deaktivierter) Eintrag gefunden und gesetzt wurde oder ein leerer String zurückgesetzt wurde, sonst `false`.
     */
    selectByValue(val, triggerValidation = true) {
        const sanitizedVal = this._sanitize(val);
        const index = this.#items.findIndex(item => item.value === sanitizedVal && !item.disabled);
        
        if (index === -1 && sanitizedVal !== '') return false;

        this.#selectedIndex = index;
        this.#focusedIndex = index >= 0 ? index : 0;
        this.#fieldState.value = index >= 0 ? this.#items[index].value : '';
        this.#fieldState.isTouched = true;

        if (triggerValidation) {
            this.validate();
        }
        return true;
    }

    /**
     * Verschiebt den Fokus innerhalb der Liste in eine Richtung unter Übergehung deaktivierter Einträge.
     * 
     * @public
     * @param {number} direction - Schrittweite und Richtung (z. B. `1` für abwärts, `-1` für aufwärts).
     * @returns {void}
     */
    moveFocus(direction) {
        if (this.#items.length === 0) return;
        let next = this.#focusedIndex + direction;

        while (next >= 0 && next < this.#items.length && this.#items[next].disabled) {
            next += direction;
        }

        if (next >= 0 && next < this.#items.length) {
            this.#focusedIndex = next;
        }
    }

    /**
     * Wählt den aktuell fokussierten Eintrag aus, falls dieser nicht deaktiviert ist.
     * 
     * @public
     * @returns {boolean} `true`, wenn der fokussierte Eintrag erfolgreich ausgewählt wurde, sonst `false`.
     */
    selectFocused() {
        if (this.#focusedIndex >= 0 && this.#focusedIndex < this.#items.length) {
            const item = this.#items[this.#focusedIndex];
            if (!item.disabled) {
                return this.selectByValue(item.value);
            }
        }
        return false;
    }

    /**
     * Führt die Validierung des aktuellen Feldwerts über den `ValidationService` aus (falls verfügbar).
     * 
     * @public
     * @returns {boolean} `true`, wenn der Feldwert gültig ist, sonst `false`.
     */
    validate() {
        if (typeof ValidationService !== 'undefined') {
            this.#fieldState.error = ValidationService.validateField(
                this.#fieldState.value, 
                this.#fieldState.rules
            );
        } else {
            this.#fieldState.error = null;
        }
        return !this.#fieldState.error;
    }

    /**
     * Bereitet die Gesamtdaten des Dropdowns für das Rendering-System vor.
     * 
     * @public
     * @returns {ModelCustomDropdownRenderData} Das aufbereitete Datenobjekt mit Layout, Zuständen und allen Optionen.
     */
    toRenderData() {
        return {
            layout: this._layout,
            isOpen: this.#isOpen,
            value: this.#fieldState.value,
            selectedLabel: this.selectedItem ? this.selectedItem.label : 'Bitte wählen...',
            error: this.#fieldState.error,
            isInvalid: Boolean(this.#fieldState.error),
            options: this.#items.map((item, idx) => 
                item.toRenderData(idx === this.#selectedIndex, idx === this.#focusedIndex)
            )
        };
    }
}