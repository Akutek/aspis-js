/** @typedef {import("../types/services.js").AnyConstructor} AnyConstructor */
class MixinService {
  static mix(Base, mixins = []) {
    if (typeof Base !== "function") {
      return null;
    }
    const list = Array.isArray(mixins) ? mixins.filter((mixin) => typeof mixin === "function") : [];
    if (list.length === 0) {
      return Base;
    }
    class Mixed extends Base {
    }
    for (let i = 0; i < list.length; i += 1) {
      this.#copy(list[i], Mixed);
    }
    return Mixed;
  }
  static #copy(source, target) {
    if (source.prototype) {
      const names = Object.getOwnPropertyNames(source.prototype);
      for (let i = 0; i < names.length; i += 1) {
        const name = names[i];
        if (name === "constructor") {
          continue;
        }
        const descriptor = Object.getOwnPropertyDescriptor(source.prototype, name);
        if (descriptor) {
          Object.defineProperty(target.prototype, name, descriptor);
        }
      }
    }
    const statics = Object.getOwnPropertyNames(source);
    for (let i = 0; i < statics.length; i += 1) {
      const name = statics[i];
      if (name === "prototype" || name === "length" || name === "name") {
        continue;
      }
      const descriptor = Object.getOwnPropertyDescriptor(source, name);
      if (descriptor) {
        Object.defineProperty(target, name, descriptor);
      }
    }
  }
}
export {
  MixinService
};
