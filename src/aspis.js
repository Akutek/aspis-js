class ControllerRegistry {
    #resolvedControllers = new Map();
    #basePath;

    constructor(basePath = './controllers') {
        this.#basePath = basePath;
    }

    async getAsync(type) {
        if (!type || typeof type !== 'string') return null;
        if (this.#resolvedControllers.has(type)) {
            return this.#resolvedControllers.get(type);
        }

        const className = `Controller${type.charAt(0).toUpperCase() + type.slice(1)}`;
        const fileUrl = `${this.#basePath}/${className}.js`;

        try {
            const module = await import(fileUrl);
            const ControllerClass = module[className] || module.default;

            if (!ControllerClass) {
                throw new Error(`Klasse '${className}' wurde in der Datei nicht gefunden.`);
            }

            this.#resolvedControllers.set(type, ControllerClass);
            return ControllerClass;

        } catch (error) {
            console.error(`ControllerRegistry: Fehler beim Laden von '${fileUrl}':`, error);
            return null;
        }
    }
}

class ComponentCleaner {
    #registry;

    constructor(registry) {
        this.#registry = registry;
    }

    clean(element) {
        const controller = this.#registry.get(element);
        if (!controller) return;

        if (controller.classService && typeof controller.classService.cleanup === 'function') {
            controller.classService.cleanup();
        }

        if (typeof controller.destroy === 'function') {
            controller.destroy();
        }
        this.#registry.delete(element);
    }
}

