/** @typedef {import("../types/templates.js").SanitizerFunction} SanitizerFunction */
/** @typedef {import("../types/templates.js").TemplateServiceConfig} TemplateServiceConfig */
/** @typedef {import("../types/templates.js").TemplateConfig} TemplateConfig */
/** @typedef {import("../types/templates.js").SlotDef} SlotDef */
/** @typedef {import("../types/templates.js").TemplatePart} TemplatePart */
/** @typedef {import("../types/templates.js").NormalizedTemplate} NormalizedTemplate */
/** @typedef {import("../types/templates.js").CompilePayload} CompilePayload */
/** @typedef {import("./template/TemplateCatalog.js").TemplateRoute} TemplateRoute */
import { DebugAgent } from "../agents/DebugAgent.js";
import { TemplateGuardDOM } from "../utils/TemplateGuardDOM.js";
import { TemplateCatalog } from "./template/TemplateCatalog.js";
class TemplateService {
  #cache = /* @__PURE__ */ new Map();
  #basePath;
  #sanitizer;
  #catalog = null;
  #catalogPromise = null;
  #indexPath;
  constructor(config = {}) {
    const options = typeof config === "string" ? { basePath: config } : config;
    const {
      basePath = new URL("../templates/", import.meta.url).href,
      sanitizer = null,
      autoInit = true,
      catalog = null,
      indexPath = "manifests/templates/templates-index-manifest.json"
    } = options;
    this.#basePath = basePath.endsWith("/") ? basePath : `${basePath}/`;
    this.#sanitizer = sanitizer || this.#defaultSanitizer.bind(this);
    this.#indexPath = indexPath || "manifests/templates/templates-index-manifest.json";
    if (catalog && typeof catalog === "object") {
      this.#catalog = catalog;
    }
    if (autoInit) {
      this.init();
    }
  }
  init() {
    const templateElements = document.querySelectorAll("template");
    templateElements.forEach((el) => {
      const configAttr = el.dataset.config || el.getAttribute("data-config") || el.getAttribute("data-aspis-config");
      if (!configAttr) return;
      try {
        const config = JSON.parse(configAttr);
        const templateData = this.#normalizeTemplate(el.id, config, el.innerHTML);
        this.#cache.set(config.name || el.id, templateData);
      } catch (error) {
        DebugAgent.error(`[TemplateService.init()] Aspis [TemplateService]: JSON-Parse-Fehler bei Template #${el.id}`, error);
      }
    });
    DebugAgent.info(`[TemplateService.init()] Aspis [TemplateService]: Initialisiert. ${this.#cache.size} Templates aus dem DOM geladen.`);
  }
  has(name) {
    return this.#cache.has(name);
  }
  clearCache() {
    this.#cache.clear();
  }
  async get(name) {
    if (this.#cache.has(name)) {
      return this.#cache.get(name) ?? null;
    }
    DebugAgent.warn(`[TemplateService.get()] Aspis [TemplateService]: '${name}' nicht im Cache. Starte dynamischen Fetch...`);
    try {
      return await this.#loadFromServer(name);
    } catch (error) {
      return null;
    }
  }
  compile(name, payload = {}) {
    const template = this.#cache.get(name);
    if (!template) {
      DebugAgent.error(`[TemplateService.compile()] Aspis [TemplateService]: Template '${name}' nicht im Cache gefunden. Kompilierung abgebrochen.`);
      return null;
    }
    return this.#compileHtml(template.html, template.slotDefs ?? [], payload, template);
  }
  getTemplateEvents(name) {
    return this.#cache.get(name)?.events ?? {};
  }
  /** Ersetzt geordnete Platzhalter in einem HTML-String durch sanitisierte Werte. */
  #replacePlaceholders(html, sortedEntries, values) {
    let result = html;
    for (const [key, placeholder] of sortedEntries) {
      const rawValue = values[key] ?? "";
      const cleanValue = this.#sanitizer(rawValue);
      result = result.replaceAll(placeholder, cleanValue);
    }
    return result;
  }
  #compileHtml(html, slotDefs, payload, template) {
    const payloadData = payload.data && typeof payload.data === "object" ? payload.data : {};
    const payloadAttributes = payload.attributes && typeof payload.attributes === "object" ? payload.attributes : {};
    let workingHtml = html;
    workingHtml = this.#replacePlaceholders(workingHtml, template.sortedData, payloadData);
    workingHtml = this.#replacePlaceholders(workingHtml, template.sortedAttributes, payloadAttributes);
    workingHtml = this.#replaceDataTokens(workingHtml, payloadData);
    const fragment = document.createRange().createContextualFragment(workingHtml);
    const element = fragment.firstElementChild;
    if (!element) {
      DebugAgent.error("[TemplateService.#compileHtml()] Transformation in den DOM fehlgeschlagen.");
      return null;
    }
    this.#fillSlots(element, slotDefs, payload, template);
    return element;
  }
  #fillSlots(rootElement, slotDefs, payload, template) {
    const defs = Array.isArray(slotDefs) ? slotDefs : [];
    const payloadSlots = payload.slots && typeof payload.slots === "object" ? payload.slots : {};
    for (let i = 0; i < defs.length; i += 1) {
      const def = defs[i];
      const targetNode = this.#findPlaceholderNode(rootElement, def.placeholder);
      if (!targetNode || !targetNode.parentNode) {
        continue;
      }
      const parent = targetNode.parentNode;
      const override = payloadSlots[def.key] ?? payloadSlots[def.part];
      if (override) {
        if (Array.isArray(override)) {
          override.forEach((child) => this.#appendSlotChild(parent, targetNode, child));
        } else {
          this.#appendSlotChild(parent, targetNode, override);
        }
        targetNode.remove();
        continue;
      }
      const nodes = this.#nodesForSlot(def, payload, template);
      for (let n = 0; n < nodes.length; n += 1) {
        this.#appendSlotChild(parent, targetNode, nodes[n]);
      }
      targetNode.remove();
    }
  }
  #nodesForSlot(def, payload, template) {
    const part = template.parts && template.parts[def.part];
    if (!part) {
      return [];
    }
    if (def.loop) {
      const items = this.#loopItems(payload, def);
      const nodes = [];
      for (let i = 0; i < items.length; i += 1) {
        const row = this.#rowData(items[i]);
        const node2 = this.#compileHtml(part.html, part.slotDefs, { data: row }, template);
        if (node2) {
          nodes.push(node2);
        }
      }
      return nodes;
    }
    const node = this.#compileHtml(part.html, part.slotDefs, payload, template);
    return node ? [node] : [];
  }
  #loopItems(payload, def) {
    const data = payload.data && typeof payload.data === "object" ? payload.data : {};
    const from = def.from || "rows";
    const list = data[from] ?? data[def.part] ?? data[def.key];
    return Array.isArray(list) ? list : [];
  }
  #rowData(item) {
    if (item && typeof item === "object" && "toRenderData" in item && typeof item.toRenderData === "function") {
      const data = item.toRenderData();
      return data && typeof data === "object" ? data : {};
    }
    if (item && typeof item === "object") {
      return item;
    }
    return { value: item };
  }
  #findPlaceholderNode(rootElement, placeholder) {
    if (!placeholder) {
      return null;
    }
    const walker = document.createTreeWalker(rootElement, NodeFilter.SHOW_TEXT);
    let currentNode = walker.nextNode();
    while (currentNode) {
      if (currentNode instanceof Text && currentNode.nodeValue && currentNode.nodeValue.includes(placeholder)) {
        return currentNode;
      }
      currentNode = walker.nextNode();
    }
    return null;
  }
  #replaceDataTokens(html, values) {
    const matches = String(html).match(/\{\{([a-zA-Z0-9_-]+)\}\}/g) || [];
    const seen = /* @__PURE__ */ new Set();
    const tokens = [];
    for (let i = 0; i < matches.length; i += 1) {
      const token = matches[i].replace(/\{\{|\}\}/g, "");
      if (seen.has(token) || token.endsWith("-slot") || token.endsWith("-loop")) {
        continue;
      }
      seen.add(token);
      tokens.push(token);
    }
    tokens.sort((a, b) => b.length - a.length);
    let result = html;
    for (let i = 0; i < tokens.length; i += 1) {
      const token = tokens[i];
      const rawValue = token in values ? values[token] : "";
      result = result.replaceAll(`{{${token}}}`, this.#sanitizer(rawValue));
    }
    return result;
  }
  #appendSlotChild(parent, targetNode, content) {
    if (content instanceof Node) {
      parent.insertBefore(content, targetNode);
    } else if (typeof content === "string") {
      const fragment = document.createRange().createContextualFragment(content);
      parent.insertBefore(fragment, targetNode);
    }
  }
  /**
   * Standard-Sanitizer zur Vorbeugung von XSS-Schwachstellen.
   * Nutzt `TemplateGuardDOM` falls vorhanden oder führt ein HTML-Entities-Escaping durch.
   */
  #defaultSanitizer(val) {
    const text = val === null || val === void 0 ? "" : typeof val === "string" || typeof val === "number" || typeof val === "boolean" ? val : String(val);
    if (typeof TemplateGuardDOM.clean === "function") {
      return String(TemplateGuardDOM.clean(text));
    }
    if (typeof TemplateGuardDOM.purify === "function") {
      return String(TemplateGuardDOM.purify(String(text)));
    }
    return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }
  /**
   * Lädt Manifest und Teildateien über den Katalog, normalisiert und legt sie in den Cache.
   *
   * Wirft, wenn das Manifest oder Teildateien nicht geladen werden können.
   */
  async #loadFromServer(name) {
    await this.#ensureCatalog();
    try {
      const source = await TemplateCatalog.fetch(this.#catalog, name, this.#basePath);
      const templateData = this.#normalizeTemplate(name, source.config, source.layoutHtml, source.parts);
      this.#cache.set(name, templateData);
      return templateData;
    } catch (error) {
      DebugAgent.error(`[TemplateService.#loadFromServer()] Aspis [TemplateService]: Dynamischer Fetch f\xFCr '${name}' fehlgeschlagen!`, error);
      throw error;
    }
  }
  async #ensureCatalog() {
    if (this.#catalog) {
      return;
    }
    if (!this.#catalogPromise) {
      this.#catalogPromise = TemplateCatalog.load(this.#indexPath).then((loaded) => {
        this.#catalog = loaded;
        return loaded;
      });
    }
    await this.#catalogPromise;
  }
  #normalizeTemplate(id, config, htmlString, partHtml = {}) {
    const placeholders = config.placeholder || { ...config.slots, ...config.attributes };
    const classified = this.#classifyPlaceholders(placeholders);
    const layoutDefs = this.#slotDefsInHtml(htmlString, config, Object.keys(partHtml));
    const parts = {};
    const partKeys = Object.keys(partHtml);
    for (let i = 0; i < partKeys.length; i += 1) {
      const key = partKeys[i];
      parts[key] = {
        html: String(partHtml[key] || "").trim(),
        slotDefs: this.#slotDefsInHtml(partHtml[key], config, partKeys)
      };
    }
    const sortByLengthDesc = (obj) => Object.entries(obj).sort(([, a], [, b]) => b.length - a.length);
    const defaults = {
      id: id || config.name || "",
      role: config.partial ? "partial" : "container",
      isRoot: false,
      childSlot: null,
      allowedChildren: [],
      events: {},
      styles: {},
      targets: {},
      bindings: {}
    };
    return {
      ...defaults,
      ...config,
      html: String(htmlString || "").trim(),
      parts,
      slotDefs: layoutDefs,
      slots: classified.slots,
      attributes: classified.attributes,
      data: classified.data,
      sortedData: sortByLengthDesc(classified.data),
      sortedAttributes: sortByLengthDesc(classified.attributes),
      placeholder: placeholders,
      config
    };
  }
  #classifyPlaceholders(placeholders) {
    const slots = {};
    const attributes = {};
    const data = {};
    const entries = Object.entries(placeholders || {});
    for (let i = 0; i < entries.length; i += 1) {
      const key = entries[i][0];
      const value = entries[i][1];
      const isValuePlaceholder = String(value).startsWith("{{");
      const placeholder = isValuePlaceholder ? value : key;
      const cleanKey = placeholder.replace(/\{\{|\}\}/g, "");
      const type = isValuePlaceholder ? key : value;
      if (cleanKey.startsWith("slot") || cleanKey.endsWith("-slot") || cleanKey.endsWith("-loop") || ["temp", "temp-loop", "container"].includes(type)) {
        slots[cleanKey] = placeholder;
      } else if (cleanKey.startsWith("attr") || type === "attr") {
        attributes[cleanKey] = placeholder;
      } else {
        data[cleanKey] = placeholder;
      }
    }
    return { slots, attributes, data };
  }
  #slotDefsInHtml(html, config, partKeys) {
    const source = String(html || "");
    const defs = [];
    const seen = /* @__PURE__ */ new Set();
    const slots = config.slots && typeof config.slots === "object" ? config.slots : {};
    const slotKeys = Object.keys(slots);
    for (let i = 0; i < slotKeys.length; i += 1) {
      const key = slotKeys[i];
      const placeholder = String(slots[key]);
      if (!source.includes(placeholder) || seen.has(placeholder)) {
        continue;
      }
      seen.add(placeholder);
      defs.push({
        key,
        part: key,
        placeholder,
        loop: placeholder.includes("-loop"),
        from: this.#loopFrom(config, key)
      });
    }
    const loops = config.loops && typeof config.loops === "object" ? config.loops : {};
    const loopKeys = Object.keys(loops);
    for (let i = 0; i < loopKeys.length; i += 1) {
      const key = loopKeys[i];
      const spec = loops[key];
      const placeholder = typeof spec === "string" ? spec : String(spec?.placeholder || `{{${key}-loop}}`);
      if (!source.includes(placeholder) || seen.has(placeholder)) {
        continue;
      }
      seen.add(placeholder);
      defs.push({
        key,
        part: typeof spec === "object" && spec.part ? spec.part : key,
        placeholder,
        loop: true,
        from: typeof spec === "object" && spec.from ? spec.from : this.#loopFrom(config, key)
      });
    }
    const tokens = source.match(/\{\{([a-zA-Z0-9_-]+)\}\}/g) || [];
    for (let i = 0; i < tokens.length; i += 1) {
      const placeholder = tokens[i];
      if (seen.has(placeholder)) {
        continue;
      }
      const token = placeholder.replace(/\{\{|\}\}/g, "");
      if (token.endsWith("-loop")) {
        const part = token.slice(0, -5);
        if (!partKeys.includes(part)) {
          continue;
        }
        seen.add(placeholder);
        defs.push({
          key: part,
          part,
          placeholder,
          loop: true,
          from: this.#loopFrom(config, part)
        });
        continue;
      }
      if (token.endsWith("-slot")) {
        const part = token.slice(0, -5);
        if (!partKeys.includes(part)) {
          continue;
        }
        seen.add(placeholder);
        defs.push({
          key: part,
          part,
          placeholder,
          loop: false,
          from: ""
        });
      }
    }
    return defs;
  }
  #loopFrom(config, key) {
    const loops = config.loops && typeof config.loops === "object" ? config.loops : {};
    const spec = loops[key];
    if (spec && typeof spec === "object" && spec.from) {
      return spec.from;
    }
    if (key === "row" || key === "rows") {
      return "rows";
    }
    if (key === "item" || key === "items") {
      return "items";
    }
    if (key === "option" || key === "options") {
      return "options";
    }
    return key;
  }
}
export {
  TemplateService
};
