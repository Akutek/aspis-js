/** @typedef {import("../types/controllers.js").ModalHost} ModalHost */
import { RuntimeEnv } from "../core/RuntimeEnv.js";
/** @extends {ModalHost} */
class ControllerModalHost {
  modalHostTarget() {
    if (this._mountMode === "self") {
      return this._container;
    }
    return RuntimeEnv.body() ?? this._container;
  }
  async mountModal() {
    const renderService = this.renderService;
    const host = this.modalHostTarget?.();
    if (!host || !this._view) {
      return;
    }
    const templateName = this._templateName || "modal";
    const view = this._view;
    const data = {
      title: "title" in view ? view.title || "" : "",
      message: "message" in view ? view.message || "" : "",
      ariaHidden: "isOpen" in view && view.isOpen ? "false" : "true"
    };
    if (this._mountMode === "self" && renderService && typeof renderService.paste === "function") {
      this._modalRoot = await renderService.paste(host, templateName, data);
      this._modalMountedOnBody = false;
      return;
    }
    if (renderService && typeof renderService.append === "function") {
      this._modalRoot = await renderService.append(host, templateName, data);
      this._modalMountedOnBody = host !== this._container;
      return;
    }
    this._modalRoot = this._container;
    this._modalMountedOnBody = false;
    this._warn("mountModal", "RenderService fehlt, Modal bleibt im Controller-Knoten.");
  }
}
export {
  ControllerModalHost
};
