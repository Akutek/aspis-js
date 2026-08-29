/** @typedef {import("../types/templates.js").TemplateConfig} TemplateConfig */
/** @typedef {import("../types/templates.js").TemplateSource} TemplateSource */
import { BaseHydrator } from "./BaseHydrator.js";
import { asRecord } from "./helpers/asRecord.js";
import { TemplateGuardDOM } from "../utils/TemplateGuardDOM.js";
import { DebugAgent } from "../agents/DebugAgent.js";

const FORBIDDEN_TAGS = new Set([
  "SCRIPT",
  "IFRAME",
  "OBJECT",
  "EMBED",
  "FRAME",
  "FRAMESET",
  "META",
  "LINK",
  "BASE",
  "NOSCRIPT",
  "APPLET"
]);

const URI_ATTRIBUTES = new Set([
  "href",
  "src",
  "action",
  "data",
  "poster",
  "formaction",
  "xlink:href",
  "xml:base"
]);

const NAME_TOKEN = /^[a-zA-Z0-9_-]+$/;

/**
 * Ein Hydrator zwischen Template-Datei (`<template data-config>`) und TemplateService.
 * Sanitize von Markup, Platzhaltertext und Attributwerten liegt hier, nicht im Service.
 */
class TemplateBrickHydrator extends BaseHydrator {
  /**
   * HTML-String oder `{ html }`.
   * @param {unknown} rawData
   * @returns {TemplateSource}
   */
  static hydrate(rawData) {
    if (typeof rawData === "string") {
      return super.hydrate({ html: rawData });
    }
    return super.hydrate(rawData);
  }

  /**
   * @param {unknown} rawData
   * @returns {TemplateSource}
   */
  static transform(rawData) {
    const raw = asRecord(rawData);
    const html = typeof raw.html === "string" ? raw.html : "";
    const parsed = this.#parseTemplate(html);
    const config = this.#sanitizeConfig(parsed.config);
    const markup = this.sanitizeHtml(parsed.html);
    const name = config.name || this.#token(parsed.id);
    if (!name) {
      throw new Error("Aspis [TemplateBrickHydrator]: Stein braucht name oder template-id.");
    }
    if (!markup.trim()) {
      throw new Error(`Aspis [TemplateBrickHydrator]: Stein '${name}' ohne Markup.`);
    }
    return {
      name,
      config: { ...config, name },
      layoutHtml: markup,
      parts: {}
    };
  }

  /**
   * Text für HTML-Platzhalter (User-Daten). Entities, kein Markup.
   * @param {unknown} value
   * @returns {string}
   */
  static clean(value) {
    if (typeof TemplateGuardDOM.clean === "function") {
      const cleaned = TemplateGuardDOM.clean(value);
      return cleaned === null || cleaned === void 0 ? "" : String(cleaned);
    }
    if (value === null || value === void 0) {
      return "";
    }
    if (typeof value === "boolean" || typeof value === "number") {
      return String(value);
    }
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /**
   * Wert für `setAttribute` (kein HTML-Escape). Unsichere Protokolle → `#`.
   * @param {unknown} value
   * @returns {string}
   */
  static attr(value) {
    if (value === null || value === void 0) {
      return "";
    }
    const text = String(value);
    const normalized = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, "").trim().toLowerCase();
    if (
      normalized.startsWith("javascript:")
      || normalized.startsWith("vbscript:")
      || normalized.startsWith("data:text/html")
      || normalized.startsWith("data:image/svg+xml")
      || normalized.startsWith("data:application/")
    ) {
      return "#";
    }
    return text;
  }

  /**
   * Template-Markup: gefährliche Tags/Handler raus, Form/Table bleiben.
   * @param {unknown} rawHTML
   * @returns {string}
   */
  static sanitizeHtml(rawHTML) {
    if (typeof rawHTML !== "string") {
      return "";
    }
    const packed = this.#packTableFragment(rawHTML);
    const parser = new DOMParser();
    const doc = parser.parseFromString(packed.html, "text/html");
    const allElements = doc.body.querySelectorAll("*");
    allElements.forEach((element) => {
      const tagName = element.tagName.toUpperCase();
      if (FORBIDDEN_TAGS.has(tagName)) {
        element.remove();
        DebugAgent.warn(
          `[TemplateBrickHydrator.sanitizeHtml()] Gefährlicher Tag <${tagName.toLowerCase()}> entfernt.`
        );
        return;
      }
      const names = element.getAttributeNames
        ? element.getAttributeNames()
        : Array.from(element.attributes).map((attr) => attr.name);
      names.forEach((attrName) => {
        const lower = attrName.toLowerCase();
        const rawValue = element.getAttribute(attrName) || "";
        const normalized = rawValue.replace(/[\x00-\x20\x7F-\x9F]/g, "").toLowerCase();
        if (lower.startsWith("on")) {
          element.removeAttribute(attrName);
          DebugAgent.warn(
            `[TemplateBrickHydrator.sanitizeHtml()] Event-Handler '${attrName}' entfernt.`
          );
          return;
        }
        if (URI_ATTRIBUTES.has(lower) || lower.endsWith(":href")) {
          const dangerous = normalized.startsWith("javascript:")
            || normalized.startsWith("vbscript:")
            || normalized.startsWith("data:text/html")
            || normalized.startsWith("data:image/svg+xml")
            || normalized.startsWith("data:application/");
          if (dangerous && !rawValue.includes("{{")) {
            element.setAttribute(attrName, "#");
            DebugAgent.warn(
              `[TemplateBrickHydrator.sanitizeHtml()] Unsichere URL in '${attrName}' auf '#' gesetzt.`
            );
          }
        }
      });
    });
    return packed.unwrap(doc);
  }

