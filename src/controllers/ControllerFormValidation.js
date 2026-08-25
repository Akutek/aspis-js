/** @typedef {import("../types/controllers.js").FormHost} FormHost */
import { SchemaService } from "../services/SchemaService.js";
import { ControllerModifierDOM } from "../utils/ControllerModifierDOM.js";
/** @extends {FormHost} */
class ControllerFormValidation {
  updateFieldUI(name) {
    if (!this._view || !this._container) {
      return;
    }
    const field = SchemaService.field(this._view, name);
    if (!field) {
      return;
    }
    const escapedName = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(name) : name;
    const fieldEl = this._container.querySelector(`[name="${escapedName}"], [data-name="${escapedName}"]`);
    if (!fieldEl) {
      return;
    }
    const wrapper = fieldEl.closest(".form-group") || fieldEl.parentElement;
    const hasError = Boolean(field.error && field.isTouched);
    ControllerModifierDOM.toggleClass(wrapper, "has-error", hasError);
    ControllerModifierDOM.toggleClass(fieldEl, "is-invalid", hasError);
    ControllerModifierDOM.attr(fieldEl, "aria-invalid", hasError);
    const errorEl = wrapper?.querySelector('[data-target="field-error"]') || wrapper?.querySelector(".error-message");
    if (errorEl) {
      errorEl.textContent = hasError ? field.error : "";
      ControllerModifierDOM.toggleClass(errorEl, "is-hidden", !hasError);
    }
  }
}
export {
  ControllerFormValidation
};
