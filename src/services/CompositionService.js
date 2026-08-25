/** @typedef {import("../types/services.js").AnyConstructor} AnyConstructor */
class CompositionService {
  static compose(Base, parts = []) {
    if (typeof Base !== "function") {
      return null;
    }
    const list = Array.isArray(parts) ? parts.filter((part) => Boolean(part && typeof part === "object")) : [];
    if (list.length === 0) {
      return Base;
    }
    class Composed extends Base {
    }
    for (let i = 0; i < list.length; i += 1) {
      const part = list[i];
      const keys = Object.keys(part);
      for (let k = 0; k < keys.length; k += 1) {
        const key = keys[k];
        const fn = part[key];
        if (typeof fn !== "function") {
          continue;
        }
        Object.defineProperty(Composed.prototype, key, {
          configurable: true,
          writable: true,
          value(...args) {
            return fn.apply(this, args);
          }
        });
      }
    }
    return Composed;
  }
}
export {
  CompositionService
};
