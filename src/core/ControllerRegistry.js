import { LoggerService } from "../services/LoggerService.js";

/**
 * Registry-Klasse des Aspis-Frameworks zum dynamischen Laden, Validieren und Cachen von Controller-Klassen.
 * 
 * @internal
 */
export class ControllerRegistry {
    /**
     * Statischer Cache für bereits geladene Controller-Klassen über alle Instanzen hinweg.
     * @internal
     * @type {ControllerRegistryCache}
     */
    static #sharedCache = new Map();

    /**
     * Instanzspezifischer Cache für lokal aufgelöste Controller-Klassen.
     * @internal
     * @type {ControllerRegistryCache}
     */
    #resolvedControllers = new Map();

    /**
     * Der Basispfad zum Verzeichnis der Controller-Dateien.
     * @internal
     * @type {string}
     */
    #basePath;

    /**
     * Erstellt eine neue Instanz der ControllerRegistry für das dynamische Laden von Controllern.
     * 
     * @public
     * @param {string} [basePath='./controllers'] - Relativer oder absoluter Pfad zum Controller-Verzeichnis.
     */
    constructor(basePath = './controllers') {
        this.#basePath = basePath;
    }

    /**
     * Lädt eine Controller-Klasse statisch und asynchron über eine Standard-Instanz.
     * 
     * @public
     * @static
     * @async
     * @param {string} controllerName - Der Name oder Typ des zu ladenden Controllers.
     * @returns {Promise<ControllerConstructor|null>} Die geladene Controller-Klasse oder `null`, falls das Laden fehlschlägt.
     */
    static async getAsync(controllerName) {
        const instance = new ControllerRegistry('./controllers');
        return instance.getAsync(controllerName);
    }

    /**
     * Lädt eine Controller-Klasse asynchron anhand ihres Namens oder Typs aus dem konfigurierten Basispfad.
     * 
     * @public
     * @async
     * @param {string} typeOrName - Der Name oder Typ des Controllers (z. B. `'User'` oder `'ControllerUser'`).
     * @returns {Promise<ControllerConstructor|null>} Die aufgelöste Controller-Klasse oder `null` bei Validierungs-, Sicherheits- oder Ladefehlern.
     */
    async getAsync(typeOrName) {
        if (!typeOrName || typeof typeOrName !== 'string') {
            LoggerService.error(`[ControllerRegistry.getAsync()] Aspis [ControllerRegistry]: Ungültiger Typ '${typeof typeOrName}'.`);
            return null;
        }

        const trimmed = typeOrName.trim();
        const safeNameRegex = /^[A-Za-z0-9_-]+$/;

        if (!safeNameRegex.test(trimmed)) {
            LoggerService.error(`[ControllerRegistry.getAsync()] Aspis [ControllerRegistry]: Sicherheitsfehler - Ungültiger Name '${trimmed}'.`);
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
                LoggerService.error(`[ControllerRegistry.getAsync()] Aspis [ControllerRegistry]: Klasse '${className}' konnte in '${fileUrl}' nicht gefunden werden.`);
                return null;
            }

            this.#resolvedControllers.set(trimmed, ControllerClass);
            ControllerRegistry.#sharedCache.set(trimmed, ControllerClass);

            return ControllerClass;

        } catch (error) {
            LoggerService.error(`[ControllerRegistry.getAsync()] Aspis [ControllerRegistry]: Fehler beim dynamischen Laden von '${fileUrl}':`, error);
            return null;
        }
    }
}

/**
 * Konstruktor-Typ bzw. Klasse eines dynamisch geladenen Aspis-Controllers.
 * @typedef {new (...args: any[]) => any} ControllerConstructor
 */
/**
 * Cache-Struktur für registrierte und aufgelöste Controller-Klassen.
 * @typedef {Map<string, ControllerConstructor>} ControllerRegistryCache
 */