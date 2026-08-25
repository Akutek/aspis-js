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
  showFormMessage(msg, type = "error") {
    if (!this._container) {
      return;
    }
    const msgEl = this._container.querySelector('[data-target="form-message"]');
    if (!msgEl) {
      return;
    }
    msgEl.textContent = msg;
    ControllerModifierDOM.removeClass(msgEl, "is-hidden success error");
    ControllerModifierDOM.addClass(msgEl, type);
  }
  hideFormMessage() {
    if (!this._container) {
      return;
    }
    const msgEl = this._container.querySelector('[data-target="form-message"]');
    if (msgEl) {
      ControllerModifierDOM.addClass(msgEl, "is-hidden");
    }
  }
}
export {
  ControllerFormValidation
};
