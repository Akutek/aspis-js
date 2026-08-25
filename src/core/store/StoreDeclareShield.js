/** @typedef {import("../../types/store.js").StoreSetContext} StoreSetContext */
import { DebugAgent } from "../../agents/DebugAgent.js";
class StoreDeclareShield {
  /** Pipeline-Schritt: unbekannte Keys ablehnen, sonst `next`. */
  static handle(context, next) {
    const { store, obj, prop, path } = context;
    if (!(prop in obj) && !store.isPathDeclared(path)) {
      const errorMsg = `Aspis [Store-Schutzschild]: Mutation abgelehnt! Der State-Parameter "${path}" wurde nicht im state-manifest.json deklariert.`;
      if (store.strictMode) {
        throw new Error(errorMsg);
      }
      DebugAgent.error(`[StoreDeclareShield.handle()] ${errorMsg}`);
      return true;
    }
    return next(context);
  }
}
export {
  StoreDeclareShield
};
