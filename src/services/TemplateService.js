/** @typedef {import("../types/templates.js").TemplateServiceConfig} TemplateServiceConfig */
/** @typedef {import("../types/templates.js").TemplateConfig} TemplateConfig */
/** @typedef {import("../types/templates.js").SlotDef} SlotDef */
/** @typedef {import("../types/templates.js").NormalizedTemplate} NormalizedTemplate */
/** @typedef {import("../types/templates.js").CompilePayload} CompilePayload */
/** @typedef {import("../types/templates.js").CatalogResource} CatalogResource */
import { DebugAgent } from "../agents/DebugAgent.js";
import { TemplateCatalog } from "./template/TemplateCatalog.js";
import { TemplateBrickHydrator } from "../hydrators/TemplateBrickHydrator.js";

class TemplateService {
  #cache = /* @__PURE__ */ new Map();
  #resources = /* @__PURE__ */ new Map();
  /** Gleicher Name teilt denselben Fetch — compile wartet, statt parallel ins Leere zu laufen. */
  #inflight = /* @__PURE__ */ new Map();
  #basePath;
  #catalog = null;
  #catalogPromise = null;
  #indexPath;

  constructor(config = {}) {
    const options = typeof config === "string" ? { basePath: config } : config;
    const {
      basePath = new URL("../templates/", import.meta.url).href,
      autoInit = false,
      catalog = null,
      indexPath = "manifests/templates/templates-index-manifest.json"
    } = options;
    this.#basePath = basePath.endsWith("/") ? basePath : `${basePath}/`;
    this.#indexPath = indexPath || "manifests/templates/templates-index-manifest.json";
    if (catalog && typeof catalog === "object") {
      this.#catalog = catalog;
    }
    if (autoInit) {
      this.init();
    }
  }

  /** Optional: Steine aus `<template data-config>` im Dokument, über denselben Hydrator. */
  init() {
    const templateElements = document.querySelectorAll("template");
    templateElements.forEach((el) => {
      if (!(el instanceof HTMLTemplateElement) || !el.hasAttribute("data-config")) {
        return;
      }
      try {
        const source = TemplateBrickHydrator.hydrate({ html: el.outerHTML });
        const templateData = this.#normalizeTemplate(source.name, source.config, source.layoutHtml);
        this.#cache.set(source.name, templateData);
      } catch (error) {
        DebugAgent.error(`[TemplateService.init()] JSON-Parse-Fehler bei Template #${el.id}`, error);
      }
    });
    DebugAgent.info(`[TemplateService.init()] ${this.#cache.size} Steine aus dem DOM geladen.`);
  }

  has(name) {
    return this.#cache.has(name);
  }

  clearCache() {
    this.#cache.clear();
    this.#resources.clear();
    this.#inflight.clear();
  }