class Main {
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
                })
            ]);

            const services = this.createServices(controllerRegistry, config, stateManifest);
            TemplateService.init();

            const scanResults = ScannerDOM.scan(document.body);
            await this.assignControllers(scanResults, services);
        } catch (error) {
            console.error("Aspis [Main]: Kritischer Fehler beim Bootstrapping der Anwendung:", error);
        }
    }

    static createServices(controllerRegistry, config, manifest, eventManifest) {
        const registry = new Registry();

        registry.set('controllerRegistry', controllerRegistry);
        registry.set('config', config);
        registry.set('store', new Store(manifest));
        registry.set('eventManifest', eventManifest);
        registry.set('fetcher', new DatenFetcher());
        registry.set('dispatcher', new EventDispatcher());
        registry.set('modifierDOM', ModifierDOM);
        registry.set('cleaner', new ComponentCleaner(registry));
        registry.set('templates', TemplateService);

        return registry;
    }

    static async assignControllers(scanResults, registry) {
        const promises = scanResults.map(detectedNode => {
            return this.startController(detectedNode, registry);
        });

        await Promise.all(promises);
    }

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
            const eventsBase = config.publicPaths?.events || '/src/events';
            const eventPath = componentConfig.events ? `${eventsBase}/${componentConfig.events}` : null;
            const sliceKey = componentConfig.sliceKey || null;
            const controllerInstance = new ControllerClass(item.element, store, dispatcher, { 
                eventPath, 
                sliceKey 
            });
            
            controllerInstance.layout = item.layout;

            registry.set(item.element, controllerInstance);

            const dependsOnAttr = item.element.dataset.dependsOn || item.element.getAttribute('data-depends-on');
            if (dependsOnAttr && typeof store.addDependency === 'function') {
                const paths = dependsOnAttr.split(',').map(path => path.trim());
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
window.addEventListener("DOMContentLoaded", () => {
    const loader = new ControllerRegistry('./controllers');
    Main.boot(loader).catch(err => console.error("App-Crash beim Booten:", err));
});

class ReactiveEffect {
    #store;
    #fn;
    #trackedPaths = new Set();

    constructor(store, fn) {
        this.#store = store;
        this.#fn = fn;
    }

    run() {
        try {
            this.#store._activeEffect = this;
            return this.#fn();
        } finally {
            this.#store._activeEffect = null;
        }
    }

    trackPath(path) {
        this.#trackedPaths.add(path);
    }

    stop() {
        this.#store._cleanupEffect(this, this.#trackedPaths);
        this.#trackedPaths.clear();
    }
}

class Store {
    #listeners = new Map();
    #dependencies = new Map();
    #domDependencies = new Map();
    #data = {};
    #stateProxy;
    #proxyCache = new WeakMap();
    #configs = {};

    #effectQueue = new Set();
    #isFlushPending = false;

    _activeEffect = null;


    constructor(manifest = {}, initialData = {}) {
        this.#data = initialData;
        
        const extractedState = {
            app: {},
            features: {},
            shared: {}
        };

        if (manifest && manifest.slices) {
            Object.entries(manifest.slices).forEach(([slicePath, sliceContent]) => {
                const parts = slicePath.split('.');
                
                if (parts.length === 2 && extractedState[parts[0]]) {
                    const [namespace, sliceKey] = parts;
                    extractedState[namespace][sliceKey] = sliceContent.initialState || {};
                    this.#configs[slicePath] = sliceContent.config || {};
                } else {
                    console.warn(`Aspis [Store-Bootstrap]: Ignoriere ungültigen Manifest-Pfad '${slicePath}'. Muss das Format 'namespace.key' besitzen.`);
                }
            });
        }
        this.#stateProxy = this.#createDeepProxy(extractedState, "");
        console.log("Aspis [Store-Bootstrap]: Hierarchischer State-Baum erfolgreich initialisiert.", extractedState);
    }

    get state() {
        return this.#stateProxy;
    }

    get data() {
        return Object.freeze({ ...this.#data });
    }

    getSlice(featureName) {
        if (!this.#stateProxy[featureName]) {
            throw new Error(`Aspis [Store-Schutzschild]: Zugriff verweigert! Das Feature "${featureName}" ist nicht im state-manifest.json deklariert.`);
        }
        return {
            ...this.#stateProxy[featureName],
            config: this.#configs[featureName] || {}
        };
    }

    updateData(newData) {
        this.#data = newData;
        this.#trigger('data', this.#data);
    }

    effect(fn) {
        if (typeof fn !== 'function') return () => {};

        const rxEffect = new ReactiveEffect(this, fn);
        rxEffect.run();

        return () => {
            rxEffect.stop();
        };
    }

    addDependency(targetOrPath, childPathOrDataPath) {
        if (targetOrPath instanceof HTMLElement) {
            if (!this.#domDependencies.has(childPathOrDataPath)) {
                this.#domDependencies.set(childPathOrDataPath, new Set());
            }
            this.#domDependencies.get(childPathOrDataPath).add(targetOrPath);
            return;
        }
        if (typeof targetOrPath === 'string' && typeof childPathOrDataPath === 'string') {
            if (!this.#dependencies.has(targetOrPath)) {
                this.#dependencies.set(targetOrPath, new Set());
            }
            this.#dependencies.get(targetOrPath).add(childPathOrDataPath);
            console.log(`Aspis [Store]: Logische Kaskade registriert [${targetOrPath} ──> ${childPathOrDataPath}]`);
            return;
        }

        throw new Error("Aspis [Store]: Ungültige Signatur in addDependency(). Erlaubt: (HTMLElement, String) oder (String, String).");
    }

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
                    throw new Error(
                        `Aspis [Store-Schutzschild]: Mutation abgelehnt! Der State-Parameter "${nextPath}" ` +
                        `wurde nicht im state-manifest.json deklariert.`
                    );
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

    #track(path) {
        if (this._activeEffect) {
            if (!this.#listeners.has(path)) {
                this.#listeners.set(path, new Set());
            }
            this.#listeners.get(path).add(this._activeEffect);
            this._activeEffect.trackPath(path);
        }
    }

    #trigger(path, value) {
        const pathListeners = this.#listeners.get(path);
        if (pathListeners) {
            pathListeners.forEach(effect => this.#effectQueue.add(effect));
        }
        this.#domDependencies.forEach((elements, registeredDataPath) => {
            if (path === registeredDataPath || path.startsWith(registeredDataPath + '.')) {
                elements.forEach(element => {
                    console.info(`Aspis [Store]: PHP-Abhängigkeit angeschlagen für Pfad '${registeredDataPath}'. UI-Update erzwungen.`);
                    this.#triggerElementUpdate(element);
                });
            }
        });

        if (pathListeners || this.#domDependencies.size > 0) {
            this.#queueFlush();
        }
    }

    #triggerElementUpdate(element) {
        const customEvent = new CustomEvent('aspis:data-mutation', { 
            bubbles: true, 
            detail: { path: element.dataset.dependsOn } 
        });
        element.dispatchEvent(customEvent);
    }

    #queueFlush() {
        if (this.#isFlushPending) return;
        this.#isFlushPending = true;

        queueMicrotask(() => {
            this.#flushQueue();
        });
    }

    #flushQueue() {
        try {
            this.#effectQueue.forEach(effect => effect.run());
        } finally {
            this.#effectQueue.clear();
            this.#isFlushPending = false;
        }
    }

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

