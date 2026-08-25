/** @typedef {import("../types/controllers.js").FormHost} FormHost */
import { FormFieldService } from "../services/FormFieldService.js";
import { SchemaService } from "../services/SchemaService.js";
/** @extends {FormHost} */
class ControllerFormFields {
  bindFormEvents() {
    const fieldSelector = "input, select, textarea, [data-name]";
    this.delegate("input", fieldSelector, (e) => this.handleFieldInput?.(e));
    this.delegate("change", fieldSelector, (e) => this.handleFieldChange?.(e));
    this.delegate("focusout", fieldSelector, (e) => this.handleFieldBlur?.(e));
    this.delegate("submit", "form, :scope", (e) => {
      e.preventDefault();
      if (typeof this.submit === "function") {
        void this.submit();
      }
    });
  }
  handleFieldInput(event) {
    const name = FormFieldService.getFieldName(event.target);
    if (!name || !this._view) {
      return;
    }
    const val = FormFieldService.getValue(event.target);
    if (this._validateOnChange) {
      this.updateField?.(name, val, true);
    } else {
      SchemaService.setField(this._view, name, val, false);
    }
  }
  handleFieldChange(event) {
    const name = FormFieldService.getFieldName(event.target);
    if (name && this._view) {
      this.updateField?.(name, FormFieldService.getValue(event.target), true);
    }
  }
  handleFieldBlur(event) {
    if (!this._validateOnBlur || !this._view) {
      return;
    }
    const name = FormFieldService.getFieldName(event.target);
    if (name) {
      this.updateField?.(name, FormFieldService.getValue(event.target), true);
    }
  }
  updateField(name, value, triggerValidation = true) {
    if (!this._view) {
      return;
    }
    SchemaService.setField(this._view, name, value, true);
    if (triggerValidation && typeof this.updateFieldUI === "function") {
      this.updateFieldUI(name);
    }
  }
}
export {
  ControllerFormFields
};
