function isDomElement(value) {
  if (!value || typeof value !== "object") {
    return false;
  }
  if (typeof Element !== "undefined") {
    return value instanceof Element;
  }
  if (typeof HTMLElement !== "undefined") {
    return value instanceof HTMLElement;
  }
  return "nodeType" in value && value.nodeType === 1;
}
class ControllerModifierDOM {
  static #isValid(target) {
    return isDomElement(target);
  }
  static #normalize(target) {
    if (!target) return [];
    if (isDomElement(target)) return [target];
    if (typeof target[Symbol.iterator] === "function" && typeof target !== "string") {
      return Array.from(target);
    }
    return [];
  }
  /** Macht das oder die Ziel-Elemente sichtbar (entfernt das `hidden`-Attribut sowie die `is-hidden`-Klasse). */
  static show(target) {
    this.#normalize(target).forEach((el) => {
      if (!this.#isValid(el)) return;
      el.removeAttribute("hidden");
      el.classList.remove("is-hidden");
    });
  }
  /** Versteckt das oder die Ziel-Elemente (setzt das `hidden`-Attribut und fügt die `is-hidden`-Klasse hinzu). */
  static hide(target) {
    this.#normalize(target).forEach((el) => {
      if (!this.#isValid(el)) return;
      el.setAttribute("hidden", "");
      el.classList.add("is-hidden");
    });
  }
  /** Fügt eine oder mehrere Leerzeichen-getrennte CSS-Klassen zu den Ziel-Elementen hinzu. */
  static addClass(target, classNames) {
    if (!classNames || typeof classNames !== "string") return;
    const classes = classNames.split(/\s+/).filter(Boolean);
    if (classes.length === 0) return;
    this.#normalize(target).forEach((el) => {
      if (!this.#isValid(el)) return;
      el.classList.add(...classes);
    });
  }
  /** Entfernt eine oder mehrere Leerzeichen-getrennte CSS-Klassen von den Ziel-Elementen. */
  static removeClass(target, classNames) {
    if (!classNames || typeof classNames !== "string") return;
    const classes = classNames.split(/\s+/).filter(Boolean);
    if (classes.length === 0) return;
    this.#normalize(target).forEach((el) => {
      if (!this.#isValid(el)) return;
      el.classList.remove(...classes);
    });
  }
  /** Schaltet eine oder mehrere Leerzeichen-getrennte CSS-Klassen auf den Ziel-Elementen um. */
  static toggleClass(target, className, force) {
    if (!className || typeof className !== "string") return;
    const classes = className.split(/\s+/).filter(Boolean);
    this.#normalize(target).forEach((el) => {
      if (!this.#isValid(el)) return;
      classes.forEach((cls) => {
        if (force !== void 0) {
          el.classList.toggle(cls, !!force);
        } else {
          el.classList.toggle(cls);
        }
      });
    });
  }
  static toggleSliceClass(target, slice, styleKey, isActive) {
    if (!slice) return;
    const classMapping = slice?.config?.styles?.[styleKey] || slice?.styles?.[styleKey] || slice?.[styleKey] || styleKey;
    if (typeof classMapping === "string") {
      if (isActive) {
        this.addClass(target, classMapping);
      } else {
        this.removeClass(target, classMapping);
      }
    }
  }
  static attr(target, attrName, value) {
    if (!attrName || typeof attrName !== "string") return;
    this.#normalize(target).forEach((el) => {
      if (!this.#isValid(el)) return;
      if (value === null || value === void 0 || value === false) {
        el.removeAttribute(attrName);
      } else if (value === true) {
        el.setAttribute(attrName, attrName.startsWith("aria-") ? "true" : "");
      } else {
        el.setAttribute(attrName, String(value));
      }
    });
  }
}
export {
  ControllerModifierDOM
};