class Registry {
    #services;
    #elements;
    #finalizer;

    constructor() {
        this.#services = new Map();
        this.#elements = new WeakMap();

        this.#finalizer = new FinalizationRegistry(({ controllerRef }) => {
            const controller = controllerRef?.deref();
            if (controller && typeof controller.destroy === 'function') {
                controller.destroy();
                console.info("Aspis [Registry]: Controller wurde nach GC-Erfassung sauber zerstört.");
            }
        });
    }

    set(key, value) {
        if (typeof key === 'string') {
            if (this.#services.has(key)) {
                throw new Error(`Aspis [Registry]: Kritischer Fehler! Der Service-Key '${key}' ist bereits registriert und darf nicht überschrieben werden.`);
            }
            this.#services.set(key, value);
        } else if (key instanceof HTMLElement) {
            const controllerRef = new WeakRef(value);
            this.#elements.set(key, controllerRef);
            this.#finalizer.register(key, { controllerRef }, key);
        } else {
            throw new Error("Aspis [Registry]: Ungültiger Key-Typ in set(). Erlaubt sind Strings oder HTMLElements.");
        }
    }

    get(key) {
        if (typeof key === 'string') {
            if (!this.#services.has(key)) {
                throw new Error(`Aspis [Registry]: Der angeforderte Service '${key}' existiert nicht im Container. Überprüfe die Initialisierung in Main.js.`);
            }
            return this.#services.get(key);
        } else if (key instanceof HTMLElement) {
            const ref = this.#elements.get(key);
            return ref ? ref.deref() || null : null;
        }
        return null;
    }

    delete(key) {
        if (typeof key === 'string') {
            return this.#services.delete(key);
        } else if (key instanceof HTMLElement) {
            const ref = this.#elements.get(key);
            const controller = ref?.deref();
            if (controller && typeof controller.destroy === 'function') {
                controller.destroy();
            }

            this.#finalizer.unregister(key);
            return this.#elements.delete(key);
        }
        return false;
    }
}

class DatenFetcher {
    async request(url, { params = {}, signal = null, headers = {}, method = 'GET', body = null } = {}) {
        if (!url || typeof url !== 'string') {
            throw new Error("DatenFetcher: Keine gültige URL übergeben.");
        }

        const endpointUrl = new URL(url, window.location.origin);
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                endpointUrl.searchParams.append(key, value);
            }
        });

        const fetchOptions = {
            method,
            headers: { ...headers },
            signal
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
            if (error.name === 'AbortError') {
                const reason = signal?.reason || 'Abgebrochen';
                console.info(`Aspis [DatenFetcher]: Request auf '${url}' storniert -> Grund: ${reason}`);
                return null; 
            }

            console.error(`Aspis [DatenFetcher]: Fehler bei ${method} ${url}:`, error);
            throw error;
        }
    }

    async get(url, params = {}, options = {}) {
        return this.request(url, { ...options, method: 'GET', params });
    }

    async post(url, body = {}, options = {}) {
        return this.request(url, { ...options, method: 'POST', body });
    }

    async put(url, body = {}, options = {}) {
        return this.request(url, { ...options, method: 'PUT', body });
    }

    async delete(url, options = {}) {
        return this.request(url, { ...options, method: 'DELETE' });
    }
}

