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

class FormFieldService {
    static getFieldName(element) {
        if (!(element instanceof Element)) return null;
        return element.name || element.dataset.name || element.id || null;
    }

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
class ValidationService {
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

    static registerRule(name, fn) {
        if (typeof fn === 'function') {
            this.#rules[name] = fn;
        }
    }

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
    get fetcher() {
        if (this._options?.fetcher) return this._options.fetcher;
        if (typeof window !== 'undefined' && window.appRegistry?.has('fetcher')) {
            return window.appRegistry.get('fetcher');
        }
        return {
            get: async (url, params, opts) => {
                const res = await fetch(url, opts);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            }
        };
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

        if (this.#lifecycleController.signal.aborted) {
            taskController.abort(this.#lifecycleController.signal.reason);
        } else {
            this.#lifecycleController.signal.addEventListener('abort', () => {
                taskController.abort(this.#lifecycleController.signal.reason);
            }, { once: true });
        }

        return taskController.signal;
    }

    clearTask(taskKey) {
        if (this.#taskControllers.has(taskKey)) {
            this.#taskControllers.delete(taskKey);
        }
    }

    async onInit() {
        if (!this._container) {
            throw new Error(`Aspis [${this.constructor.name}]: Kein Container-Element übergeben.`);
        }
    }

    async start() {
        await this.#initEvents();
        if (this.signal.aborted) return;

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

        if (this.signal.aborted) return;

        await this.onInit();

        if (this.signal.aborted) return;
    }

    async #initEvents() {
        if (!this._dispatcher) return;

        let eventMap = {};

        if (this._options?.eventPath) {
            try {
                const fetcher = window.appRegistry?.get('fetcher');

                if (fetcher && typeof fetcher.get === 'function') {
                    eventMap = await fetcher.get(this._options.eventPath, {}, { signal: this.signal }) || {};
                } else {
                    const res = await fetch(this._options.eventPath, { signal: this.signal });
                    if (res.ok) {
                        eventMap = await res.json();
                    } else {
                        console.warn(`Aspis [BaseController]: Event-Config unter '${this._options.eventPath}' konnte nicht geladen werden.`);
                    }
                }
            } catch (e) {
                if (e.name !== 'AbortError') {
                    console.error(`Aspis [BaseController]: Fehler beim Laden von '${this._options.eventPath}':`, e);
                }
            }
        }

        if (this.signal.aborted) return;

        if (this._container?.dataset?.events) {
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

        console.log(`Aspis [Lifecycle]: ${this.constructor.name} erfolgreich gereinigt und aus dem Speicher entfernt.`);
    }

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

