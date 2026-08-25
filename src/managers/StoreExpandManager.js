/** @typedef {import("../types/managers.js").Registry} Registry */
/** @typedef {import("../types/managers.js").Store} Store */
import { RegistryManager } from "./RegistryManager.js";
import { StoreExtension } from "../extensions/store/StoreExtension.js";
class StoreExpandManager {
  static async expand(registry) {
    const store = RegistryManager.get(registry, "store");
    if (!store) {
      return;
    }
    await StoreExtension.expand(store);
  }
}
export {
  StoreExpandManager
};
