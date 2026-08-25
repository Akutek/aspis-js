class StorePipeline {
  static create(middlewares = [], coreOperation) {
    return function runPipeline(initialContext) {
      const validMiddlewares = Array.isArray(middlewares) ? middlewares.filter((m) => typeof m === "function") : [];
      const dispatch = (index, currentContext) => {
        if (index >= validMiddlewares.length) {
          return typeof coreOperation === "function" ? coreOperation(currentContext) : currentContext;
        }
        const middleware = validMiddlewares[index];
        const next = (updatedContext = currentContext) => dispatch(index + 1, updatedContext);
        return middleware(currentContext, next);
      };
      return dispatch(0, initialContext);
    };
  }
}
export {
  StorePipeline
};
