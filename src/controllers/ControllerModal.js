/** @typedef {import("../types/controllers.js").ControllerOptions} ControllerOptions */
/** @typedef {import("../types/controllers.js").LoaderLike} LoaderLike */
/** @typedef {import("../types/controllers.js").ModalHost} ModalHost */
/** @typedef {import("../types/schema.js").ModalView} ModalView */
import { SchemaService } from "../services/SchemaService.js";
import { ControllerModifierDOM } from "../utils/ControllerModifierDOM.js";
/** @extends {ModalHost} */
class ControllerModal {

  prepare(options = {}) {
    this._kind = "ControllerModal";
    const dataset = this._container?.dataset || {};
    if (!this._sliceKey) {
      this._sliceKey = options.sliceKey || dataset.sliceKey || "features.modal";
    }
    this._view = null;
    this._modalRoot = null;
    this._modalMountedOnBody = false;
    this._dataUrl = dataset.url || null;
    this._connection = dataset.connection || null;
    this._apiToken = dataset.apiToken || null;
    this._contentKind = dataset.content || dataset.kind || "loader";
    this._mountMode = dataset.mount === "self" ? "self" : "body";
    this._templateName = dataset.template || "modal";
  }
  async onReady() {
    const dataset = this._container?.dataset || {};
    const layout = this._layout || dataset.layout || "default";
    this._view = SchemaService.modal({
      layout,
      title: dataset.title || "",
      message: dataset.message || "",
      contentKind: this._contentKind,
      variant: dataset.loader || dataset.variant || "spinner",
      isOpen: dataset.open === "true"
    });
    if (typeof this.mountModal === "function") {
      await this.mountModal();
    }
    this.bindModalEvents();
    this.bindModalOpeners();
    if (typeof this.fillModalContent === "function") {
      await this.fillModalContent();
    }
    if (this._view && !SchemaService.isLoader(this._view) && this._view.isOpen) {
      this.open();
    } else {
      this.close();
    }
  }
  onStateChange(slice) {
    if (slice?.view && this._view !== slice.view) {
      this._view = slice.view;
      this.syncModalOpen();
      if (typeof this.fillModalContent === "function") {
        void this.fillModalContent();
      }
    }
  }
  bindModalEvents() {
    const root = this._modalRoot || this._container;
    if (!root) {
      return;
    }
    const signal = this.signal;
    root.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) {
        return;
      }
      if (target.closest('[data-target="close"]')) {
        this.close();
        return;
      }
      const view = this._view && !SchemaService.isLoader(this._view) ? this._view : null;
      if (target.closest('[data-target="backdrop"]') && view?.closeOnBackdrop !== false) {
        this.close();
      }
    }, { signal });
    if (typeof document !== "undefined") {
      document.addEventListener("keydown", (event) => {
        const view = this._view && !SchemaService.isLoader(this._view) ? this._view : null;
        if (event.key === "Escape" && view?.isOpen) {
          this.close();
        }
      }, { signal });
    }
  }
  /** Öffner außerhalb des Modals: <button data-open-modal="id-des-host">. */
  bindModalOpeners() {
    const id = this._container?.id;
    if (!id || typeof document === "undefined") {
      return;
    }
    document.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) {
        return;
      }
      if (target.closest(`[data-open-modal="${CSS.escape(id)}"]`)) {
        this.open();
      }
    }, { signal: this.signal });
  }
  open() {
    if (!this._view || SchemaService.isLoader(this._view)) {
      return;
    }
    SchemaService.setModalOpen(this._view, true);
    this.syncModalOpen();
    this._dispatcher?.emit?.("modal:open", {
      kind: this._view.contentKind,
      container: this._container,
      root: this._modalRoot
    });
  }
  close() {
    if (!this._view || SchemaService.isLoader(this._view)) {
      return;
    }
    SchemaService.setModalOpen(this._view, false);
    this.syncModalOpen();
    this._dispatcher?.emit?.("modal:close", {
      kind: this._view.contentKind,
      container: this._container,
      root: this._modalRoot
    });
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
  syncModalOpen() {
    const root = this._modalRoot || this._container;
    if (!root || !this._view || SchemaService.isLoader(this._view)) {
      return;
    }
    ControllerModifierDOM.toggleClass(root, "is-open", this._view.isOpen);
    ControllerModifierDOM.attr(root, "aria-hidden", !this._view.isOpen);
    if (this._container && this._container !== root) {
      ControllerModifierDOM.toggleClass(this._container, "is-open", this._view.isOpen);
    }
  }
  onDestroy() {
    if (this._modalMountedOnBody && this._modalRoot && this._modalRoot.parentNode) {
      this._modalRoot.parentNode.removeChild(this._modalRoot);
    }
    this._modalRoot = null;
    this._modalMountedOnBody = false;
  }
}
export {
  ControllerModal
};
