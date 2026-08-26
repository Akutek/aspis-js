/** @typedef {import("../types/controllers.js").ControllerOptions} ControllerOptions */
/** @typedef {import("../types/controllers.js").FormHost} FormHost */
/** @typedef {import("../types/schema.js").FormView} FormView */
/** @extends {FormHost} */
class ControllerForm {
  prepare(options = {}) {
    this._kind = "ControllerForm";
    const dataset = this._container?.dataset || {};
    const form = this._container instanceof HTMLFormElement ? this._container : null;
    if (!this._sliceKey) {
      this._sliceKey = options.sliceKey || dataset.sliceKey || "features.mainForm";
    }
    this._view = null;
    this._dataUrl = dataset.url || form?.action || null;
    this._connection = dataset.connection || null;
    this._apiToken = dataset.apiToken || null;
    const layout = String(this._layout || dataset.layout || "").toLowerCase();
    const type = String(dataset.controller || "").toLowerCase();
    const simple = layout === "simple" || type === "form-simple";
    this._validateOnBlur = options.validateOnBlur ?? (!simple && dataset.validateOnBlur !== "false");
    this._validateOnChange = options.validateOnChange ?? dataset.validateOnChange === "true";
  }
  async onReady() {
    if (this._container?.dataset.template && typeof this.pasteNamedForm === "function") {
      await this.pasteNamedForm();
    }
    if (typeof this.buildFormView === "function") {
      this.buildFormView();
    }
    if (typeof this.bindFormEvents === "function") {
      this.bindFormEvents();
    }
    if (typeof this.bindFormDropdownSync === "function") {
      this.bindFormDropdownSync();
    }
  }
  onStateChange(slice) {
    if (slice?.view && this._view !== slice.view) {
      this._view = slice.view;
      if (typeof this.renderForm === "function") {
        this.renderForm();
      }
    }
  }
}
export {
  ControllerForm
};
