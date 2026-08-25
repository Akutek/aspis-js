/** @typedef {import("../types/store.js").Store} Store */
class StoreDomDependencyScanner {
  static register(container, store) {
    if (!container || !store || typeof store.addDependency !== "function") return;
    const elements = [];
    if (container.dataset?.dependsOn) {
      elements.push(container);
    }
    const childElements = container.querySelectorAll("[data-depends-on]");
    childElements.forEach((child) => {
      if (child instanceof HTMLElement) {
        elements.push(child);
      }
    });
    elements.forEach((element) => {
      const rawAttr = element.dataset.dependsOn;
      if (!rawAttr) return;
      const paths = rawAttr.split(/[\s,]+/).map((p) => p.trim()).filter(Boolean);
      paths.forEach((path) => {
        store.addDependency(element, path);
      });
    });
  }
  static unregister(container, store) {
    if (!container || !store || typeof store.removeDomDependencies !== "function") return;
    store.removeDomDependencies(container);
    const childElements = container.querySelectorAll("[data-depends-on]");
    childElements.forEach((child) => {
      if (child instanceof HTMLElement) {
        store.removeDomDependencies(child);
      }
    });
  }
}
export {
  StoreDomDependencyScanner
};