  /**
   * thead/tbody/tr parst der HTML-Parser nur im Table-Kontext.
   * @param {string} html
   * @returns {{ html: string, unwrap: (doc: Document) => string }}
   */
  static #packTableFragment(html) {
    const trimmed = String(html).trim();
    const match = trimmed.match(/^<(thead|tbody|tfoot|tr|th|td)\b/i);
    if (!match) {
      return { html, unwrap: (doc) => doc.body.innerHTML };
    }
    const tag = match[1].toLowerCase();
    if (tag === "thead" || tag === "tbody" || tag === "tfoot") {
      return {
        html: `<table>${trimmed}</table>`,
        unwrap: (doc) => {
          const node = doc.querySelector(tag);
          return node ? node.outerHTML : trimmed;
        }
      };
    }
    if (tag === "tr") {
      return {
        html: `<table><tbody>${trimmed}</tbody></table>`,
        unwrap: (doc) => {
          const node = doc.querySelector("tr");
          return node ? node.outerHTML : trimmed;
        }
      };
    }
    return {
      html: `<table><tbody><tr>${trimmed}</tr></tbody></table>`,
      unwrap: (doc) => {
        const node = doc.querySelector(tag);
        return node ? node.outerHTML : trimmed;
      }
    };
  }

  /**
   * @param {string} html
   * @returns {{ id: string, config: TemplateConfig, html: string }}
   */
  static #parseTemplate(html) {
    const trimmed = String(html || "").trim();
    if (!trimmed) {
      throw new Error("Aspis [TemplateBrickHydrator]: Leere Template-Datei.");
    }
    const holder = document.createElement("template");
    holder.innerHTML = trimmed;
    const el = holder.content.querySelector("template");
    const node = el instanceof HTMLTemplateElement
      ? el
      : holder.content.firstElementChild instanceof HTMLTemplateElement
        ? holder.content.firstElementChild
        : null;
    if (node) {
      const configAttr = node.getAttribute("data-config")
        || node.dataset.config
        || node.getAttribute("data-aspis-config")
        || "{}";
      let config = {};
      try {
        config = JSON.parse(configAttr);
      } catch {
        throw new Error(
          `Aspis [TemplateBrickHydrator]: data-config ist kein JSON (${node.id || "?"}).`
        );
      }
      if (!config || typeof config !== "object" || Array.isArray(config)) {
        throw new Error("Aspis [TemplateBrickHydrator]: data-config muss ein Objekt sein.");
      }
      return {
        id: node.id || "",
        config: /** @type {TemplateConfig} */ (config),
        html: node.innerHTML
      };
    }
    return {
      id: "",
      config: {},
      html: trimmed
    };
  }

  /**
   * @param {TemplateConfig} config
   * @returns {TemplateConfig}
   */
  static #sanitizeConfig(config) {
    const bag = asRecord(config);
    const name = this.#token(typeof bag.name === "string" ? bag.name : "");
    const role = this.#token(typeof bag.role === "string" ? bag.role : "");
    return {
      name,
      ...role ? { role } : {},
      isRoot: bag.isRoot === true,
      partial: bag.partial === true,
      slots: this.#stringMap(bag.slots),
      attributes: this.#stringMap(bag.attributes),
      placeholder: this.#stringMap(bag.placeholder),
      events: bag.events && typeof bag.events === "object" ? asRecord(bag.events) : {},
      styles: bag.styles && typeof bag.styles === "object" ? asRecord(bag.styles) : {},
      targets: bag.targets && typeof bag.targets === "object" ? asRecord(bag.targets) : {},
      bindings: bag.bindings && typeof bag.bindings === "object" ? asRecord(bag.bindings) : {}
    };
  }

  /**
   * Katalog-/Slot-Namen, kein HTML-Escape.
   * @param {unknown} value
   * @returns {string}
   */
  static #token(value) {
    const text = String(value || "").trim();
    if (!text || !NAME_TOKEN.test(text)) {
      return "";
    }
    return text;
  }

  /**
   * @param {unknown} value
   * @returns {Object<string, string>}
   */
  static #stringMap(value) {
    if (value == null) {
      return {};
    }
    const bag = asRecord(value);
    const out = {};
    const keys = Object.keys(bag);
    for (let i = 0; i < keys.length; i += 1) {
      const key = this.#token(keys[i]);
      const text = typeof bag[keys[i]] === "string" ? bag[keys[i]].trim() : "";
      if (!key || !text) {
        continue;
      }
      out[key] = text.startsWith("{{") ? text : this.clean(text);
    }
    return out;
  }
}

export {
  TemplateBrickHydrator
};
