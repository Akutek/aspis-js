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
export class Registry {
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