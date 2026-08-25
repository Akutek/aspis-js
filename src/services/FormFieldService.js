/** @typedef {import("../types/services.js").FieldRules} FieldRules */
/** @typedef {import("../types/services.js").FieldState} FieldState */
/** @typedef {import("../types/services.js").FormFieldValue} FormFieldValue */
class FormFieldService {
  static getFieldName(element) {
    if (!(element instanceof HTMLElement)) return null;
    const named = /** @type {any} */ (element);
    return named.name || element.dataset.name || element.id || null;
  }
  static getValue(element) {
    if (!(element instanceof HTMLElement)) return null;
    if (element.dataset.value !== void 0) {
      return element.dataset.value;
    }
    if (element instanceof HTMLInputElement) {
      if (element.type === "checkbox") return element.checked;
      if (element.type === "radio") {
        const form = element.form || element.closest("form");
        if (form && element.name) {
          const checked = form.querySelector(`input[name="${CSS.escape(element.name)}"]:checked`);
          return checked instanceof HTMLInputElement ? checked.value : "";
        }
        return element.checked ? element.value : "";
      }
      return element.value ?? "";
    }
    if (element instanceof HTMLSelectElement) {
      if (element.multiple) {
        return Array.from(element.selectedOptions).map((opt) => opt.value);
      }
      return element.value ?? "";
    }
    if (element instanceof HTMLTextAreaElement) {
      return element.value ?? "";
    }
    return "";
  }
  static createFieldState(initialValue = "", rules = {}) {
    return {
      value: initialValue,
      rules,
      error: null,
      isTouched: false,
      isDirty: false
    };
  }
  static rulesFromElement(element) {
    const rules = {};
    if (!(element instanceof HTMLElement)) {
      return rules;
    }
    if (element.dataset.rules) {
      try {
        Object.assign(rules, JSON.parse(element.dataset.rules));
      } catch {
        return rules;
      }
    }
    if (element.hasAttribute("required") && !rules.required) {
      rules.required = "Dieses Feld ist ein Pflichtfeld.";
    }
    if (element instanceof HTMLInputElement && element.type === "email" && !rules.email) {
      rules.email = "Bitte eine g\xFCltige E-Mail-Adresse eingeben.";
    }
    if (element.hasAttribute("minlength") && !rules.minLength) {
      const length = parseInt(element.getAttribute("minlength") || "0", 10);
      rules.minLength = {
        param: length,
        message: `Mindestens ${length} Zeichen erforderlich.`
      };
    }
    return rules;
  }
}
export {
  FormFieldService
};
