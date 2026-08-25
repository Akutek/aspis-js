/** @typedef {import("../types/controllers.js").FormHost} FormHost */
import { SchemaService } from "../services/SchemaService.js";
import { ModifierDOM } from "../utils/ModifierDOM.js";
import { errorMessage, errorName } from "./BaseController.js";
/** @extends {FormHost} */
class ControllerFormSubmit {
  async submit() {
    if (!this._view || this._view.isSubmitting || !this._container) {
      return;
    }
    const isValid = SchemaService.validateForm(this._view);
    const payload = SchemaService.formPayload(this._view);
    if (typeof this.updateFieldUI === "function") {
      Object.keys(payload).forEach((name) => this.updateFieldUI?.(name));
    }
    if (!isValid) {
      if (typeof this.focusFirstInvalidField === "function") {
        this.focusFirstInvalidField();
      }
      return;
    }
    SchemaService.setSubmitting(this._view, true);
    this.toggleSubmittingUI?.(true);
    const form = this._container instanceof HTMLFormElement ? this._container : null;
    const url = this._dataUrl || form?.action || this._container.dataset.url;
    const method = (form?.method || this._container.dataset.method || "POST").toUpperCase();
    const submitSignal = this.getSignal("formSubmit");
    try {
      let response;
      if (typeof this.fetcher?.request === "function" && url) {
        response = await this.fetcher.request(url, { method, body: payload, signal: submitSignal });
      } else if (method === "POST" && typeof this.fetcher?.post === "function" && url) {
        response = await this.fetcher.post(url, payload, { signal: submitSignal });
      } else if (url) {
        const headers = { "Content-Type": "application/json" };
        if (this._apiToken) {
          headers.Authorization = `Bearer ${this._apiToken}`;
        }
        const res = await fetch(url, {
          method,
          headers,
          body: JSON.stringify(payload),
          signal: submitSignal
        });
        if (!res.ok) {
          throw new Error(`HTTP Fehler ${res.status}`);
        }
        response = await res.json();
      }
      if (submitSignal.aborted || this.signal.aborted) {
        return;
      }
      SchemaService.setSubmitResult(this._view, true);
      if (typeof this.showFormMessage === "function") {
        this.showFormMessage("Formular erfolgreich abgesendet!", "success");
      }
      this._dispatcher?.emit?.("form:success", { response, payload: SchemaService.formPayload(this._view) });
      if (this._container.dataset.resetOnSuccess !== "false") {
        this.reset?.();
      }
    } catch (error) {
      if (errorName(error) !== "AbortError" && !submitSignal.aborted && !this.signal.aborted) {
        const errorMsg = errorMessage(error) || "Beim Absenden ist ein Fehler aufgetreten.";
        SchemaService.setSubmitResult(this._view, false, errorMsg);
        if (typeof this.showFormMessage === "function") {
          this.showFormMessage(errorMsg, "error");
        }
        this._dispatcher?.emit?.("form:error", { error });
        this._capture("submit", error);
      }
    } finally {
      if (!this.signal.aborted && this._view) {
        SchemaService.setSubmitting(this._view, false);
        this.toggleSubmittingUI?.(false);
      }
      this.clearTask("formSubmit");
    }
  }
  reset() {
    if (!this._view || !this._container) {
      return;
    }
    SchemaService.resetForm(this._view);
    const form = this._container instanceof HTMLFormElement ? this._container : null;
    if (form && typeof form.reset === "function") {
      form.reset();
    }
    const fields = SchemaService.formPayload(this._view);
    Object.keys(fields).forEach((name) => {
      const escapedName = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(name) : name;
      const fieldEl = this._container?.querySelector(`[name="${escapedName}"]`);
      if (fieldEl) {
        const wrapper = fieldEl.closest(".form-group") || fieldEl.parentElement;
        ModifierDOM.removeClass(wrapper, "has-error");
        ModifierDOM.removeClass(fieldEl, "is-invalid");
      }
    });
    if (typeof this.hideFormMessage === "function") {
      this.hideFormMessage();
    }
  }
  toggleSubmittingUI(isSubmitting) {
    if (!this._container) {
      return;
    }
    const submitBtn = this._container.querySelector('[type="submit"]');
    if (submitBtn instanceof HTMLButtonElement || submitBtn instanceof HTMLInputElement) {
      submitBtn.disabled = isSubmitting;
      ModifierDOM.toggleClass(submitBtn, "is-loading", isSubmitting);
    }
    ModifierDOM.toggleClass(this._container, "is-submitting", isSubmitting);
  }
  focusFirstInvalidField() {
    if (!this._view || !this._container) {
      return;
    }
    const errors = SchemaService.formErrors(this._view);
    const firstErrorName = Object.keys(errors)[0];
    if (!firstErrorName) {
      return;
    }
    const escapedName = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(firstErrorName) : firstErrorName;
    const el = this._container.querySelector(`[name="${escapedName}"], [data-name="${escapedName}"]`);
    if (el instanceof HTMLElement) {
      el.focus();
    }
  }
}
export {
  ControllerFormSubmit
};