class ScannerDOM {
    static scan(rootElement = document.body) {
        if (!rootElement || typeof rootElement.querySelectorAll !== 'function') {
            console.warn("ScannerDOM: Ungültiges oder fehlendes Root-Element übergeben. Scan abgebrochen.");
            return [];
        }

        const elements = rootElement.querySelectorAll('[data-controller]');

        return Array.from(elements, container => ({
            element: container,
            type: container.dataset.controller,
            layout: container.dataset.layout || "default"
        }));
    }
}

class Reactivity {
    static #activeEffect = null;

    static createEffect(callback) {
        const effect = () => {
            try {
                this.#activeEffect = effect;
                callback();
            } finally {
                this.#activeEffect = null;
            }
        };

        effect();
        return effect;
    }

    static get currentEffect() {
        return this.#activeEffect;
    }
}

class BaseController {
_store;
    _dispatcher;
    _container;
    _options;
    _sliceKey = null;
    
    #unsubscribeStore = null;
    #unsubscribeEvents = [];

    #lifecycleController = new AbortController();
    #taskControllers = new Map();

    constructor(container, store, dispatcher, options = {}) {
        this._container = container;
        this._store = store;
        this._dispatcher = dispatcher;
        this._options = options;

        // Falls sliceKey über app-config.json mitgegeben wurde, diesen nutzen:
        if (options.sliceKey) {
            this._sliceKey = options.sliceKey;
        }
    }

    get signal() {
        return this.#lifecycleController.signal;
    }

    getSignal(taskKey = null) {
        if (!taskKey) {
            return this.#lifecycleController.signal;
        }

        if (this.#taskControllers.has(taskKey)) {
            this.#taskControllers.get(taskKey).abort(`Task '${taskKey}' überschrieben.`);
        }

        const taskController = new AbortController();
        this.#taskControllers.set(taskKey, taskController);

        return AbortSignal.any([this.#lifecycleController.signal, taskController.signal]);
    }

    clearTask(taskKey) {
        if (this.#taskControllers.has(taskKey)) {
            this.#taskControllers.delete(taskKey);
        }
    }

    async start() {
        await this.#initEvents();

        if (this._sliceKey && this._store) {
            this.#unsubscribeStore = this._store.effect(() => {
                const slice = this._store.getSlice(this._sliceKey);
                if (slice) {
                    this._onStateChange(slice);
                }
            });
        }

        if (typeof this.onInit === 'function') {
            await this.onInit();
        }
    }

    async #initEvents() {
        if (!this._dispatcher) return;

        let eventMap = {};

        if (this._options?.eventPath) {
            try {
                const res = await fetch(this._options.eventPath, { signal: this.signal });
                if (res.ok) {
                    eventMap = await res.json();
                } else {
                    console.warn(`Aspis [BaseController]: Event-Config unter '${this._options.eventPath}' konnte nicht geladen werden.`);
                }
            } catch (e) {
                if (e.name !== 'AbortError') {
                    console.error(`Aspis [BaseController]: Fehler beim Laden von '${this._options.eventPath}':`, e);
                }
            }
        }

        const rawEvents = this._container.dataset.events;
        if (rawEvents) {
            try {
                const inlineMap = JSON.parse(rawEvents);
                eventMap = { ...eventMap, ...inlineMap };
            } catch (e) {
                console.error(`Aspis [BaseController]: Fehler beim Parsen von data-events an <${this.constructor.name}>:`, e);
            }
        }

