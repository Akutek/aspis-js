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
                }),
                fetch('./js/aspis/core/event-manifest.json').then(res => {
                    if (!res.ok) return {};
                    return res.json();
                }).catch(() => ({}))
            ]);

            const services = this.createServices(controllerRegistry, config, stateManifest, eventManifest);
            window.appRegistry = services;

            const scanResults = ScannerDOM.scan(document.body);
            await this.assignControllers(scanResults, services);

            console.info("Aspis [Main]: Anwendung erfolgreich gebootet.");
            return services;
        } catch (error) {
            console.error("Aspis [Main]: Kritischer Fehler beim Bootstrapping der Anwendung:", error);
        }
    }

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

    static createServices(controllerRegistry, config, manifest, eventManifest) {
        const registry = new Registry();

        registry.set('controllerRegistry', controllerRegistry);
        registry.set('config', config);
        registry.set('store', new Store(manifest));
        registry.set('eventManifest', eventManifest || {});
        registry.set('fetcher', new DatenFetcher());
        registry.set('dispatcher', new EventDispatcher());
        registry.set('modifierDOM', ModifierDOM);
        registry.set('cleaner', new ComponentCleaner(registry));
        registry.set('templates', new TemplateService());

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
            this.#store.pushEffect(this);
            return this.#fn();
        } finally {
            this.#store.popEffect();
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

class Store extends EventTarget {
    #listeners = new Map();
    #dependencies = new Map();
    #domDependencies = new Map();
    #data = {};
    #stateProxy;
    #proxyCache = new WeakMap();
    #configs = {};

    #effectQueue = new Set();
    #pendingDomUpdates = new Map();
    #isFlushPending = false;
    #effectStack = [];
    #strictMode;

    static ALLOWED_NAMESPACES = ['app', 'features', 'shared'];

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

    get _activeEffect() {
        return this.#effectStack[this.#effectStack.length - 1] || null;
    }

    get state() {
        return this.#stateProxy;
    }

    get data() {
        return Object.freeze({ ...this.#data });
    }

    getSlice(path) {
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

    getConfig(path) {
        return this.#configs[path] || {};
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

    pushEffect(effect) {
        this.#effectStack.push(effect);
    }

    popEffect() {
        this.#effectStack.pop();
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

    #queueFlush() {
        if (this.#isFlushPending) return;
        this.#isFlushPending = true;

        queueMicrotask(() => {
            this.#flushQueue();
        });
    }

    #flushQueue() {
        try {
            if (this.#pendingDomUpdates.size > 0) {
                this.#pendingDomUpdates.forEach((paths, element) => {
                    console.info(`Aspis [Store]: Batch-Flush -> PHP-Abhängigkeit getriggert für DOM-Knoten.`);
                    this.#triggerElementUpdate(element, paths);
                });
            }

            if (this.#effectQueue.size > 0) {
                this.#effectQueue.forEach(effect => effect.run());
            }
        } catch (error) {
            console.error("Aspis [Store]: Fehler während des Microtask-Flushes:", error);
        } finally {
            this.#pendingDomUpdates.clear();
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
    removeDomDependencies(targetElement) {
        if (!(targetElement instanceof HTMLElement)) return;
        this.#domDependencies.forEach((elements) => {
            elements.delete(targetElement);
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

    has(key) {
        if (typeof key === 'string') {
            return this.#services.has(key);
        }
        if (key instanceof HTMLElement) {
            return this.#elements.has(key);
        }
        return false;
    }

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

    clearServices() {
        this.#services.clear();
    }
}

class DatenFetcher {
    #defaultTimeoutMs;

    constructor(defaultTimeoutMs = 8000) {
        this.#defaultTimeoutMs = defaultTimeoutMs;
    }

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

        const combinedSignal = signal 
            ? AbortSignal.any([signal, timeoutSignal])
            : timeoutSignal;

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

        if (typeof AbortSignal.any === 'function') {
            return AbortSignal.any([this.#lifecycleController.signal, taskController.signal]);
        }

        return taskController.signal;
    }

    clearTask(taskKey) {
        if (this.#taskControllers.has(taskKey)) {
            this.#taskControllers.delete(taskKey);
        }
    }

    async start() {
        await this.#initEvents();

        if (this._sliceKey && this._store && typeof this._store.effect === 'function') {
            this.#unsubscribeStore = this._store.effect(() => {
                if (!this._store) return;
                const slice = typeof this._store.getSlice === 'function' 
                    ? this._store.getSlice(this._sliceKey) 
                    : null;

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

        if (this.signal?.aborted) return;
        if (this._container && this._container.dataset && this._container.dataset.events) {
            try {
                const inlineMap = JSON.parse(this._container.dataset.events);
                eventMap = { ...eventMap, ...inlineMap };
            } catch (e) {
                console.error(`Aspis [BaseController]: Fehler beim Parsen von data-events an <${this.constructor.name}>:`, e);
            }
        }

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
        if (!this._container) return;

        if (!slice || !slice.config || !slice.config.targets) {
            if (typeof this.onStateChange === 'function') {
                this.onStateChange(slice);
            }
            return;
        }

        const targets = slice.config.targets;
        for (const [, targetConfig] of Object.entries(targets)) {
            const element = targetConfig.selector === ':scope' 
                ? this._container 
                : this._container.querySelector(targetConfig.selector);
                
            if (!element || !targetConfig.bindClasses) continue;

            for (const [stateProp, styleKey] of Object.entries(targetConfig.bindClasses)) {
                const isActive = !!slice[stateProp]; 
                if (typeof ModifierDOM !== 'undefined' && typeof ModifierDOM.toggleSliceClass === 'function') {
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
        this._sliceKey = 'features.tableFeature';
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
        const stateProxy = this._store.getSlice ? this._store.getSlice(this._sliceKey) : this._store.state[this._sliceKey];
        if (!stateProxy) return;

        try {
            stateProxy.isLoading = true;
            this._container.innerHTML = "<p>Lade Daten...</p>";
            const liveData = await this.#api.get(url, {}, { signal: this.getSignal('loadData') });
            
            if (liveData) {
                stateProxy.model = new Table(this.#layout, liveData);
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

    let url = baseUrl;

    if (filterPayload && filterPayload.classId) {
        const separator = baseUrl.includes('?') ? '&' : '?';
        url += `${separator}class=${encodeURIComponent(filterPayload.classId)}`;
    }

    this.loadData(url);
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
    static Row = class TableRow {
        constructor(data = {}) {
            Object.assign(this, data);
        }

        toRenderData() {
            return { ...this };
        }

        static canHandle(data) {
            return data && typeof data === 'object';
        }
    };

    #rows = [];
    #layout;

    constructor(layout = 'default', rawData = []) {
        this.#layout = layout;
        
        const list = Array.isArray(rawData) 
            ? rawData 
            : (rawData?.rows || rawData?.data || []);
            
        this.buildRows(list);
    }

    buildRows(rawData) {
        this.#rows = rawData
            .filter(data => Table.Row.canHandle(data))
            .map(data => new Table.Row(data));
    }

    appendRow(data) {
        if (data instanceof Table.Row) {
            this.#rows.push(data);
        } else if (data && typeof data === 'object') {
            this.#rows.push(new Table.Row(data));
        }
    }

    toRenderData() {
        return {
            layout: this.#layout,
            rows: this.#rows.map(row => row.toRenderData())
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
    static async paste(targetContainer, templateName, data = {}) {
        if (!targetContainer || !(targetContainer instanceof HTMLElement)) {
            throw new Error("Aspis [RenderService]: Ungültiges Ziel-Element für paste().");
        }

        const element = await this.compile(templateName, data);
        if (!element) {
            throw new Error(`Aspis [RenderService]: Rendering für '${templateName}' fehlgeschlagen.`);
        }
        const cleaner = window.appRegistry?.get('cleaner');
        if (cleaner && typeof cleaner.cleanTree === 'function') {
            cleaner.cleanTree(targetContainer);
        }

        const cleanElement = this.#purifyElement(element);
        targetContainer.replaceChildren(cleanElement);
        return cleanElement;
    }

    static async compile(templateName, data = {}) {
        const registry = window.appRegistry;
        const templateEngine = registry ? registry.get('templates') : null;

        if (!templateEngine) {
            throw new Error("Aspis [RenderService]: TemplateService nicht im Registry-Container gefunden.");
        }

        let element = templateEngine.compile(templateName, { data });

        if (!element) {
            const templateData = await templateEngine.get(templateName);
            if (templateData) {
                element = templateEngine.compile(templateName, { data });
            }
        }

        return element;
    }

    static async loop(templateName, list = []) {
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

    static combine(targetContainer, elements = []) {
        if (!targetContainer || !(targetContainer instanceof HTMLElement)) {
            throw new Error("Aspis [RenderService]: Ungültiges Ziel-Element für combine().");
        }

        const nodeList = Array.isArray(elements) ? elements : [elements];
        targetContainer.replaceChildren(...nodeList);
    }

    static #purifyElement(element) {
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

class TemplateService {
    #cache = new Map();
    #basePath;
    #sanitizer;

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

    has(name) {
        return this.#cache.has(name);
    }

    clearCache() {
        this.#cache.clear();
    }

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

    getTemplateEvents(name) {
        return this.#cache.get(name)?.events ?? {};
    }

    #replacePlaceholders(html, sortedEntries, values) {
        let result = html;
        for (const [key, placeholder] of sortedEntries) {
            const rawValue = values[key] ?? "";
            const cleanValue = this.#sanitizer(rawValue);
            result = result.replaceAll(placeholder, cleanValue);
        }
        return result;
    }

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

    #appendSlotChild(parent, targetNode, content) {
        if (content instanceof Node) {
            parent.insertBefore(content, targetNode);
        } else if (typeof content === "string") {
            const fragment = document.createRange().createContextualFragment(content);
            parent.insertBefore(fragment, targetNode);
        }
    }

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

class EventDispatcher {
    #listeners = new Map();
    #eventManifest;
    #clickTrackerHandler = null;

    constructor(eventManifest = {}) {
        this.#eventManifest = eventManifest;
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

    once(eventName, callback) {
        if (typeof callback !== 'function') return () => {};

        const unsubscribe = this.on(eventName, (data) => {
            unsubscribe();
            callback(data);
        });

        return unsubscribe;
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

        const targets = Array.from(eventListeners);
        targets.forEach(callback => {
            Promise.resolve()
                .then(() => callback(data))
                .catch(error => {
                    console.error(`Aspis [EventDispatcher]: Fehler bei '${eventName}':`, error);
                });
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

    clear() {
        this.#listeners.clear();
    }

    destroy() {
        this.clear();
        if (this.#clickTrackerHandler) {
            document.removeEventListener('click', this.#clickTrackerHandler);
            this.#clickTrackerHandler = null;
        }
    }

    #initGlobalClickTracker() {
        this.#clickTrackerHandler = (event) => {
            this.emit('document:click', event.target);
        };
        document.addEventListener('click', this.#clickTrackerHandler);
    }
}

class ModifierDOM {
    static #isValid(target) {
        return target instanceof Element;
    }

    static #normalize(target) {
        if (!target) return [];
        if (target instanceof Element) return [target];
        if (typeof target[Symbol.iterator] === 'function' && typeof target !== 'string') {
            return Array.from(target);
        }
        return [];
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
        if (classes.length === 0) return;

        this.#normalize(target).forEach(el => {
            if (!this.#isValid(el)) return;
            el.classList.add(...classes);
        });
    }

    static removeClass(target, classNames) {
        if (!classNames || typeof classNames !== 'string') return;
        const classes = classNames.split(/\s+/).filter(Boolean);
        if (classes.length === 0) return;

        this.#normalize(target).forEach(el => {
            if (!this.#isValid(el)) return;
            el.classList.remove(...classes);
        });
    }

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

    destroy() {
        this.stop();
        super.destroy();
    }
}

class GuardDOM {
    static clean(unsafeText) {
        if (unsafeText === null || unsafeText === undefined) return '';
        const str = String(unsafeText);
        
        return str
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

Main.autoBoot();