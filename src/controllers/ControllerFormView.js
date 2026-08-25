/** @typedef {import("../types/controllers.js").FormHost} FormHost */
import { SchemaService } from "../services/SchemaService.js";
import { ControllerModifierDOM } from "../utils/ControllerModifierDOM.js";
/** @extends {FormHost} */
class ControllerFormView {
  buildFormView() {
    if (!this._container) {
      return;
    }
    this._view = SchemaService.formFromElement(this._container, {
      layout: this._layout || this._options?.layout
    });
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
  ControllerFormView
};
