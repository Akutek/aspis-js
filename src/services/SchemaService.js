/** @typedef {import("../types/schema.js").AccordionItemView} AccordionItemView */
/** @typedef {import("../types/schema.js").AccordionView} AccordionView */
/** @typedef {import("../types/schema.js").AnySchemaView} AnySchemaView */
/** @typedef {import("../types/schema.js").DropdownView} DropdownView */
/** @typedef {import("../types/schema.js").FormView} FormView */
/** @typedef {import("../types/schema.js").FormFieldView} FormFieldView */
/** @typedef {import("../types/schema.js").LoaderView} LoaderView */
/** @typedef {import("../types/schema.js").ModalView} ModalView */
/** @typedef {import("../types/schema.js").TableView} TableView */
import { GuardDOM } from "../utils/GuardDOM.js";
import { ValidationService } from "./ValidationService.js";
import { FormFieldService } from "./FormFieldService.js";
import { SchemaCatalog } from "./schema/SchemaCatalog.js";
function asRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : null;
}
function asList(value, keys) {
  if (Array.isArray(value)) {
    return value;
  }
  const rec = asRecord(value);
  if (!rec) {
    return [];
  }
  for (const key of keys) {
    if (Array.isArray(rec[key])) {
      return rec[key];
    }
  }
  return [];
}
class SchemaService {
  static schema(kind) {
    return SchemaCatalog.get(kind);
  }
  static toRenderData(view) {
    if (!view || typeof view !== "object") {
      return {};
    }
    if (view.kind === "form") {
      const fields = {};
      const source = view.fields || {};
      Object.keys(source).forEach((name) => {
        const field = source[name];
        fields[name] = {
          value: field.value,
          error: field.error,
          isTouched: field.isTouched,
          isDirty: field.isDirty,
          isInvalid: Boolean(field.error && field.isTouched)
        };
      });
      return {
        layout: view.layout,
        fields,
        isSubmitting: view.isSubmitting,
        submitError: view.submitError,
        submitSuccess: view.submitSuccess,
        isValid: this.formIsValid(view)
      };
    }
    if (view.kind === "modal") {
      return {
        layout: view.layout,
        isOpen: view.isOpen,
        title: view.title,
        message: view.message,
        contentKind: view.contentKind,
        variant: view.variant,
        progress: view.progress,
        ariaHidden: view.isOpen ? "false" : "true"
      };
    }
    if (view.kind === "accordion") {
      return {
        layout: view.layout,
        singleOpen: view.singleOpen,
        items: Array.isArray(view.items) ? view.items : []
      };
    }
    if (view.kind === "table") {
      return {
        layout: view.layout,
        rows: Array.isArray(view.rows) ? view.rows : []
      };
    }
    if (view.kind === "dropdown") {
      const selected = view.options && view.options[view.selectedIndex];
      return {
        layout: view.layout,
        isOpen: view.isOpen,
        value: view.value,
        selectedLabel: selected ? selected.label : view.placeholder,
        error: view.error,
        isInvalid: Boolean(view.error),
        options: (view.options || []).map((option, index) => ({
          ...option,
          isSelected: index === view.selectedIndex,
          isFocused: index === view.focusedIndex
        }))
      };
    }
    return { ...view };
  }
  static isLoader(view) {
    return Boolean(view && view.kind === "loader");
  }
  static isForm(view) {
    return Boolean(view && view.kind === "form");
  }
  static isAccordion(view) {
    return Boolean(view && view.kind === "accordion");
  }
  static isDropdown(view) {
    return Boolean(view && view.kind === "dropdown");
  }
  static isModal(view) {
    return Boolean(view && view.kind === "modal");
  }
  static loader(options = {}) {
    const variant = options.variant === "bar" ? "bar" : "spinner";
    const layout = typeof options.layout === "string" ? options.layout : variant === "bar" ? "bar" : "spinner";
    return {
      kind: "loader",
      layout,
      message: this.#text(options.message || (variant === "bar" ? "Lade..." : "Lade Daten...")),
      progress: variant === "bar" ? this.#progress(options.progress) : null
    };
  }
  static modal(options = {}) {
    const variant = options.variant === "bar" ? "bar" : String(options.variant || "spinner");
    return {
      kind: "modal",
      layout: String(options.layout || SchemaCatalog.defaults("modal").layout),
      isOpen: Boolean(options.isOpen),
      title: this.#text(options.title || ""),
      message: this.#text(options.message || ""),
      contentKind: String(options.contentKind || SchemaCatalog.defaults("modal").contentKind),
      variant,
      progress: variant === "bar" ? this.#progress(options.progress) : null,
      closeOnBackdrop: options.closeOnBackdrop !== false
    };
  }
  static setModalOpen(view, isOpen) {
    if (!view || view.kind !== "modal") {
      return view;
    }
    view.isOpen = Boolean(isOpen);
    return view;
  }
  static table(raw, options = {}) {
    const list = asList(raw, ["rows", "data"]);
    const rows = [];
    for (let i = 0; i < list.length; i += 1) {
      const row = list[i];
      if (row && typeof row === "object") {
        rows.push(this.#clean(row));
      }
    }
    return {
      kind: "table",
      layout: String(options.layout || SchemaCatalog.defaults("table").layout),
      rows
    };
  }
  static form(initialFields = {}, options = {}) {
    const fields = {};
    const source = asRecord(initialFields) || {};
    const names = Object.keys(source);
    for (let i = 0; i < names.length; i += 1) {
      const name = names[i];
      const config = asRecord(source[name]) || {};
      const value = this.#clean(config.value ?? "");
      fields[name] = {
        value,
        initialValue: value,
        error: null,
        isTouched: false,
        isDirty: false,
        rules: asRecord(config.rules) || {}
      };
    }
    return {
      kind: "form",
      layout: String(options.layout || SchemaCatalog.defaults("form").layout),
      fields,
      isSubmitting: false,
      submitError: null,
      submitSuccess: false
    };
  }
  static formFromElement(container, options = {}) {
    const initialFields = {};
    if (container && typeof container.querySelectorAll === "function") {
      const nodes = container.querySelectorAll("input, select, textarea, [data-name]");
      nodes.forEach((element) => {
        const name = FormFieldService.getFieldName(element);
        if (!name || initialFields[name]) {
          return;
        }
        initialFields[name] = {
          value: FormFieldService.getValue(element),
          rules: FormFieldService.rulesFromElement(element)
        };
      });
    }
    return this.form(initialFields, options);
  }
  static setField(view, name, rawValue, markTouched = true) {
    if (!view || view.kind !== "form") {
      return view;
    }
    const field = view.fields[name];
    if (!field) {
      return view;
    }
    const value = this.#clean(rawValue ?? "");
    field.value = value;
    field.isDirty = field.value !== field.initialValue;
    if (markTouched) {
      field.isTouched = true;
    }
    field.error = ValidationService.validateField(field.value, field.rules);
    return view;
  }
  static field(view, name) {
    return view && view.kind === "form" ? view.fields[name] || null : null;
  }
  static formErrors(view) {
    const errors = {};
    const fields = view && view.kind === "form" ? view.fields : {};
    Object.keys(fields).forEach((name) => {
      if (fields[name].error) {
        errors[name] = fields[name].error;
      }
    });
    return errors;
  }
  static formIsValid(view) {
    if (!this.isForm(view)) {
      return true;
    }
    const fields = view.fields || {};
    return Object.keys(fields).every((name) => !fields[name].error);
  }
  static validateForm(view) {
    if (!this.isForm(view)) {
      return true;
    }
    const fields = view.fields || {};
    Object.keys(fields).forEach((name) => {
      const field = fields[name];
      field.isTouched = true;
      field.error = ValidationService.validateField(field.value, field.rules);
    });
    return this.formIsValid(view);
  }
  static formPayload(view) {
    const payload = {};
    const fields = view && view.kind === "form" ? view.fields : {};
    Object.keys(fields).forEach((name) => {
      payload[name] = fields[name].value;
    });
    return payload;
  }
  static setSubmitting(view, state) {
    if (!this.isForm(view)) {
      return view;
    }
    view.isSubmitting = Boolean(state);
    if (state) {
      view.submitError = null;
      view.submitSuccess = false;
    }
    return view;
  }
  static setSubmitResult(view, success, errorMessage = null) {
    if (!this.isForm(view)) {
      return view;
    }
    view.isSubmitting = false;
    view.submitSuccess = Boolean(success);
    view.submitError = errorMessage;
    return view;
  }
  static resetForm(view) {
    if (!this.isForm(view) || !view.fields) {
      return view;
    }
    Object.keys(view.fields).forEach((name) => {
      const field = view.fields[name];
      field.value = field.initialValue;
      field.error = null;
      field.isTouched = false;
      field.isDirty = false;
    });
    view.submitError = null;
    view.submitSuccess = false;
    return view;
  }
  static accordion(raw, options = {}) {
    const rec = asRecord(raw);
    const list = Array.isArray(raw) ? raw : Array.isArray(rec?.items) ? rec.items : Array.isArray(rec?.data) ? rec.data : [];
    const items = [];
    for (let i = 0; i < list.length; i += 1) {
      const entry = list[i];
      if (!entry || typeof entry !== "object") {
        continue;
      }
      const clean = asRecord(this.#clean(entry)) || {};
      const source = asRecord(entry) || {};
      items.push({
        ...clean,
        id: String(clean.id || `acc-item-${i}`),
        title: String(clean.title || clean.dataPlayername || ""),
        content: String(clean.content || ""),
        isOpen: Boolean(source.isOpen),
        disabled: Boolean(source.disabled)
      });
    }
    return {
      kind: "accordion",
      layout: String(options.layout || SchemaCatalog.defaults("accordion").layout),
      singleOpen: Boolean(options.singleOpen),
      items
    };
  }
  static toggleAccordionItem(view, itemId) {
    const item = this.accordionItem(view, itemId);
    if (!item || item.disabled || !this.isAccordion(view)) {
      return null;
    }
    const next = !item.isOpen;
    if (view.singleOpen && next) {
      view.items.forEach((entry) => {
        if (entry.id !== itemId) {
          entry.isOpen = false;
        }
      });
    }
    item.isOpen = next;
    return item;
  }
  static accordionItem(view, itemId) {
    if (!this.isAccordion(view) || !Array.isArray(view.items)) {
      return null;
    }
    return view.items.find((item) => item.id === itemId) || null;
  }
  static dropdown(raw, options = {}) {
    const view = {
      kind: "dropdown",
      layout: String(options.layout || SchemaCatalog.defaults("dropdown").layout),
      isOpen: false,
      value: this.#text(options.value || ""),
      error: null,
      isTouched: false,
      focusedIndex: 0,
      selectedIndex: -1,
      placeholder: this.#text(options.placeholder || SchemaCatalog.defaults("dropdown").placeholder),
      rules: asRecord(options.rules) || {},
      options: []
    };
    this.setDropdownOptions(view, raw);
    if (options.value !== void 0) {
      this.selectDropdownValue(view, options.value, false);
    }
    return view;
  }
  static setDropdownOptions(view, raw) {
    if (!this.isDropdown(view)) {
      return view;
    }
    const rec = asRecord(raw);
    const list = Array.isArray(raw) ? raw : Array.isArray(rec?.options) ? rec.options : Array.isArray(rec?.data) ? rec.data : [];
    view.options = list.map((entry) => {
      const bag = asRecord(entry);
      if (!bag) {
        return { value: "", label: "", disabled: false };
      }
      const value = this.#text(bag.value ?? bag.id ?? "");
      const label = this.#text(bag.label ?? bag.title ?? value);
      return { value, label, disabled: Boolean(bag.disabled) };
    });
    view.selectedIndex = view.options.findIndex((option) => option.value === view.value);
    view.focusedIndex = view.selectedIndex >= 0 ? view.selectedIndex : 0;
    return view;
  }
  static setDropdownOpen(view, open) {
    if (!this.isDropdown(view)) {
      return view;
    }
    view.isOpen = Boolean(open);
    if (view.isOpen) {
      view.focusedIndex = view.selectedIndex >= 0 ? view.selectedIndex : 0;
    }
    return view;
  }
  static selectDropdownValue(view, val, triggerValidation = true) {
    if (!this.isDropdown(view)) {
      return false;
    }
    const sanitized = this.#text(val);
    const index = view.options.findIndex((option) => option.value === sanitized && !option.disabled);
    if (index === -1 && sanitized !== "") {
      return false;
    }
    view.selectedIndex = index;
    view.focusedIndex = index >= 0 ? index : 0;
    view.value = index >= 0 ? view.options[index].value : "";
    view.isTouched = true;
    if (triggerValidation) {
      this.validateDropdown(view);
    }
    return true;
  }
  static moveDropdownFocus(view, direction) {
    if (!this.isDropdown(view) || !view.options.length) {
      return;
    }
    let next = view.focusedIndex + direction;
    while (next >= 0 && next < view.options.length && view.options[next].disabled) {
      next += direction;
    }
    if (next >= 0 && next < view.options.length) {
      view.focusedIndex = next;
    }
  }
  static selectDropdownFocused(view) {
    if (!this.isDropdown(view)) {
      return false;
    }
    const option = view.options[view.focusedIndex];
    if (option && !option.disabled) {
      return this.selectDropdownValue(view, option.value);
    }
    return false;
  }
  static validateDropdown(view) {
    if (!this.isDropdown(view)) {
      return true;
    }
    view.error = ValidationService.validateField(view.value, view.rules || {});
    return !view.error;
  }
  static selectedDropdownOption(view) {
    if (!this.isDropdown(view) || view.selectedIndex < 0) {
      return null;
    }
    return view.options[view.selectedIndex] || null;
  }
  static #clean(data) {
    if (typeof data === "string") {
      return GuardDOM.clean(data);
    }
    if (Array.isArray(data)) {
      return data.map((item) => this.#clean(item));
    }
    const rec = asRecord(data);
    if (rec && !(data instanceof Node)) {
      const next = {};
      Object.keys(rec).forEach((key) => {
        next[key] = this.#clean(rec[key]);
      });
      return next;
    }
    return data;
  }
  static #text(value) {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      return String(GuardDOM.clean(value));
    }
    return String(GuardDOM.clean(value == null ? "" : String(value)));
  }
  static #progress(percent) {
    const value = Number(percent);
    if (Number.isNaN(value)) {
      return 0;
    }
    return Math.min(100, Math.max(0, value));
  }
}
export {
  SchemaService
};