        // 3. Im Dispatcher registrieren
        Object.entries(eventMap).forEach(([eventName, methodName]) => {
            if (typeof this[methodName] === 'function') {
                const unsub = this._dispatcher.on(eventName, (payload) => this[methodName](payload));
                this.#unsubscribeEvents.push(unsub);
            } else {
                console.warn(`Aspis [BaseController]: Event '${eventName}' verweist auf nicht existierende Methode '${methodName}' in ${this.constructor.name}.`);
            }
        });
    }

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
        this.#unsubscribeEvents.forEach(unsub => unsub());
        this.#unsubscribeEvents = [];

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

        console.log(`Aspis [Lifecycle]: ${this.constructor.name} erfolgreich aus dem Speicher entfernt und gereinigt.`);
    }

    _onStateChange(slice) {
        if (!slice || !slice.config || !slice.config.targets) {
            if (typeof this.onStateChange === 'function') {
                this.onStateChange(slice);
            }
            return;
        }
        const targets = slice.config.targets;
        for (const [targetName, targetConfig] of Object.entries(targets)) {
            const element = targetConfig.selector === ':scope' 
                ? this._container 
                : this._container.querySelector(targetConfig.selector);
                
            if (!element || !targetConfig.bindClasses) continue;
            for (const [stateProp, styleKey] of Object.entries(targetConfig.bindClasses)) {
                const isActive = !!slice[stateProp]; 
                if (typeof ModifierDOM.toggleSliceClass === 'function') {
                    ModifierDOM.toggleSliceClass(element, slice, styleKey, isActive);
                }
            }
        }
        if (typeof this.onStateChange === 'function') {
            this.onStateChange(slice);
        }
    }
}

class ControllerTable extends BaseController {
    #api;
    #layout;
    
    table = null;

    constructor(container, store, dispatcher) {
        super(container, store, dispatcher);
        this._sliceKey = 'tableFeature'; 
    }

    async onInit() {
        this.#layout = this.layout;
        this.#api = window.appRegistry ? window.appRegistry.get('fetcher') : new DatenFetcher();

        const url = this._container.dataset.url;
        if (!url) {
            this._container.innerHTML = `<p style="color:red;">Fehler: data-url fehlt am Container.</p>`;
            return;
        }
        await this.loadData(url);
    }

    onStateChange(slice) {
        if (!slice.isLoading && slice.model && this.table !== slice.model) {
            this.table = slice.model;
            this.#render();
        }
    }

    async loadData(url) {
        const stateProxy = this._store.state[this._sliceKey];
        if (!stateProxy) return;
        try {
            stateProxy.isLoading = true;
            this._container.innerHTML = "<p>Lade Daten...</p>";
            const liveData = await this.#api.get(url);
            if (liveData) {
                stateProxy.model = Factory.create(Table, [TableRow], this.#layout, liveData);
            }
        } catch (error) {
            this._container.innerHTML = `<div style="color:red;">Fehler beim Laden: ${error.message}</div>`;
            console.error("[ControllerTable]: Fehler im loadData-Ablauf", error);
        } finally {
            stateProxy.isLoading = false; 
        }
    }

    reload(filterPayload) {
        const baseUrl = this._container.dataset.url;
        if (!baseUrl) return;
        
        const filterParam = filterPayload && filterPayload.classId ? `?class=${filterPayload.classId}` : '';
        this.loadData(`${baseUrl}${filterParam}`);
    }

    async #render() {
        if (!this.table) return;
        try {
            await RenderService.paste(this._container, "meine-tabelle", this.table.toRenderData());
            console.log(`[ControllerTable]: HTML für '${this._sliceKey}' erfolgreich ins DOM injiziert.`);
        } catch (error) {
            console.error("[ControllerTable]: Render-Fehler", error);
        }
    }
}

class Table {
    constructor(layout) {
        this.layout = layout;
        this.rows = [];
    }

    appendRow(tableRowObject) {
        if (tableRowObject instanceof TableRow) {
            this.rows.push(tableRowObject);
        } else {
            console.error("Table: Es können nur Instanzen von TableRow übergeben werden.");
        }
    }

    toRenderData() {
        return {
            rows: this.rows
        };
    }
}

class Factory {
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

class RenderService {
    static paste(container, templateName, modelData = {}, append = false) {
        try {
            const element = TemplateService.compile(templateName, modelData);
        
            if (!element) {
                throw new Error(`Kompilierung von Template '${templateName}' fehlgeschlagen.`);
            }
            const safeElement = this.#purifyElement(element);
            if (!append) {
                container.replaceChildren();
            }
            container.appendChild(safeElement);
            return safeElement;

        } catch (error) {
            console.error(`Aspis [RenderService]: Fehler beim Rendern von '${templateName}':`, error);
            
            const errorBox = document.createElement('p');
            errorBox.style.color = 'red';
            errorBox.textContent = `Render-Fehler: ${error.message}`;
            
            if (!append) container.replaceChildren();
            container.appendChild(errorBox);
            return null;
        }
    }

