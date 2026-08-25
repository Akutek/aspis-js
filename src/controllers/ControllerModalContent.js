/** @typedef {import("../types/controllers.js").ModalHost} ModalHost */
import { SchemaService } from "../services/SchemaService.js";
/** @extends {ModalHost} */
class ControllerModalContent {
  async fillModalContent() {
    const root = this._modalRoot || this._container;
    if (!root || !this._view || this.signal.aborted) {
      return;
    }
    const body = root.querySelector('[data-target="body"]') || root;
    const renderService = this.renderService;
    if (!renderService || typeof renderService.paste !== "function") {
      return;
    }
    const kind = ("contentKind" in this._view ? this._view.contentKind : null) || this._contentKind || "loader";
    if (kind === "empty" || kind === "custom") {
      return;
    }
    const templateName = this.modalContentTemplate?.(kind) || "loader-spinner";
    const data = SchemaService.toRenderData(this._view);
    if (body instanceof HTMLElement) {
      await renderService.paste(body, templateName, data);
    }
  }
  modalContentTemplate(kind) {
    const dataset = this._container?.dataset || {};
    if (dataset.contentTemplate) {
      return dataset.contentTemplate;
    }
    if (kind === "notification") {
      return "notification";
    }
    if (kind === "form") {
      return dataset.formTemplate || "form-component";
    }
    const variant = (this._view && "variant" in this._view ? this._view.variant : null) || dataset.loader || "spinner";
    return variant === "bar" ? "loader-bar" : "loader-spinner";
  }
}
export {
  ControllerModalContent
};
