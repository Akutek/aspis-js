/** @typedef {import("../types/utils.js").ObserverRegistry} ObserverRegistry */
/** @typedef {import("../types/utils.js").ObserverTarget} ObserverTarget */
class BaseObserver {
  #registry;
  #isObserving = false;
  #targets = /* @__PURE__ */ new Set();
  /** Wirft, wenn die abstrakte Klasse direkt instanziiert wird. */
  constructor(registry) {
    if (new.target === BaseObserver) {
      throw new TypeError("Aspis [BaseObserver]: Instanziierung der abstrakten Basisklasse ist nicht erlaubt.");
    }
    this.#registry = registry;
  }
  get registry() {
    return this.#registry;
  }
  get isObserving() {
    return this.#isObserving;
  }
  /** Liefert eine Kopie aller aktuell beobachteten DOM-Knoten als Array. */
  get targets() {
    return Array.from(this.#targets);
  }
  start(target) {
    this.#isObserving = true;
    if (target) {
      this.#targets.add(target);
    }
  }
  stop() {
    this.#isObserving = false;
    this.#targets.clear();
  }
  observe(target) {
    if (!(target instanceof Node)) return;
    this.#targets.add(target);
  }
  unobserve(target) {
    this.#targets.delete(target);
  }
  destroy() {
    this.stop();
    this.#registry = null;
  }
}
export {
  BaseObserver
};