    static combine(template, modelData = {}) {
        const element = TemplateService.compile(template.name, modelData);
        if (!element) return '';
        
        const safeElement = this.#purifyElement(element);
        return safeElement.outerHTML;
    }

    static loop(dataArray, templateName, transformFn = null) {
        if (!Array.isArray(dataArray)) {
            console.warn(`Aspis [RenderService.loop]: Erwartete ein Array, erhielt:`, dataArray);
            return [];
        }

        return dataArray.map((item, index) => {
            const payload = typeof transformFn === 'function' 
                ? transformFn(item, index) 
                : { data: item };

            const element = TemplateService.compile(templateName, payload);
            if (!element) {
                console.error(`Aspis [RenderService.loop]: Eintrag an Index ${index} konnte nicht kompiliert werden.`);
                return null;
            }

            return this.#purifyElement(element);
        }).filter(el => el !== null);
    }

    static #purifyElement(element) {
        const allElements = [element, ...element.querySelectorAll('*')];
        
        allElements.forEach(el => {
            Array.from(el.attributes).forEach(attr => {
                if (attr.name.startsWith('on')) {
                    el.removeAttribute(attr.name);
                    console.warn(`[GuardDOM/RenderService]: Gefährliches Attribut '${attr.name}' blockiert!`);
                }
            });

            if (el.tagName === 'A' && el.hasAttribute('href')) {
                const href = el.getAttribute('href').trim().toLowerCase();
                if (href.startsWith('javascript:') || href.startsWith('data:')) {
                    el.setAttribute('href', '#');
                    console.warn(`[GuardDOM/RenderService]: 'javascript:'-Protokoll in Link blockiert.`);
                }
            }

            if (el.tagName === 'SCRIPT') {
                el.remove();
                console.warn(`[GuardDOM/RenderService]: <script>-Tag im Template vernichtet.`);
            }
        });

        return element;
    }
}

class TemplateService {
    static #cache = new Map(); 
    static #basePath = "./js/aspis/templates/";

    static init() {
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

        console.info(`Aspis [TemplateService]: Initialisiert. ${this.#cache.size} Template aus dem DOM geladen.`);
    }

    static async get(name) {
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

    static compile(name, payload = {}) {
        const template = this.#cache.get(name);
        if (!template) {
            console.error(`Aspis [TemplateService]: Template '${name}' nicht im Cache gefunden. Kompilierung abgebrochen.`);
            return null;
        }

        const payloadData = payload.data || {};
        const payloadAttributes = payload.attributes || {};
        const payloadSlots = payload.slots || {};

        let workingHtml = template.html;

        Object.keys(template.data).forEach(key => {
            const placeholder = template.data[key];
            const rawValue = payloadData[key] !== undefined ? payloadData[key] : "";
            const cleanValue = GuardDOM.clean(rawValue);
            workingHtml = workingHtml.replaceAll(placeholder, cleanValue);
        });

        Object.keys(template.attributes).forEach(key => {
            const placeholder = template.attributes[key];
            const rawValue = payloadAttributes[key];

            if (rawValue && String(rawValue).trim() !== "") {
                const formattedAttr = ` ${String(rawValue).trim()}`;
                workingHtml = workingHtml.replaceAll(placeholder, formattedAttr);
            } else {
                workingHtml = workingHtml.replaceAll(placeholder, "");
            }
        });

        const fragment = document.createRange().createContextualFragment(workingHtml);
        const element = fragment.firstElementChild;

        if (!element) {
            console.error(`Aspis [TemplateService]: Transformation von '${name}' in den DOM fehlgeschlagen.`);
            return null;
        }

        Object.keys(template.slots).forEach(key => {
            const placeholder = template.slots[key];
            const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
            let currentNode;
            let targetNode = null;

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
                slotContent.forEach(childNode => {
                    if (childNode instanceof Node) {
                        parent.insertBefore(childNode, targetNode);
                    }
                });
            } else if (slotContent instanceof Node) {
                parent.insertBefore(slotContent, targetNode);
            } else if (typeof slotContent === "string") {
                const childFragment = document.createRange().createContextualFragment(slotContent);
                parent.insertBefore(childFragment, targetNode);
            }

            targetNode.remove();
        });

        return element;
    }

