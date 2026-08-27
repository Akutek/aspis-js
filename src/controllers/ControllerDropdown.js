/** @typedef {import("../types/controllers.js").ControllerOptions} ControllerOptions */
/** @typedef {import("../types/controllers.js").DropdownHost} DropdownHost */
/** @typedef {import("../types/controllers.js").LoaderLike} LoaderLike */
/** @typedef {import("../types/schema.js").DropdownOptionView} DropdownOptionView */
/** @typedef {import("../types/schema.js").DropdownView} DropdownView */
import { SchemaService } from "../services/SchemaService.js";
import { FormFieldService } from "../services/FormFieldService.js";
import { ControllerModifierDOM } from "../utils/ControllerModifierDOM.js";
import { errorMessage, errorName } from "./BaseController.js";

function csrfFromHost(host) {
  const fromHost = host instanceof HTMLElement ? host.dataset.csrf || "" : "";
  if (fromHost) {
    return fromHost;
  }
  if (typeof document === "undefined") {
    return "";
  }
  return document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") || "";
}

function isSafeNext(next) {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//");
}

/**
 * @param {string} url
 * @param {Record<string, unknown>} payload
 * @param {Record<string, string>} headers
 * @param {AbortSignal} signal
 */
async function jsonPost(url, payload, headers, signal) {
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    signal
  });
  const text = await res.text();
  let parsed = null;
  if (text !== "") {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
  }
  if (parsed && typeof parsed === "object" && parsed.ok === false) {
    const fail = typeof parsed.error === "string" && parsed.error !== ""
      ? parsed.error
      : "Aktion fehlgeschlagen.";
    throw new Error(fail);
  }
  if (!res.ok) {
    const fail = parsed && typeof parsed.error === "string" && parsed.error !== ""
      ? parsed.error
      : `HTTP Fehler ${res.status}`;
    throw new Error(fail);
  }
  return parsed;
}
/** @extends {DropdownHost} */
class ControllerDropdown {
  prepare(options = {}) {
    this._kind = "ControllerDropdown";
    if (!this._sliceKey) {
      this._sliceKey = options.sliceKey || "features.dropdownFeature";
    }
    if (this.isRowActionHost()) {
      this._sliceKey = "";
    }
    this._view = null;
    this._clickOutsideUnsub = null;
  }
  async onReady() {
    if (!this._container) {
      return;
    }
    const initialVal = this._container.dataset.value || "";
    let rules = {};
    if (this._container.dataset.rules) {
      try {
        const parsed = JSON.parse(this._container.dataset.rules);
        rules = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
      } catch (error) {
        this._warn("onReady", "Ung\xFCltiges JSON in data-rules", error);
      }
    }
    const layout = this._layout || this._container.dataset.layout || "default";
    const placeholder = this._container.dataset.placeholder || "";
    this._view = SchemaService.dropdown([], {
      layout,
      value: initialVal,
      rules,
      placeholder
    });
    this.scanDomOptions();
    this.bindDropdownEvents();
    ControllerModifierDOM.attr(this._container, "aria-expanded", "false");
    const url = this._container.dataset.url;
    if (url) {
      await this.loadOptions(url);
    } else if (this.seedRowActionOptions()) {
      await this.renderDropdown();
    }
  }
  isRowActionHost() {
    const host = this._container;
    if (!(host instanceof HTMLElement)) {
      return false;
    }
    return Boolean(host.dataset.editUrl || host.dataset.deleteUrl);
  }
  seedRowActionOptions() {
    if (!this._container || !this._view || SchemaService.isLoader(this._view) || !this.isRowActionHost()) {
      return false;
    }
    const options = [];
    if (this._container.dataset.editUrl) {
      options.push({ value: "edit", label: "Bearbeiten" });
    }
    if (this._container.dataset.deleteUrl) {
      options.push({ value: "delete", label: "Entfernen" });
    }
    if (options.length === 0) {
      return false;
    }
    SchemaService.setDropdownOptions(this._view, options);
    return true;
  }
  resetRowActionSelection() {
    if (!this._container || !this._view || SchemaService.isLoader(this._view)) {
      return;
    }
    SchemaService.selectDropdownValue(this._view, "", false);
    const labelEl = this._container.querySelector('[data-target="label"]');
    if (labelEl) {
      labelEl.textContent = this._view.placeholder || "Optionen";
    }
  }
  async runRowAction(value) {
    const host = this._container;
    if (!(host instanceof HTMLElement) || !value) {
      return;
    }
    if (value === "edit") {
      const url = host.dataset.editUrl || "";
      if (url) {
        window.location.assign(url);
      }
      return;
    }
    if (value !== "delete") {
      return;
    }
    const url = host.dataset.deleteUrl || "";
    if (!url) {
      return;
    }
    const token = csrfFromHost(host);
    const payload = { _csrf: token };
    const headers = {
      Accept: "application/json",
      "Content-Type": "application/json"
    };
    if (token) {
      headers["X-CSRF-Token"] = token;
    }
    const signal = this.getSignal("rowAction");
    try {
      let response = null;
      if (typeof this.fetcher?.post === "function") {
        response = await this.fetcher.post(url, payload, { headers, signal });
      } else {
        response = await jsonPost(url, payload, headers, signal);
      }
      if (signal.aborted || this.signal.aborted) {
        return;
      }
      if (response && isSafeNext(response.next)) {
        window.location.assign(response.next);
      }
    } catch (error) {
      if (errorName(error) !== "AbortError" && !signal.aborted && !this.signal.aborted) {
        this._capture("runRowAction", error);
        this._warn("runRowAction", errorMessage(error) || "Aktion fehlgeschlagen.");
      }
    } finally {
      this.clearTask("rowAction");
    }
  }
  scanDomOptions() {
    if (!this._container || !this._view || SchemaService.isLoader(this._view)) {
      return;
    }
    const nodes = this._container.querySelectorAll("[data-option-value]");
    if (nodes.length === 0) {
      return;
    }
    const options = [];
    nodes.forEach((el) => {
      if (!(el instanceof HTMLElement)) {
        return;
      }
      options.push({
        value: el.dataset.optionValue || "",
        label: (el.textContent || "").trim(),
        disabled: el.hasAttribute("data-disabled")
      });
    });
    SchemaService.setDropdownOptions(this._view, options);
    const selected = SchemaService.selectedDropdownOption(this._view);
    const labelEl = this._container.querySelector('[data-target="label"]');
    if (labelEl && selected && typeof selected.label === "string") {
      labelEl.textContent = selected.label;
    }
    this.syncWithNativeInput();
    const listEl = this._container.querySelector('[data-target="list"]');
    if (listEl) {
      ControllerModifierDOM.hide(listEl);
    }
  }
  onStateChange(slice) {
    if (this.isRowActionHost()) {
      return;
    }
    if (slice?.view && this._view !== slice.view) {
      this._view = slice.view;
      void this.renderDropdown();
    }
  }
  async loadOptions(url) {
    const useStore = Boolean(this._sliceKey) && !this.isRowActionHost();
    const slice = useStore ? this._store?.getSlice(this._sliceKey || "") : null;
    const stateProxy = slice && typeof slice === "object" ? slice : null;
    try {
      if (stateProxy) {
        this.setLoadingState(stateProxy, "Optionen laden...");
      }
      const data = this.fetcher.get ? await this.fetcher.get(url, {}, { signal: this.getSignal("loadOptions") }) : null;
      if (this.signal.aborted) {
        return;
      }
      if (data && this._view) {
        SchemaService.setDropdownOptions(this._view, data);
        if (stateProxy) {
          stateProxy.view = this._view;
        }
        await this.renderDropdown();
      }
    } catch (error) {
      if (errorName(error) !== "AbortError" && !this.signal.aborted) {
        this._capture("loadOptions", error);
      }
    } finally {
      if (stateProxy && !this.signal.aborted) {
        stateProxy.isLoading = false;
      }
      this.clearTask("loadOptions");
    }
  }
  bindDropdownEvents() {
    if (!this._container) {
      return;
    }
    ControllerModifierDOM.attr(this._container, "tabindex", "0");
    ControllerModifierDOM.attr(this._container, "role", "combobox");
    this.delegate("click", '[data-target="trigger"]', () => {
      this.toggle();
    });
    this.delegate("click", "[data-option-value]", (_e, target) => {
      if (!target.hasAttribute("data-disabled")) {
        this.selectValue(target.dataset.optionValue);
      }
    });
    this.delegate("keydown", ":scope", (event) => {
      this.handleDropdownKeyDown(event);
    });
  }
  handleDropdownKeyDown(event) {
    if (!this._view || SchemaService.isLoader(this._view)) {
      return;
    }
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (!this._view.isOpen) {
          this.open();
        } else {
          SchemaService.moveDropdownFocus(this._view, 1);
          this.updateFocusUI();
        }
        break;
      case "ArrowUp":
        event.preventDefault();
        if (!this._view.isOpen) {
          this.open();
        } else {
          SchemaService.moveDropdownFocus(this._view, -1);
          this.updateFocusUI();
        }
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        if (!this._view.isOpen) {
          this.open();
        } else if (SchemaService.selectDropdownFocused(this._view)) {
          this.selectValue(this._view.value);
        }
        break;
      case "Escape":
        if (this._view.isOpen) {
          event.preventDefault();
          this.close();
        }
        break;
      default:
        break;
    }
  }
  toggle() {
    if (!this._view || SchemaService.isLoader(this._view)) {
      return;
    }
    if (this._view.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }
  open() {
    if (!this._container || !this._view || SchemaService.isLoader(this._view) || this._view.isOpen) {
      return;
    }
    SchemaService.setDropdownOpen(this._view, true);
    const listEl = this._container.querySelector('[data-target="list"]');
    if (listEl) {
      ControllerModifierDOM.show(listEl);
    }
    ControllerModifierDOM.addClass(this._container, "is-open");
    ControllerModifierDOM.attr(this._container, "aria-expanded", "true");
    this.updateFocusUI();
    if (this._dispatcher && typeof this._dispatcher.onClickOutside === "function") {
      this._clickOutsideUnsub = this._dispatcher.onClickOutside(this._container, () => this.close());
    }
  }
  close() {
    if (!this._container || !this._view || SchemaService.isLoader(this._view) || !this._view.isOpen) {
      return;
    }
    SchemaService.setDropdownOpen(this._view, false);
    const listEl = this._container.querySelector('[data-target="list"]');
    if (listEl) {
      ControllerModifierDOM.hide(listEl);
    }
    ControllerModifierDOM.removeClass(this._container, "is-open");
    ControllerModifierDOM.attr(this._container, "aria-expanded", "false");
    if (this._clickOutsideUnsub) {
      this._clickOutsideUnsub();
      this._clickOutsideUnsub = null;
    }
    this.validateUI();
  }
  selectValue(value) {
    if (!this._container || !this._view || SchemaService.isLoader(this._view)) {
      return;
    }
    if (this.isRowActionHost()) {
      const action = String(value ?? "");
      this.close();
      this.resetRowActionSelection();
      void this.runRowAction(action);
      return;
    }
    const changed = SchemaService.selectDropdownValue(this._view, value);
    if (changed) {
      this.syncWithNativeInput();
      const fieldName = FormFieldService.getFieldName(this._container);
      const selectedItem = SchemaService.selectedDropdownOption(this._view);
      const itemLabel = selectedItem && typeof selectedItem.label === "string" ? selectedItem.label : "";
      this._dispatcher?.emit?.("dropdown:change", {
        name: fieldName,
        value: this._view.value,
        label: itemLabel,
        container: this._container
      });
      const labelEl = this._container.querySelector('[data-target="label"]');
      if (labelEl && selectedItem) {
        labelEl.textContent = itemLabel;
      }
    }
    this.close();
    this.validateUI();
  }
  validateUI() {
    if (!this._container || !this._view || SchemaService.isLoader(this._view)) {
      return;
    }
    const isValid = SchemaService.validateDropdown(this._view);
    ControllerModifierDOM.toggleClass(this._container, "is-invalid", !isValid);
    ControllerModifierDOM.toggleClass(this._container, "is-valid", isValid && this._view.value !== "");
    const errorEl = this._container.querySelector('[data-target="error"]');
    if (errorEl) {
      errorEl.textContent = this._view.error || "";
      ControllerModifierDOM.toggleClass(errorEl, "is-hidden", isValid);
    }
  }
  updateFocusUI() {
    const view = this._view;
    if (!this._container || !view || SchemaService.isLoader(view)) {
      return;
    }
    const optionEls = this._container.querySelectorAll("[data-option-value]");
    optionEls.forEach((el, idx) => {
      const isFocused = idx === view.focusedIndex;
      ControllerModifierDOM.toggleClass(el, "is-focused", isFocused);
      if (isFocused && el instanceof HTMLElement) {
        el.scrollIntoView({ block: "nearest" });
      }
    });
  }
  syncWithNativeInput() {
    if (!this._container || !this._view || SchemaService.isLoader(this._view)) {
      return;
    }
    const fieldName = FormFieldService.getFieldName(this._container);
    if (!fieldName) {
      return;
    }
    const escapedName = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(fieldName) : fieldName;
    let hiddenInput = this._container.querySelector(`input[name="${escapedName}"]`);
    if (!(hiddenInput instanceof HTMLInputElement)) {
      hiddenInput = document.createElement("input");
      hiddenInput.type = "hidden";
      hiddenInput.name = fieldName;
      this._container.appendChild(hiddenInput);
    }
    hiddenInput.value = this._view.value;
  }
  async renderDropdown() {
    if (!this._view || this.signal.aborted || !this._container) {
      return;
    }
    try {
      let templateName = this._container.dataset.template || "dropdown";
      if (SchemaService.isLoader(this._view)) {
        templateName = this._container.dataset.loaderTemplate || "loader-spinner";
      }
      const renderService = this.renderService;
      if (renderService && typeof renderService.paste === "function") {
        await renderService.paste(this._container, templateName, SchemaService.toRenderData(this._view));
      } else {
        this._warn("renderDropdown", "TemplateRenderService fehlt.");
      }
      const listEl = this._container.querySelector('[data-target="list"]');
      if (listEl && this._view && !SchemaService.isLoader(this._view) && !this._view.isOpen) {
        ControllerModifierDOM.hide(listEl);
      }
    } catch (error) {
      if (!this.signal.aborted) {
        this._capture("renderDropdown", error);
      }
    }
  }
  onDestroy() {
    if (this._clickOutsideUnsub) {
      this._clickOutsideUnsub();
      this._clickOutsideUnsub = null;
    }
  }
}
export {
  ControllerDropdown
};
