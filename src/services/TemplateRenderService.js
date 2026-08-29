/** @typedef {import("../types/services.js").TreeCleaner} TreeCleaner */
/** @typedef {import("../types/templates.js").Blueprint} Blueprint */
/** @typedef {import("../types/templates.js").BlueprintSlotSpec} BlueprintSlotSpec */
import { DebugAgent } from "../agents/DebugAgent.js";

class TemplateRenderService {
  #templates;
  #cleaner;

  /** Wirft, wenn kein `templateService` übergeben wurde. */
  constructor(templateService, cleaner = null) {
    if (!templateService) {
      throw new Error("Aspis [TemplateRenderService]: TemplateService ist erforderlich.");
    }
    this.#templates = templateService;
    this.#cleaner = cleaner;
  }

  /**
   * Blueprint-Name am Host: `data-manifest`, sonst `data-template` / `data-form-template`.
   * @param {HTMLElement | null | undefined} host
   * @returns {string}
   */
  static nameFromHost(host) {
    if (!(host instanceof HTMLElement)) {
      return "";
    }
    return host.dataset.manifest || host.dataset.template || host.dataset.formTemplate || "";
  }

  /**
   * Kompiliert Blueprint oder Stein und ersetzt den Inhalt von `targetContainer`.
   */
  async paste(targetContainer, templateName, data = {}) {
    if (!targetContainer || !(targetContainer instanceof HTMLElement)) {
      throw new Error("Aspis [TemplateRenderService]: Ungültiges Ziel-Element für paste().");
    }
    const element = await this.compile(templateName, data);
    if (!element) {
      throw new Error(`Aspis [TemplateRenderService]: Rendering für '${templateName}' fehlgeschlagen.`);
    }
    if (this.#cleaner && typeof this.#cleaner.cleanTree === "function") {
      this.#cleaner.cleanTree(targetContainer);
    }
    targetContainer.replaceChildren(element);
    return element;
  }

  async append(targetContainer, templateName, data = {}) {
    if (!targetContainer || !(targetContainer instanceof HTMLElement)) {
      throw new Error("Aspis [TemplateRenderService]: Ungültiges Ziel-Element für append().");
    }
    const element = await this.compile(templateName, data);
    if (!element) {
      throw new Error(`Aspis [TemplateRenderService]: Rendering für '${templateName}' fehlgeschlagen.`);
    }
    targetContainer.appendChild(element);
    return element;
  }

  /**
   * Lädt Blueprint oder Stein, baut den Baum, kompiliert Steine über TemplateService.
   * @param {string} templateName
   * @param {Object<string, unknown>} data
   * @returns {Promise<Element|null>}
   */
  async compile(templateName, data = {}) {
    const loaded = await this.#templates.resolve(templateName);
    if (!loaded) {
      DebugAgent.error(`[TemplateRenderService.compile()] '${templateName}' nicht geladen.`);
      return null;
    }
    if (loaded.kind === "blueprint" && loaded.blueprint) {
      return this.#walk(loaded.blueprint, data);
    }
    await this.#templates.get(templateName);
    return this.#templates.compile(templateName, data);
  }

  async loop(templateName, list = []) {
    if (!Array.isArray(list)) {
      DebugAgent.warn("[TemplateRenderService.loop()] loop() erwartet ein Array.");
      return document.createDocumentFragment();
    }
    const fragment = document.createDocumentFragment();
    for (const item of list) {
      const renderData = item && typeof item === "object" && "toRenderData" in item && typeof item.toRenderData === "function"
        ? item.toRenderData()
        : item;
      const element = await this.compile(templateName, renderData);
      if (element) {
        fragment.appendChild(element);
      }
    }
    return fragment;
  }

  combine(targetContainer, elements = []) {
    if (!targetContainer || !(targetContainer instanceof HTMLElement)) {
      throw new Error("Aspis [TemplateRenderService]: Ungültiges Ziel-Element für combine().");
    }
    const nodeList = Array.isArray(elements) ? elements : [elements];
    targetContainer.replaceChildren(...nodeList);
  }

