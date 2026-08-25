/** @typedef {import("../types/utils.js").CacheMiddleware} CacheMiddleware */
class CachePipelineHelper {
  /** Erstellt eine ausführbare Pipeline aus einer Liste von Middleware-Funktionen und einer Kernoperation. */
  static create(middlewares = [], coreOperation) {
    return function runPipeline(initialContext) {
      const validMiddlewares = Array.isArray(middlewares) ? middlewares.filter((m) => typeof m === "function") : [];
      const dispatch = (index, currentContext) => {
        if (index >= validMiddlewares.length) {
          return typeof coreOperation === "function" ? coreOperation(currentContext) : currentContext;
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
export {
  CachePipelineHelper
};
