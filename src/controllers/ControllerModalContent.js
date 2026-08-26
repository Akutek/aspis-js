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
    const data = this.formRenderPayload();
    if (body instanceof HTMLElement) {
      const pasted = await renderService.paste(body, templateName, data);
      if (pasted instanceof HTMLFormElement) {
        pasted.dataset.controller = "form";
        if (data.action) {
          pasted.dataset.url = String(data.action);
        }
        if (data.method) {
          pasted.dataset.method = String(data.method);
        }
        this.hydratePastedForm(pasted);
      }
    }
  }
  /**
   * Formular ist nach paste noch nicht im letzten Scan. Cycle nicht
   * awaiten: fillModalContent läuft in der Factory desselben Cycles.
   * @param {HTMLFormElement} form
   * @returns {void}
   */
  hydratePastedForm(form) {
    const registry = this._registry;
    const modalHost = this._container;
    if (modalHost?.dataset?.successTarget && !form.dataset.successTarget) {
      form.dataset.successTarget = modalHost.dataset.successTarget;
    }
    if (!registry || typeof registry.has !== "function" || !registry.has("cycle")) {
      this._warn("hydratePastedForm", "Kein cycle in der Registry.");
      return;
    }
    const cycle = registry.get("cycle");
    if (typeof cycle !== "function") {
      return;
    }
    form.addEventListener("submit", (event) => {
      if (registry.has(form)) {
        return;
      }
      event.preventDefault();
      void cycle(form).then(() => {
        if (this.signal.aborted) {
          return;
        }
        const instance = registry.has(form) ? registry.get(form) : null;
        if (instance && typeof instance.submit === "function") {
          void instance.submit();
        }
      });
    });
    void cycle(form);
  }
  formRenderPayload() {
    const dataset = this._container?.dataset || {};
    const viewData = this._view ? SchemaService.toRenderData(this._view) : {};
    const csrf = dataset.csrf
      || (typeof document !== "undefined"
        ? document.querySelector('meta[name="csrf-token"]')?.getAttribute("content")
        : "")
      || "";
    return {
      ...viewData,
      action: dataset.action || dataset.url || viewData.action || "",
      method: dataset.method || "post",
      csrf,
      next: dataset.next || "/",
      submitLabel: dataset.submitLabel || "Senden",
      login: dataset.login || ""
    };
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
