/** @typedef {import("../types/controllers.js").ControllerOptions} ControllerOptions */
/** @typedef {import("../types/controllers.js").DropdownHost} DropdownHost */
/** @typedef {import("../types/controllers.js").LoaderLike} LoaderLike */
/** @typedef {import("../types/schema.js").DropdownOptionView} DropdownOptionView */
/** @typedef {import("../types/schema.js").DropdownView} DropdownView */
import { SchemaService } from "../services/SchemaService.js";
import { FormFieldService } from "../services/FormFieldService.js";
import { ControllerModifierDOM } from "../utils/ControllerModifierDOM.js";
import { errorName } from "./BaseController.js";
/** @extends {DropdownHost} */
class ControllerDropdown {
  prepare(options = {}) {
    this._kind = "ControllerDropdown";
    if (!this._sliceKey) {
      this._sliceKey = options.sliceKey || "features.dropdownFeature";
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
    this._view = SchemaService.dropdown([], {
      layout,
      value: initialVal,
      rules
    });
    this.scanDomOptions();
    this.bindDropdownEvents();
    ControllerModifierDOM.attr(this._container, "aria-expanded", "false");
    const url = this._container.dataset.url;
    if (url) {
      await this.loadOptions(url);
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
    const listEl = this._container.querySelector('[data-target="list"]');
    if (listEl) {
      ControllerModifierDOM.hide(listEl);
    }
  }
  onStateChange(slice) {
    if (slice?.view && this._view !== slice.view) {
      this._view = slice.view;
      void this.renderDropdown();
    }
  }
  async loadOptions(url) {
    const slice = this._store?.getSlice(this._sliceKey || "");
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
