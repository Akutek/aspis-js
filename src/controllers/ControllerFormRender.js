/** @typedef {import("../types/controllers.js").FormHost} FormHost */
import { SchemaService } from "../services/SchemaService.js";
/** @extends {FormHost} */
class ControllerFormRender {
  async pasteNamedForm() {
    const host = this._container;
    if (!host) {
      return;
    }
    const templateName = host.dataset.template;
    if (!templateName) {
      return;
    }
    const renderService = this.renderService;
    if (!renderService || typeof renderService.paste !== "function") {
      this._warn("pasteNamedForm", "TemplateRenderService fehlt.");
      return;
    }
    const dataset = host.dataset;
    const csrf = dataset.csrf
      || (typeof document !== "undefined"
        ? document.querySelector('meta[name="csrf-token"]')?.getAttribute("content")
        : "")
      || "";
    const faction = dataset.faction || "";
    let characters = [];
    if (dataset.characters) {
      try {
        const parsed = JSON.parse(dataset.characters);
        if (Array.isArray(parsed)) {
          characters = parsed;
        }
      } catch {
        characters = [];
      }
    }
    await renderService.paste(host, templateName, {
      action: dataset.action || dataset.url || "",
      method: dataset.method || "post",
      csrf,
      next: dataset.next || "/",
      submitLabel: dataset.submitLabel || "Senden",
      login: dataset.login || "",
      q: dataset.q || "",
      factionAll: faction === "" ? "selected" : "",
      factionAlliance: faction === "alliance" ? "selected" : "",
      factionHorde: faction === "horde" ? "selected" : "",
      factionNeutral: faction === "neutral" ? "selected" : "",
      signupId: dataset.signupId || "",
      nextPhase: dataset.nextPhase || "",
      nextLabel: dataset.nextLabel || "",
      fieldList: [],
      characters
    });
  }
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
