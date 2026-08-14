export class ControllerRegistry {
    static #cache = new Map();

    static async getAsync(controllerName) {
        if (typeof controllerName !== 'string') {
            console.error(`Aspis [ControllerRegistry]: Ungültiger Typ '${typeof controllerName}'.`);
            return null;
        }

        const trimmedName = controllerName.trim();

        const safeNameRegex = /^[A-Za-z0-9_-]+$/;

        if (!safeNameRegex.test(trimmedName)) {
            console.error(`Aspis [ControllerRegistry]: Sicherheitsfehler - Ungültiger Name '${trimmedName}'.`);
            return null;
        }

        if (this.#cache.has(trimmedName)) {
            return this.#cache.get(trimmedName);
        }

        try {
            const module = await import(`../controllers/${trimmedName}.js`);
            const ControllerClass = module.default || module[trimmedName];

            if (!ControllerClass) {
                console.error(`Aspis [ControllerRegistry]: Klasse '${trimmedName}' konnte im Modul nicht gefunden werden.`);
                return null;
            }

            this.#cache.set(trimmedName, ControllerClass);
            return ControllerClass;

        } catch (error) {
            console.error(`Aspis [ControllerRegistry]: Fehler beim dynamischen Laden von '${trimmedName}':`, error);
            return null;
        }
    }
}