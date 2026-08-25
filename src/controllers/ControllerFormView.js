/** @typedef {import("../types/controllers.js").FormHost} FormHost */
import { SchemaService } from "../services/SchemaService.js";
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
}
export {
  ControllerFormView
};