    setLoadingState(stateProxy, message = 'Lade...') {
        if (!stateProxy) return;

        stateProxy.error = null;
        stateProxy.isLoading = true;

        const loaderType = this._container?.dataset?.loader || 'spinner';
        const loaderTemplate = this._container?.dataset?.loaderTemplate || 'defaultSpinner';

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
class BaseModel {
    _layout = 'default';
    _options = {};

    constructor(options = {}) {
        this._options = typeof options === 'object' && options !== null ? { ...options } : {};
        if (this._options.layout) {
            this._layout = String(this._options.layout);
        }
    }

    setLayout(layout) {
        this._layout = String(layout);
    }

    get layout() {
        return this._layout;
    }

    toRenderData() {
        throw new Error(`Aspis [BaseModel]: '${this.constructor.name}' muss die Methode 'toRenderData()' implementieren.`);
    }
}



class ModelLoader extends BaseModel {
    #message;

    constructor(options = {}) {
        super(options);
        this.setMessage(options.message || 'Lade...');
    }

    get message() {
        return this.#message;
    }

    setMessage(msg) {
        const rawMsg = msg || 'Lade...';
        this.#message = typeof GuardDOM !== 'undefined' ? GuardDOM.clean(rawMsg) : String(rawMsg);
    }

    toRenderData() {
        return {
            layout: this._layout,
            message: this.#message
        };
    }
}
class ModelSpinner extends ModelLoader {
    constructor(options = {}) {
        const isString = typeof options === 'string';
        const message = isString ? options : (options.message || 'Lade Daten...');
        const layout = isString ? 'spinner' : (options.layout || 'spinner');

        super({
            layout: layout,
            message: message
        });
    }
}
class ModelLoadingBar extends ModelLoader {
    #progress = 0;

    constructor(options = {}) {
        const isNumber = typeof options === 'number';
        const progressVal = isNumber ? options : (options.progress || 0);
        const message = isNumber ? 'Lade...' : (options.message || 'Lade...');
        const layout = isNumber ? 'bar' : (options.layout || 'bar');

        super({
            layout: layout,
            message: message
        });

        this.setProgress(progressVal);
    }

    get progress() {
        return this.#progress;
    }

    setProgress(percent) {
        this.#progress = Math.min(100, Math.max(0, Number(percent) || 0));
    }

    toRenderData() {
        return {
            ...super.toRenderData(),
            progress: this.#progress
        };
    }
}

class ControllerTable extends BaseController {
    #model = null;

    constructor(container, store, dispatcher, options = {}) {
        super(container, store, dispatcher, options);
        this._sliceKey = options.sliceKey || 'features.tableFeature';
    }

    async onInit() {
        await super.onInit();
        if (this.signal.aborted) return;

        const url = this._container.dataset.url;
        if (!url) {
            throw new Error(`Aspis [ControllerTable]: Fehlendes 'data-url'-Attribut am Container <${this._container.tagName.toLowerCase()}>.`);
        }

        await this.loadData(url);
    }

    onStateChange(slice) {
        if (slice && slice.model && this.#model !== slice.model) {
            this.#model = slice.model;
            this.#render();
        }
    }

    async loadData(url) {
        const stateProxy = this._store?.getSlice(this._sliceKey);
        if (!stateProxy) return;

        try {
            this.setLoadingState(stateProxy, 'Tabelle wird geladen...');
            
            const liveData = await this.fetcher.get(url, {}, { signal: this.getSignal('loadData') });

            if (this.signal.aborted) return;

            if (liveData) {
                const layout = this._container.dataset.layout || this._options?.layout || 'default';
                stateProxy.model = new ModelTable(liveData, { layout });
            }
        } catch (error) {
            if (error.name !== 'AbortError') {
                stateProxy.error = error.message;
                console.error("[ControllerTable]: Fehler im loadData-Ablauf", error);
            }
        } finally {
            if (stateProxy) {
                stateProxy.isLoading = false;
            }
            this.clearTask('loadData');
        }
    }

    reload(filterPayload = {}) {
        const baseUrl = this._container.dataset.url;
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

    async #render() {
        if (!this.#model) return;
        try {
            let templateName = this._container.dataset.template || "meine-tabelle";

            if (typeof ModelLoader !== 'undefined' && this.#model instanceof ModelLoader) {
                templateName = this._container.dataset.loaderTemplate || "defaultSpinner";
            }

            if (typeof RenderService !== 'undefined' && typeof RenderService.paste === 'function') {
                await RenderService.paste(this._container, templateName, this.#model.toRenderData());
                console.log(`[ControllerTable]: HTML für '${this._sliceKey}' erfolgreich ins DOM injiziert.`);
            } else {
                console.warn("[ControllerTable]: RenderService ist nicht verfügbar.");
            }
        } catch (error) {
            console.error("[ControllerTable]: Render-Fehler", error);
        }
    }
}
class ModelTable extends BaseModel {
    static Row = class ModelTableRow {
        #data = {};

        constructor(data = {}) {
            if (data && typeof data === 'object') {
                for (const [key, value] of Object.entries(data)) {
                    if (typeof value === 'string') {
                        this.#data[key] = typeof GuardDOM !== 'undefined' ? GuardDOM.clean(value) : value;
                    } else {
                        this.#data[key] = value;
                    }
                }
            }
        }

        get(key) {
            return this.#data[key];
        }

        toRenderData() {
            return { ...this.#data };
        }

        static canHandle(data) {
            return data && typeof data === 'object';
        }
    };

    static Item = ModelTable.Row;

    #rows = [];

    constructor(rawData = [], options = {}) {
        const opts = typeof options === 'string' ? { layout: options } : options;
        super(opts);

        const list = Array.isArray(rawData)
            ? rawData
            : (rawData?.rows || rawData?.data || []);

        this.buildRows(list);
    }

    get rows() {
        return [...this.#rows];
    }

    buildRows(rawData) {
        this.#rows = rawData
            .filter(data => ModelTable.Row.canHandle(data))
            .map(data => data instanceof ModelTable.Row ? data : new ModelTable.Row(data));
    }

    appendRow(data) {
        if (data instanceof ModelTable.Row) {
            this.#rows.push(data);
        } else if (data && typeof data === 'object') {
            this.#rows.push(new ModelTable.Row(data));
        }
    }

    clearRows() {
        this.#rows = [];
    }

    toRenderData() {
        return {
            layout: this._layout,
            rows: this.#rows.map(row => row.toRenderData())
        };
    }
}

class ControllerAccordion extends BaseController {
    #model = null;

    constructor(container, store, dispatcher, options = {}) {
        super(container, store, dispatcher, options);
        this._sliceKey = options.sliceKey || 'features.accordionFeature';
    }

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

    onStateChange(slice) {
        if (slice && slice.model && this.#model !== slice.model) {
            this.#model = slice.model;
            this.#renderFull();
        }
    }

    #scanDOMAndBuildModel() {
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

    #bindDOMEvents() {
        if (!this._container) return;

        this._container.addEventListener('click', (e) => {
            const trigger = e.target.closest('[data-target="trigger"]');
            if (!trigger) return;

            const itemEl = trigger.closest('[data-accordion-item]');
            const itemId = itemEl?.dataset.id || itemEl?.id;

            if (itemId) {
                this.toggle(itemId);
            }
        }, { signal: this.signal });

        this._container.addEventListener('keydown', (e) => {
            this.#handleKeyDown(e);
        }, { signal: this.signal });
    }

    #handleKeyDown(e) {
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

    async loadData(url) {
        const stateProxy = this._store?.getSlice(this._sliceKey);

        try {
            if (stateProxy) {
                this.setLoadingState(stateProxy, 'Akkordeon-Inhalte werden geladen...');
            }

            const liveData = await this.fetcher.get(url, {}, { signal: this.getSignal('loadData') });

            if (this.signal.aborted) return;

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
            if (error.name !== 'AbortError') {
                if (stateProxy) stateProxy.error = error.message;
                console.error("[ControllerAccordion]: Fehler im loadData-Ablauf", error);
            }
        } finally {
            if (stateProxy) stateProxy.isLoading = false;
            this.clearTask('loadData');
        }
    }

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
                item: toggledItem.toRenderData(),
                container: this._container
            });
        }
    }

    #updateItemUI(item) {
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

    async #renderFull() {
        if (!this.#model) return;

        try {
            let templateName = this._container.dataset.template || "accordion-component";

            if (typeof ModelLoader !== 'undefined' && this.#model instanceof ModelLoader) {
                templateName = this._container.dataset.loaderTemplate || "defaultSpinner";
            }

            if (typeof RenderService !== 'undefined' && typeof RenderService.paste === 'function') {
                await RenderService.paste(this._container, templateName, this.#model.toRenderData());
                console.log(`[ControllerAccordion]: HTML für '${this._sliceKey}' erfolgreich im DOM aktualisiert.`);
            } else {
                console.warn("[ControllerAccordion]: RenderService ist nicht verfügbar.");
            }
        } catch (error) {
            console.error("[ControllerAccordion]: Render-Fehler", error);
        }
    }
}
class ModelAccordion extends BaseModel {
    static Item = class ModelAccordionItem {
        #id;
        #title;
        #content;
        #isOpen;
        #disabled;

        constructor(data = {}) {
            const rawId = data.id || `acc-item-${Math.random().toString(36).substring(2, 9)}`;
            this.#id = typeof GuardDOM !== 'undefined' ? GuardDOM.clean(rawId) : String(rawId);
            this.#title = typeof GuardDOM !== 'undefined' ? GuardDOM.clean(data.title || '') : (data.title || '');
            
            this.#content = typeof GuardDOM !== 'undefined' && typeof GuardDOM.purify === 'function' 
                ? GuardDOM.purify(data.content || '') 
                : (data.content || '');
                
            this.#isOpen = Boolean(data.isOpen);
            this.#disabled = Boolean(data.disabled);
        }

        get id() { return this.#id; }
        get title() { return this.#title; }
        get content() { return this.#content; }
        get isOpen() { return this.#isOpen; }
        get disabled() { return this.#disabled; }

        setOpen(open) {
            if (this.#disabled) return;
            this.#isOpen = Boolean(open);
        }

        toggle() {
            if (this.#disabled) return;
            this.#isOpen = !this.#isOpen;
        }

        toRenderData() {
            return {
                id: this.#id,
                title: this.#title,
                content: this.#content,
                isOpen: this.#isOpen,
                disabled: this.#disabled
            };
        }

        static canHandle(data) {
            return data && typeof data === 'object';
        }
    };

    #items = [];
    #singleOpen = false;

    constructor(rawData = [], options = {}) {
        const opts = typeof options === 'string' ? { layout: options } : options;
        super(opts);

        this.#singleOpen = Boolean(opts.singleOpen);

        const list = Array.isArray(rawData)
            ? rawData
            : (rawData?.items || rawData?.data || []);

        this.buildItems(list);
    }

    get singleOpen() { return this.#singleOpen; }
    get items() { return [...this.#items]; }

    buildItems(rawData) {
        this.#items = rawData
            .filter(data => ModelAccordion.Item.canHandle(data))
            .map(data => new ModelAccordion.Item(data));
    }

    getItem(itemId) {
        return this.#items.find(item => item.id === itemId) || null;
    }

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

    openItem(itemId) {
        const targetItem = this.getItem(itemId);
        if (!targetItem || targetItem.disabled) return;

        if (this.#singleOpen) {
            this.#items.forEach(item => item.setOpen(false));
        }
        targetItem.setOpen(true);
    }

    closeItem(itemId) {
        const targetItem = this.getItem(itemId);
        if (targetItem) {
            targetItem.setOpen(false);
        }
    }

    openAll() {
        if (this.#singleOpen) return;
        this.#items.forEach(item => item.setOpen(true));
    }

    closeAll() {
        this.#items.forEach(item => item.setOpen(false));
    }

    toRenderData() {
        return {
            layout: this._layout,
            singleOpen: this.#singleOpen,
            items: this.#items.map(item => item.toRenderData())
        };
    }
}

class ControllerForm extends BaseController {
    #model = null;
    #validateOnBlur = true;
    #validateOnChange = false;

    constructor(container, store, dispatcher, options = {}) {
        super(container, store, dispatcher, options);
        this._sliceKey = options.sliceKey || 'forms.mainForm';
        this.#validateOnBlur = options.validateOnBlur ?? true;
        this.#validateOnChange = options.validateOnChange ?? false;
    }

    async onInit() {
        await super.onInit();
        if (this.signal.aborted) return;

        this.#initializeFormModel();
        this.#bindFormEvents();
    }

    #initializeFormModel() {
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

    #bindFormEvents() {
        this._container.addEventListener('input', (e) => this.#handleInput(e), { signal: this.signal });
        this._container.addEventListener('change', (e) => this.#handleChange(e), { signal: this.signal });
        this._container.addEventListener('focusout', (e) => this.#handleBlur(e), { signal: this.signal });

        this._container.addEventListener('submit', (e) => {
            e.preventDefault();
            this.submit();
        }, { signal: this.signal });

        if (this._dispatcher) {
            this._dispatcher.on('dropdown:change', (data) => {
                if (data && data.name && this._container.contains(data.container)) {
                    this.#updateField(data.name, data.value, true);
                }
            });
        }
    }

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

    #updateField(name, value, triggerValidation = true) {
        if (!this.#model) return;

        this.#model.setFieldValue(name, value, true);

        if (triggerValidation) {
            this.updateFieldUI(name);
        }
    }

    updateFieldUI(name) {
        if (!this.#model) return;

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

    async submit() {
        if (!this.#model || this.#model.isSubmitting) return;

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
            if (typeof this.fetcher.request === 'function') {
                response = await this.fetcher.request(url, {
                    method: method,
                    body: payload,
                    signal: submitSignal
                });
            } else if (method === 'POST' && typeof this.fetcher.post === 'function') {
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

            if (this.signal.aborted) return;

            this.#model.setSubmitResult(true);
            this.#showFormMessage('Formular erfolgreich abgesendet!', 'success');

            if (this._dispatcher) {
                this._dispatcher.emit('form:success', { response, payload: this.#model.toPayload() });
            }

            if (this._container.dataset.resetOnSuccess !== 'false') {
                this.reset();
            }

        } catch (error) {
            if (error.name !== 'AbortError' && !this.signal.aborted) {
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

    reset() {
        if (this.#model) {
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
    }

    #focusFirstInvalidField() {
        if (!this.#model) return;
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

    #toggleSubmittingUI(isSubmitting) {
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

    #showFormMessage(msg, type = 'error') {
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

    #hideFormMessage() {
        const msgEl = this._container.querySelector('[data-target="form-message"]');
        if (msgEl) {
            if (typeof ModifierDOM !== 'undefined' && typeof ModifierDOM.addClass === 'function') {
                ModifierDOM.addClass(msgEl, 'is-hidden');
            } else {
                msgEl.classList.add('is-hidden');
            }
        }
    }
}
class ModelForm extends BaseModel {
    #fields = new Map();
    #isSubmitting = false;
    #submitError = null;
    #submitSuccess = false;

    constructor(initialFields = {}, options = {}) {
        super(options);

        Object.entries(initialFields).forEach(([name, config]) => {
            this.addField(name, config.value, config.rules);
        });
    }

    get isSubmitting() { return this.#isSubmitting; }
    get submitError() { return this.#submitError; }
    get submitSuccess() { return this.#submitSuccess; }

    get isValid() {
        for (const [_, field] of this.#fields) {
            if (field.error) return false;
        }
        return true;
    }

    get isDirty() {
        for (const [_, field] of this.#fields) {
            if (field.isDirty) return true;
        }
        return false;
    }

    addField(name, initialValue = '', rules = {}) {
        if (!name) return;

        const cleanVal = typeof GuardDOM !== 'undefined' ? GuardDOM.clean(initialValue) : initialValue;

        this.#fields.set(name, {
            value: cleanVal,
            initialValue: cleanVal,
            error: null,
            isTouched: false,
            isDirty: false,
            rules: rules || {}
        });
    }

    setFieldValue(name, rawValue, markTouched = true) {
        const field = this.#fields.get(name);
        if (!field) return;

        const value = typeof GuardDOM !== 'undefined' ? GuardDOM.clean(rawValue) : rawValue;

        field.value = value;
        field.isDirty = field.value !== field.initialValue;
        if (markTouched) field.isTouched = true;

        this.validateField(name);
    }

    getField(name) {
        return this.#fields.get(name) || null;
    }

    getErrors() {
        const errors = {};
        this.#fields.forEach((field, name) => {
            if (field.error) errors[name] = field.error;
        });
        return errors;
    }

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

    validateAll() {
        let allValid = true;
        this.#fields.forEach((field, name) => {
            field.isTouched = true;
            const valid = this.validateField(name);
            if (!valid) allValid = false;
        });
        return allValid;
    }

    setSubmitting(state) {
        this.#isSubmitting = Boolean(state);
        if (state) {
            this.#submitError = null;
            this.#submitSuccess = false;
        }
    }

    setSubmitResult(success, errorMessage = null) {
        this.#isSubmitting = false;
        this.#submitSuccess = Boolean(success);
        this.#submitError = errorMessage;
    }


    toPayload() {
        const payload = {};
        this.#fields.forEach((field, name) => {
            payload[name] = field.value;
        });
        return payload;
    }

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

class ControllerCustomDropdown extends BaseController {
    #model = null;
    #clickOutsideUnsub = null;

    constructor(container, store, dispatcher, options = {}) {
        super(container, store, dispatcher, options);
        this._sliceKey = options.sliceKey || 'features.dropdownFeature';
    }

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

    onStateChange(slice) {
        if (slice && slice.model && this.#model !== slice.model) {
            this.#model = slice.model;
            this.#renderFull();
        }
    }

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
            if (error.name !== 'AbortError') {
                console.error('[ControllerCustomDropdown]: Fehler beim Laden der Optionen', error);
            }
        } finally {
            if (stateProxy) stateProxy.isLoading = false;
            this.clearTask('loadOptions');
        }
    }

    #bindDOMEvents() {
        if (!this._container) return;

        if (typeof ModifierDOM !== 'undefined' && typeof ModifierDOM.attr === 'function') {
            ModifierDOM.attr(this._container, 'tabindex', '0');
            ModifierDOM.attr(this._container, 'role', 'combobox');
        } else {
            this._container.setAttribute('tabindex', '0');
            this._container.setAttribute('role', 'combobox');
        }

        this._container.addEventListener('click', (e) => {
            const trigger = e.target.closest('[data-target="trigger"]');
            if (trigger) {
                this.toggle();
                return;
            }

            const optionEl = e.target.closest('[data-option-value]');
            if (optionEl && !optionEl.hasAttribute('data-disabled')) {
                const value = optionEl.dataset.optionValue;
                this.selectValue(value);
            }
        }, { signal: this.signal });

        this._container.addEventListener('keydown', (e) => {
            this.#handleKeyDown(e);
        }, { signal: this.signal });
    }

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

    toggle() {
        if (!this.#model) return;
        this.#model.isOpen ? this.close() : this.open();
    }

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

    selectValue(value) {
        if (!this.#model) return;

        const changed = this.#model.selectByValue(value);
        if (changed) {
            this.#syncWithNativeInput();

            const fieldName = typeof FormFieldService !== 'undefined' && typeof FormFieldService.getFieldName === 'function'
                ? FormFieldService.getFieldName(this._container)
                : (this._container.name || this._container.dataset.name);

            if (this._dispatcher) {
                this._dispatcher.emit('dropdown:change', {
                    name: fieldName,
                    value: this.#model.value,
                    label: this.#model.selectedItem?.label,
                    container: this._container
                });
            }

            const labelEl = this._container.querySelector('[data-target="label"]');
            if (labelEl && this.#model.selectedItem) {
                labelEl.textContent = this.#model.selectedItem.label;
            }
        }

        this.close();
        this.validateUI();
    }

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

    async #renderFull() {
        if (!this.#model) return;

        try {
            let templateName = this._container.dataset.template || "custom-dropdown";

            if (typeof ModelLoader !== 'undefined' && this.#model instanceof ModelLoader) {
                templateName = this._container.dataset.loaderTemplate || "defaultSpinner";
            }

            if (typeof RenderService !== 'undefined' && typeof RenderService.paste === 'function') {
                await RenderService.paste(this._container, templateName, this.#model.toRenderData());
            } else {
                console.warn("[ControllerCustomDropdown]: RenderService ist nicht verfügbar.");
            }
        } catch (error) {
            console.error("[ControllerCustomDropdown]: Render-Fehler", error);
        }
    }

    onDestroy() {
        super.onDestroy();
        if (this.#clickOutsideUnsub) {
            this.#clickOutsideUnsub();
            this.#clickOutsideUnsub = null;
        }
    }
}
class ModelCustomDropdown extends BaseModel {
    static Item = class ModelDropdownItem {
        #value;
        #label;
        #disabled;

        constructor(data = {}) {
            const rawVal = data.value ?? data.id ?? '';
            const rawLabel = data.label ?? data.title ?? String(rawVal);
            
            this.#value = typeof GuardDOM !== 'undefined' ? GuardDOM.clean(rawVal) : String(rawVal);
            this.#label = typeof GuardDOM !== 'undefined' ? GuardDOM.clean(rawLabel) : String(rawLabel);
            this.#disabled = Boolean(data.disabled);
        }

        get value() { return this.#value; }
        get label() { return this.#label; }
        get disabled() { return this.#disabled; }

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

    #items = [];
    #selectedIndex = -1;
    #focusedIndex = -1;
    #isOpen = false;
    #fieldState;

    constructor(rawData = [], options = {}) {
        const opts = typeof options === 'string' ? { layout: options } : options;
        super(opts);

        this.#fieldState = FormFieldService.createFieldState(opts.value || '', opts.rules || {});
        this.setOptions(rawData);

        if (opts.value !== undefined) {
            this.selectByValue(opts.value, false);
        }
    }

    get isOpen() { return this.#isOpen; }
    get focusedIndex() { return this.#focusedIndex; }
    get selectedIndex() { return this.#selectedIndex; }
    get selectedItem() { return this.#items[this.#selectedIndex] || null; }
    get value() { return this.#fieldState.value; }
    get error() { return this.#fieldState.error; }

    setOptions(rawData = []) {
        const list = Array.isArray(rawData) ? rawData : (rawData?.options || rawData?.data || []);
        this.#items = list.map(item => new ModelCustomDropdown.Item(item));
        this.#selectedIndex = this.#items.findIndex(item => item.value === this.#fieldState.value);
        this.#focusedIndex = this.#selectedIndex >= 0 ? this.#selectedIndex : 0;
    }

    setOpen(open) {
        this.#isOpen = Boolean(open);
        if (this.#isOpen) {
            this.#focusedIndex = this.#selectedIndex >= 0 ? this.#selectedIndex : 0;
        }
    }

    selectByValue(val, triggerValidation = true) {
        const index = this.#items.findIndex(item => item.value === val && !item.disabled);
        if (index === -1 && val !== '') return false;

        this.#selectedIndex = index;
        this.#focusedIndex = index >= 0 ? index : 0;
        this.#fieldState.value = index >= 0 ? this.#items[index].value : '';
        this.#fieldState.isTouched = true;

        if (triggerValidation) {
            this.validate();
        }
        return true;
    }

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

    selectFocused() {
        if (this.#focusedIndex >= 0 && this.#focusedIndex < this.#items.length) {
            const item = this.#items[this.#focusedIndex];
            if (!item.disabled) {
                return this.selectByValue(item.value);
            }
        }
        return false;
    }

    validate() {
        if (typeof ValidationService !== 'undefined') {
            this.#fieldState.error = ValidationService.validateField(
                this.#fieldState.value, 
                this.#fieldState.rules
            );
        }
        return !this.#fieldState.error;
    }

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

Main.autoBoot();