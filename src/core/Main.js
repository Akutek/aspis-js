import { Store } from "../reactivity/";
import { ComponentCleaner, LoggerService, TemplateService, RenderService, DatenFetcher, EventDispatcher } from "../services/";
import { ScannerDOM, ModifierDOM } from "../utils/";
import { ControllerRegistry, Registry } from "./";

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
export class Main {
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

            LoggerService.info("[Main.boot()] Anwendung erfolgreich gebootet.");
            return services;
        } catch (error) {
            LoggerService.error("[Main.boot()] Kritischer Fehler beim Bootstrapping der Anwendung:", error);
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
        LoggerService.init(manifest.settings?.debug ?? config.debug);

        registry.set('logger', LoggerService);
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
            LoggerService.warn(`[Main.startController()] Dynamischer Lookup fehlgeschlagen. Controller '${controllerClassName}' ist nicht in der Registry registriert.`);
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
                    LoggerService.info(`[Main.startController()] Reaktive PHP-Abhängigkeit registriert: <${item.type}> lauscht auf Pfad '${path}'`);
                });
            }

            await controllerInstance.start();

        } catch (error) {
            LoggerService.error(`[Main.startController()] Fehler im Lebenszyklus beim Starten des Controllers '${item.type}':`, error);
        }
    }
}