    static getTemplateEvents(name) {
        const template = this.#cache.get(name);
        return template ? template.events : {};
    }

    static async #loadFromServer(name) {
        const url = `${this.#basePath}${name}/${name}.json`;
        
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Manifest für '${name}' nicht gefunden (404)`);
            const manifest = await response.json();

            let htmlString = "";
            if (manifest.files) {
                const fetchTasks = Object.entries(manifest.files).map(async ([key, fileName]) => {
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

    static #normalizeTemplate(id, config, htmlString) {
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
            placeholder: placeholders,
            config
        };
    }
}

class EventDispatcher {
    #listeners = new Map();

    constructor() {
        this.#initGlobalClickTracker();
    }

    on(eventName, callback) {
        if (typeof callback !== 'function') return () => {};

        if (!this.#listeners.has(eventName)) {
            this.#listeners.set(eventName, new Set());
        }

        this.#listeners.get(eventName).add(callback);
        return () => this.off(eventName, callback);
    }

    off(eventName, callback) {
        const eventListeners = this.#listeners.get(eventName);
        if (eventListeners) {
            eventListeners.delete(callback);
            if (eventListeners.size === 0) {
                this.#listeners.delete(eventName);
            }
        }
    }

    emit(eventName, data = null) {
        const eventListeners = this.#listeners.get(eventName);
        if (!eventListeners) return;

        eventListeners.forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`[EventDispatcher Error] '${eventName}':`, error);
            }
        });
    }

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

    #initGlobalClickTracker() {
        document.addEventListener('click', (event) => {
            this.emit('document:click', event.target);
        });
        console.log("EventDispatcher: Zentraler Click-Outside-Wächter aktiv.");
    }
}

class ModifierDOM {
    static #isValid(target) {
        return target instanceof HTMLElement;
    }

    static #normalize(target) {
        if (!target) return [];
        if (target instanceof NodeList) return Array.from(target);
        return Array.isArray(target) ? target : [target];
    }

    static show(target) {
        this.#normalize(target).forEach(el => {
            if (!this.#isValid(el)) return;
            el.removeAttribute('hidden');
            el.classList.remove('is-hidden');
        });
    }

    static hide(target) {
        this.#normalize(target).forEach(el => {
            if (!this.#isValid(el)) return;
            el.setAttribute('hidden', '');
            el.classList.add('is-hidden');
        });
    }

    static addClass(target, classNames) {
        if (!classNames || typeof classNames !== 'string') return;
        const classes = classNames.split(/\s+/).filter(Boolean);
        
        this.#normalize(target).forEach(el => {
            if (!this.#isValid(el)) return;
            el.classList.add(...classes);
        });
    }

    static removeClass(target, classNames) {
        if (!classNames || typeof classNames !== 'string') return;
        const classes = classNames.split(/\s+/).filter(Boolean);
        
        this.#normalize(target).forEach(el => {
            if (!this.#isValid(el)) return;
            el.classList.remove(...classes);
        });
    }

    static toggleClass(target, className, force) {
        if (!className || typeof className !== 'string') return;
        
        this.#normalize(target).forEach(el => {
            if (!this.#isValid(el)) return;
            
            if (force !== undefined) {
                el.classList.toggle(className, !!force);
            } else {
                el.classList.toggle(className);
            }
        });
    }

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

class TargetResolver {
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
class ManifestBinder {
    #container;
    #store;
    #sliceKey;
    #resolvedTargets;
    #unsubscribeEffects = [];

    constructor(container, store, sliceKey) {
        this.#container = container;
        this.#store = store;
        this.#sliceKey = sliceKey;
        this.#resolvedTargets = new Map();
    }

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

    unbind() {
        this.#unsubscribeEffects.forEach(unsub => unsub());
        this.#unsubscribeEffects = [];
        this.#resolvedTargets.clear();
        console.log(`[ManifestBinder]: Auto-Bindings für '${this.#sliceKey}' sauber gelöst.`);
    }
}

class BaseObserver {
    #registry;
    #isObserving = false;
    #targets = new Set();

    constructor(registry) {
        if (new.target === BaseObserver) {
            throw new TypeError("Aspis [BaseObserver]: Instanziierung der abstrakten Basisklasse ist nicht erlaubt.");
        }
        this.#registry = registry;
    }

    get registry() {
        return this.#registry;
    }

    get isObserving() {
        return this.#isObserving;
    }

    get targets() {
        return Array.from(this.#targets);
    }

    start(target) {
        this.#isObserving = true;
        if (target) {
            this.#targets.add(target);
        }
    }

    stop() {
        this.#isObserving = false;
        this.#targets.clear();
    }

    observe(target) {
        if (!(target instanceof Node)) return;
        this.#targets.add(target);
    }

    unobserve(target) {
        this.#targets.delete(target);
    }

    destroy() {
        this.stop();
        this.#registry = null;
    }
}
class MutationObserverDOM extends BaseObserver {
    #nativeObserver = null;

    start(target = document.body, config = { childList: true, subtree: true }) {
        if (this.isObserving) return;

        this.#nativeObserver = new MutationObserver((mutations) => this.#handleMutations(mutations));
        this.#nativeObserver.observe(target, config);

        super.start(target);
        console.info("Aspis [MutationObserverDOM]: Wächter aktiv.");
    }

    observe(target, config = { childList: true, subtree: true }) {
        if (!(target instanceof Node)) return;
        super.observe(target);
        if (this.#nativeObserver) {
            this.#nativeObserver.observe(target, config);
        }
    }

    stop() {
        if (this.#nativeObserver) {
            this.#nativeObserver.disconnect();
            this.#nativeObserver = null;
        }
        super.stop();
        console.info("Aspis [MutationObserverDOM]: Wächter gestoppt.");
    }

    async #handleMutations(mutations) {
        const addedNodes = [];
        const cleaner = this.registry?.get('cleaner');

        for (const mutation of mutations) {
            mutation.removedNodes.forEach(node => {
                if (node instanceof HTMLElement) {
                    cleaner?.clean(node);
                    const subComponents = node.querySelectorAll('[data-controller]');
                    subComponents.forEach(subEl => cleaner?.clean(subEl));
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

    destroy() {
        this.stop();
        super.destroy();
    }
}
class GuardDOM {
    static clean(unsafeText) {
        if (typeof unsafeText !== 'string') return unsafeText;
        
        return unsafeText
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    static purify(rawHTML) {
        if (typeof rawHTML !== 'string') return rawHTML;

        const parser = new DOMParser();
        const doc = parser.parseFromString(rawHTML, 'text/html');
        const allElements = doc.body.querySelectorAll('*');
        
        allElements.forEach(element => {
            Array.from(element.attributes).forEach(attr => {
                if (attr.name.startsWith('on')) {
                    element.removeAttribute(attr.name);
                    console.warn(`[GuardDOM]: Gefährliches Attribut '${attr.name}' wurde blockiert und gelöscht!`);
                }
            });

            if (element.tagName === 'A' && element.hasAttribute('href')) {
                const href = element.getAttribute('href').trim().toLowerCase();
                if (href.startsWith('javascript:') || href.startsWith('data:')) {
                    element.setAttribute('href', '#');
                    console.warn(`[GuardDOM]: 'javascript:'-Protokoll in Link blockiert und auf '#' gesetzt.`);
                }
            }
            
            if (element.tagName === 'SCRIPT') {
                element.remove();
                console.warn(`[GuardDOM]: <script>-Tag im Template entdeckt und vernichtet.`);
            }
        });

        return doc.body.innerHTML;
    }
}