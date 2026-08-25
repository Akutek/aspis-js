/** @typedef {import("../../types/store.js").Store} Store */
/** @typedef {import("../../types/store.js").StoreSetContext} StoreSetContext */
import { StorePipeline } from "./StorePipeline.js";
class StoreProxy {
  static wrap(store, target, currentPath) {
    if (target === null || typeof target !== "object") {
      return target;
    }
    const proxyCache = store.runtime.proxyCache;
    const cached = proxyCache.get(target);
    if (cached) {
      return cached;
    }
    const proxy = new Proxy(target, {
      get(obj, prop) {
        if (typeof prop === "symbol") {
          return Reflect.get(obj, prop);
        }
        const value = obj[prop];
        const nextPath = currentPath ? `${currentPath}.${prop}` : prop;
        store.track(nextPath);
        if (value !== null && typeof value === "object") {
          return StoreProxy.wrap(store, value, nextPath);
        }
        return value;
      },
      set(obj, prop, value) {
        if (typeof prop === "symbol") {
          Reflect.set(obj, prop, value);
          return true;
        }
        const path = currentPath ? `${currentPath}.${prop}` : prop;
        const context = {
          store,
          obj,
          prop,
          value,
          oldValue: obj[prop],
          path
        };
        return Boolean(StorePipeline.create(
          store.runtime.setPipeline,
          (ctx) => {
            if (ctx.oldValue !== ctx.value) {
              ctx.obj[ctx.prop] = ctx.value;
              store.trigger(ctx.path, ctx.value);
              store.cascade(ctx.path);
            }
            return true;
          }
        )(context));
      }
    });
    proxyCache.set(target, proxy);
    return proxy;
  }
}
export {
  StoreProxy
};
