/** @internal */
export class ControllerRegistry {
    /** @internal */
    static #sharedCache = new Map();

    /** @internal */
    #resolvedControllers = new Map();

    /** @internal */
    #basePath;

    /** @public */
    constructor(basePath = './controllers') {
        this.#basePath = basePath;
    }

    /** @public */
    static async getAsync(controllerName) {
        const instance = new ControllerRegistry('./controllers');
        return instance.getAsync(controllerName);
    }

    /** @public */
    async getAsync(typeOrName) {
        if (!typeOrName || typeof typeOrName !== 'string') {
            console.error(`Aspis [ControllerRegistry]: Ungültiger Typ '${typeof typeOrName}'.`);
            return null;
        }

        const trimmed = typeOrName.trim();
        const safeNameRegex = /^[A-Za-z0-9_-]+$/;

        if (!safeNameRegex.test(trimmed)) {
            console.error(`Aspis [ControllerRegistry]: Sicherheitsfehler - Ungültiger Name '${trimmed}'.`);
            return null;
        }

        if (this.#resolvedControllers.has(trimmed)) {
            return this.#resolvedControllers.get(trimmed);
        }

        if (ControllerRegistry.#sharedCache.has(trimmed)) {
            const cachedClass = ControllerRegistry.#sharedCache.get(trimmed);
            this.#resolvedControllers.set(trimmed, cachedClass);
            return cachedClass;
        }

        const isFullClassName = trimmed.toLowerCase().startsWith('controller');
        const className = isFullClassName 
            ? trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
            : `Controller${trimmed.charAt(0).toUpperCase() + trimmed.slice(1)}`;

        const fileUrl = `${this.#basePath}/${className}.js`;

        try {
            const module = await import(fileUrl);
            const ControllerClass = module[className] || module.default || module[trimmed];

            if (!ControllerClass) {
                console.error(`Aspis [ControllerRegistry]: Klasse '${className}' konnte in '${fileUrl}' nicht gefunden werden.`);
                return null;
            }

            this.#resolvedControllers.set(trimmed, ControllerClass);
            ControllerRegistry.#sharedCache.set(trimmed, ControllerClass);

            return ControllerClass;

        } catch (error) {
            console.error(`Aspis [ControllerRegistry]: Fehler beim dynamischen Laden von '${fileUrl}':`, error);
            return null;
        }
    }
}