  /**
   * Stein oder Blueprint aus dem Katalog (geteilt bei parallelen Aufrufen).
   * @param {string} name
   * @returns {Promise<CatalogResource|null>}
   */
  async resolve(name) {
    if (this.#resources.has(name)) {
      return this.#resources.get(name) ?? null;
    }
    const pending = this.#inflight.get(name);
    if (pending) {
      return pending;
    }
    const loading = this.#loadResource(name).catch((error) => {
      DebugAgent.error(`[TemplateService.resolve()] '${name}' fehlgeschlagen.`, error);
      return null;
    }).finally(() => {
      this.#inflight.delete(name);
    });
    this.#inflight.set(name, loading);
    return loading;
  }

  /**
   * @param {string} name
   * @returns {Promise<NormalizedTemplate|null>}
   */
  async get(name) {
    if (this.#cache.has(name)) {
      return this.#cache.get(name) ?? null;
    }
    const resource = await this.resolve(name);
    if (!resource || resource.kind !== "brick" || !resource.brick) {
      return this.#cache.get(name) ?? null;
    }
    return this.#cache.get(name) ?? null;
  }

  /**
   * @param {string} name
   * @param {CompilePayload | Object<string, unknown>} payload
   * @returns {Element | null}
   */
  compile(name, payload = {}) {
    const template = this.#cache.get(name);
    if (!template) {
      return null;
    }
    const packed = this.#asPayload(payload);
    return this.#compileHtml(template.html, template.slotDefs ?? [], packed, template);
  }

  getTemplateEvents(name) {
    return this.#cache.get(name)?.events ?? {};
  }

  /**
   * @param {string} name
   * @returns {Promise<CatalogResource|null>}
   */
  async #loadResource(name) {
    await this.#ensureCatalog();
    const resource = await TemplateCatalog.fetch(this.#catalog, name, this.#basePath);
    this.#resources.set(name, resource);
    if (resource.kind === "brick" && resource.brick) {
      const source = resource.brick;
      const templateData = this.#normalizeTemplate(source.name, source.config, source.layoutHtml, source.parts);
      this.#cache.set(source.name, templateData);
      if (name !== source.name) {
        this.#cache.set(name, templateData);
      }
    }
    return resource;
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

  /**
   * @param {CompilePayload | Object<string, unknown>} payload
   * @returns {CompilePayload}
   */
  #asPayload(payload) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return { data: {}, attributes: {}, slots: {} };
    }
    const hasSlots = payload.slots && typeof payload.slots === "object";
    const hasAttributes = payload.attributes && typeof payload.attributes === "object";
    const nestedData = payload.data && typeof payload.data === "object" && !Array.isArray(payload.data);
    if (hasSlots || (hasAttributes && nestedData)) {
      return {
        data: nestedData ? payload.data : {},
        attributes: hasAttributes ? payload.attributes : {},
        slots: hasSlots ? payload.slots : {}
      };
    }
    return { data: payload, attributes: {}, slots: {} };
  }

  #replacePlaceholders(html, sortedEntries, values) {
    let result = html;
    for (const [key, placeholder] of sortedEntries) {
      const rawValue = values[key] ?? "";
      const cleanValue = TemplateBrickHydrator.clean(rawValue);
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
    workingHtml = this.#stripAttrTokens(workingHtml);
    const packed = this.#packTableFragment(workingHtml);
    const fragment = document.createRange().createContextualFragment(packed.html);
    const element = packed.unwrap(fragment);
    if (!element) {
      DebugAgent.error("[TemplateService.#compileHtml()] Transformation in den DOM fehlgeschlagen.");
      return null;
    }
    this.#applyAttributeMap(element, payloadAttributes);
    this.#fillSlots(element, slotDefs, payload, template);
    return element;
  }

  #packTableFragment(html) {
    const trimmed = String(html).trim();
    const match = trimmed.match(/^<(thead|tbody|tfoot|tr|th|td)\b/i);
    if (!match) {
      return { html, unwrap: (fragment) => fragment.firstElementChild };
    }
    const tag = match[1].toLowerCase();
    if (tag === "thead" || tag === "tbody" || tag === "tfoot") {
      return {
        html: `<table>${trimmed}</table>`,
        unwrap: (fragment) => fragment.querySelector(tag)
      };
    }
    if (tag === "tr") {
      return {
        html: `<table><tbody>${trimmed}</tbody></table>`,
        unwrap: (fragment) => fragment.querySelector("tr")
      };
    }
    return {
      html: `<table><tbody><tr>${trimmed}</tr></tbody></table>`,
      unwrap: (fragment) => fragment.querySelector(tag)
    };
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
    const walker = document.createTreeWalker(
      rootElement,
      NodeFilter.SHOW_TEXT | NodeFilter.SHOW_COMMENT
    );
    let currentNode = walker.nextNode();
    while (currentNode) {
      if (currentNode.nodeValue && currentNode.nodeValue.includes(placeholder)) {
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
      if (seen.has(token) || token.startsWith("slot") || token.endsWith("-slot") || token.endsWith("-loop")) {
        continue;
      }
      seen.add(token);
      tokens.push(token);
    }
    tokens.sort((a, b) => b.length - a.length);
    let result = html;
    for (let i = 0; i < tokens.length; i += 1) {
      const token = tokens[i];
      if (token.startsWith("attr")) {
        continue;
      }
      const rawValue = token in values ? values[token] : "";
      result = result.replaceAll(`{{${token}}}`, TemplateBrickHydrator.clean(rawValue));
    }
    return result;
  }

  /** Übrig gebliebene `{{attr*}}`-Token nicht als Attribut-Blob einsetzen. */
  #stripAttrTokens(html) {
    return String(html).replace(/\{\{attr[a-zA-Z0-9_-]*\}\}/g, "");
  }

  /**
   * @param {Element} element
   * @param {Object<string, unknown>} attributes
   */
  #applyAttributeMap(element, attributes) {
    const bag = attributes && typeof attributes === "object" ? attributes : {};
    const keys = Object.keys(bag);
    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i];
      if (key.startsWith("attr")) {
        continue;
      }
      const value = bag[key];
      if (value === null || value === void 0 || value === "") {
        continue;
      }
      element.setAttribute(key, TemplateBrickHydrator.attr(value));
    }
  }

  #appendSlotChild(parent, targetNode, content) {
    if (content instanceof Node) {
      parent.insertBefore(content, targetNode);
    } else if (typeof content === "string") {
      parent.insertBefore(document.createTextNode(String(content)), targetNode);
    }
  }

  #normalizeTemplate(id, config, htmlString, partHtml = {}) {
    const placeholders = config.placeholder || { ...config.slots, ...config.attributes };
    const classified = this.#classifyPlaceholders(placeholders);
    const layoutDefs = this.#slotDefsInHtml(htmlString, config, Object.keys(partHtml || {}));
    const parts = {};
    const partKeys = Object.keys(partHtml || {});
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
      role: config.partial ? "partial" : (config.role || "container"),
      isRoot: config.isRoot === true,
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
      if (cleanKey.startsWith("slot") || cleanKey.endsWith("-slot") || cleanKey.endsWith("-loop")) {
        slots[cleanKey] = placeholder;
      } else if (cleanKey.startsWith("attr")) {
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
    const tokens = source.match(/\{\{([a-zA-Z0-9_-]+)\}\}/g) || [];
    for (let i = 0; i < tokens.length; i += 1) {
      const placeholder = tokens[i];
      if (seen.has(placeholder)) {
        continue;
      }
      const token = placeholder.replace(/\{\{|\}\}/g, "");
      if (token.startsWith("slot") || token.endsWith("-slot")) {
        seen.add(placeholder);
        defs.push({
          key: token,
          part: token,
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
    return key;
  }
}

export {
  TemplateService
};
