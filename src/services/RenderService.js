/** @typedef {import("../types/services.js").AppendableElements} AppendableElements */
/** @typedef {import("../types/services.js").LoopItem} LoopItem */
/** @typedef {import("../types/services.js").RenderableItem} RenderableItem */
/** @typedef {import("../types/services.js").RenderData} RenderData */
/** @typedef {import("../types/services.js").TreeCleaner} TreeCleaner */
import { DebugAgent } from "../agents/DebugAgent.js";
import { GuardDOM } from "../utils/GuardDOM.js";
class RenderService {
  #templates;
  #cleaner;
  /** Wirft, wenn kein `templateService` übergeben wurde. */
  constructor(templateService, cleaner = null) {
    if (!templateService) {
      throw new Error("Aspis [RenderService]: TemplateService ist erforderlich.");
    }
    this.#templates = templateService;
    this.#cleaner = cleaner;
  }
  /**
   * Kompiliert ein Template mit den übergebenen Daten und fügt das gesäuberte Ergebnis
   * in den `targetContainer` ein (ersetzt dessen bisherigen Inhalt).
   *
   * Wirft, wenn `targetContainer` kein gültiges `HTMLElement` ist oder das Rendering fehlschlägt.
   */
  async paste(targetContainer, templateName, data = {}) {
    if (!targetContainer || !(targetContainer instanceof HTMLElement)) {
      throw new Error("Aspis [RenderService]: Ung\xFCltiges Ziel-Element f\xFCr paste().");
    }
    const element = await this.compile(templateName, data);
    if (!element) {
      throw new Error(`Aspis [RenderService]: Rendering f\xFCr '${templateName}' fehlgeschlagen.`);
    }
    if (this.#cleaner && typeof this.#cleaner.cleanTree === "function") {
      this.#cleaner.cleanTree(targetContainer);
    }
    const cleanElement = this.#purifyElement(element);
    targetContainer.replaceChildren(cleanElement);
    return cleanElement;
  }
  /**
   * Kompiliert ein Template und hängt das Ergebnis an den Zielknoten
   * (ohne dessen bisherige Kinder zu ersetzen). Für Overlays am Dokumentende.
   */
  async append(targetContainer, templateName, data = {}) {
    if (!targetContainer || !(targetContainer instanceof HTMLElement)) {
      throw new Error("Aspis [RenderService]: Ung\xFCltiges Ziel-Element f\xFCr append().");
    }
    const element = await this.compile(templateName, data);
    if (!element) {
      throw new Error(`Aspis [RenderService]: Rendering f\xFCr '${templateName}' fehlgeschlagen.`);
    }
    const cleanElement = this.#purifyElement(element);
    targetContainer.appendChild(cleanElement);
    return cleanElement;
  }
  /**
   * Kompiliert ein Template mit Daten. Baut bei Bedarf eine Asynchron-Sperre auf,
   * um nicht geladene Templates aus der Quelle nachzuladen.
   */
  async compile(templateName, data = {}) {
    let element = this.#templates.compile(templateName, { data });
    if (!element) {
      const templateData = await this.#templates.get(templateName);
      if (templateData) {
        element = this.#templates.compile(templateName, { data });
      }
    }
    return element;
  }
  async loop(templateName, list = []) {
    if (!Array.isArray(list)) {
      DebugAgent.warn("[RenderService.loop()] Aspis [RenderService]: loop() erwartet ein Array.");
      return document.createDocumentFragment();
    }
    const fragment = document.createDocumentFragment();
    for (const item of list) {
      const renderData = item && typeof item === "object" && "toRenderData" in item && typeof item.toRenderData === "function" ? item.toRenderData() : item;
      const element = await this.compile(templateName, renderData);
      if (element) {
        fragment.appendChild(this.#purifyElement(element));
      }
    }
    return fragment;
  }
  /**
   * Ersetzt die Kinder des Ziel-Containers durch ein einzelnes Element oder ein Array von Elementen.
   *
   * Wirft, wenn `targetContainer` kein gültiges `HTMLElement` ist.
   */
  combine(targetContainer, elements = []) {
    if (!targetContainer || !(targetContainer instanceof HTMLElement)) {
      throw new Error("Aspis [RenderService]: Ung\xFCltiges Ziel-Element f\xFCr combine().");
    }
    const nodeList = Array.isArray(elements) ? elements : [elements];
    targetContainer.replaceChildren(...nodeList);
  }
  /** Säubert das übergebene DOM-Element über `GuardDOM`, falls vorhanden. */
  #purifyElement(element) {
    if (typeof GuardDOM.purify === "function") {
      const cleanHtml = GuardDOM.purify(element.outerHTML);
      const template = document.createElement("template");
      template.innerHTML = cleanHtml;
      return template.content.firstElementChild || element;
    }
    return element;
  }
}
export {
  RenderService
};