  /**
   * @param {Blueprint} blueprint
   * @param {Object<string, unknown>} data
   * @param {BlueprintSlotSpec | null} spec
   * @returns {Promise<Element|null>}
   */
  async #walk(blueprint, data, spec = null) {
    const nodeSpec = spec || {
      template: blueprint.root,
      slots: blueprint.slots,
      map: blueprint.map,
      from: blueprint.from,
      classKey: "root"
    };
    const brickName = nodeSpec.template || blueprint.root;
    const row = this.#mapped(data, nodeSpec.map || (spec ? {} : blueprint.map));
    /** @type {Object<string, Node | Node[]>} */
    const slots = {};
    const childSpecs = nodeSpec.slots && typeof nodeSpec.slots === "object" ? nodeSpec.slots : {};
    const slotKeys = Object.keys(childSpecs);
    for (let i = 0; i < slotKeys.length; i += 1) {
      const slotKey = slotKeys[i];
      const child = childSpecs[slotKey];
      if (!child || typeof child !== "object") {
        continue;
      }
      if (child.loop) {
        const list = this.#listFrom(row, child.from || child.template);
        const nodes = [];
        for (let n = 0; n < list.length; n += 1) {
          const childNode = await this.#walk(blueprint, list[n], child);
          if (childNode) {
            nodes.push(childNode);
          }
        }
        slots[slotKey] = nodes;
      } else {
        const childNode = await this.#walk(blueprint, row, child);
        if (childNode) {
          slots[slotKey] = childNode;
        }
      }
    }
    await this.#templates.get(brickName);
    const element = this.#templates.compile(brickName, { data: row, slots });
    if (!element) {
      DebugAgent.error(`[TemplateRenderService.#walk()] Stein '${brickName}' nicht kompiliert.`);
      return null;
    }
    this.#applyClasses(element, this.#classList(blueprint, nodeSpec, brickName, spec));
    return element;
  }

  /**
   * @param {Blueprint} blueprint
   * @param {BlueprintSlotSpec} nodeSpec
   * @param {string} brickName
   * @param {BlueprintSlotSpec | null} spec
   * @returns {string}
   */
  #classList(blueprint, nodeSpec, brickName, spec) {
    const bag = blueprint.classes && typeof blueprint.classes === "object" ? blueprint.classes : {};
    if (nodeSpec.classKey && bag[nodeSpec.classKey]) {
      return bag[nodeSpec.classKey];
    }
    if (!spec) {
      return bag.root || "";
    }
    if (blueprint.branch && brickName === blueprint.branch) {
      return bag.branch || "";
    }
    return bag[brickName] || "";
  }

  /**
   * Klassen kommen bereits sanitized aus dem Blueprint-Hydrator.
   * @param {Element} element
   * @param {string} classList
   */
  #applyClasses(element, classList) {
    const text = String(classList || "").trim();
    if (!text || !element.classList) {
      return;
    }
    const parts = text.split(/\s+/).filter(Boolean);
    if (parts.length > 0) {
      element.classList.add(...parts);
    }
  }

  #listFrom(data, from) {
    if (!from) {
      return [];
    }
    const rec = data && typeof data === "object" && !Array.isArray(data) ? data : {};
    const list = rec[from];
    return Array.isArray(list) ? list : [];
  }

  #mapped(data, map) {
    const rec = data && typeof data === "object" && !Array.isArray(data) ? { ...data } : {};
    if (!map || typeof map !== "object") {
      return rec;
    }
    const keys = Object.keys(map);
    for (let i = 0; i < keys.length; i += 1) {
      const to = keys[i];
      const from = map[to];
      if (from && Object.prototype.hasOwnProperty.call(rec, from)) {
        rec[to] = rec[from];
      }
    }
    return rec;
  }
}

export {
  TemplateRenderService
};
