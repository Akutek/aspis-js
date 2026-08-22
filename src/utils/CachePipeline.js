/**
 * @file CachePipeline.js
 * @description Funktionale Middleware-Pipeline für den Cache des Aspis-Frameworks, komplett zustandslos implementiert.
 * @module Aspis/Core/CachePipeline
 */

/**
 * @callback CacheMiddleware
 * @param {any} context - Der aktuelle Daten- oder Operations-Kontext.
 * @param {Function} next - Die Funktion, um den nächsten Schritt aufzurufen.
 * @returns {any} Das Ergebnis der Verarbeitung.
 */

/**
 * @class CachePipeline
 * @classdesc Rein funktioneller Orchestrator für Middleware-Ketten ohne internen Zustand oder Klassenvariablen.
 */
export class CachePipeline {
    /**
     * Erstellt eine ausführbare Pipeline aus einer Liste von Middleware-Funktionen und einer Kernoperation.
     * 
     * @public
     * @static
     * @param {CacheMiddleware[]} middlewares - Array von Middleware-Funktionen.
     * @param {Function} coreOperation - Die auszuführende Kernoperation am Ende der Kette.
     * @returns {Function} Eine ausführbare Funktion, die den initialen Kontext entgegennimmt.
     */
    static create(middlewares = [], coreOperation) {
        return function runPipeline(initialContext) {
            const validMiddlewares = Array.isArray(middlewares) ? middlewares.filter(m => typeof m === 'function') : [];
            
            const dispatch = (index, currentContext) => {
                if (index >= validMiddlewares.length) {
                    return typeof coreOperation === 'function' ? coreOperation(currentContext) : currentContext;
                }

                const middleware = validMiddlewares[index];
                const next = (updatedContext = currentContext) => {
                    return dispatch(index + 1, updatedContext);
                };

                return middleware(currentContext, next);
            };

            return dispatch(0, initialContext);
        };
    }
}