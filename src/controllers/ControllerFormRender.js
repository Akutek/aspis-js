/** @typedef {import("../types/controllers.js").FormHost} FormHost */
import { SchemaService } from "../services/SchemaService.js";
/** @extends {FormHost} */
class ControllerFormRender {
  async renderForm() {
    if (!this._view || this.signal.aborted || !this._container) {
      return;
    }
    try {
      const templateName = this._container.dataset.template || "form-component";
      const renderService = this.renderService;
      if (renderService && typeof renderService.paste === "function") {
        const renderData = SchemaService.toRenderData(this._view);
        await renderService.paste(this._container, templateName, renderData);
        if (!this.signal.aborted) {
          this._debugMsg("renderForm", `HTML f\xFCr '${this._sliceKey}' aktualisiert.`);
        }
      }
    } catch (error) {
      if (!this.signal.aborted) {
        this._capture("renderForm", error);
      }
    }
  }
}
export {
  ControllerFormRender
};
