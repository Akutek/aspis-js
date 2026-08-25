import { DebugAgent } from "../agents/DebugAgent.js";
import { RuntimeEnv } from "../core/RuntimeEnv.js";
class GuardDOM {
  /**
   * Konvertiert unsichere Eingaben in HTML-escapeten Text.
   * `boolean` und `number` bleiben unverändert, `null` und `undefined` werden `""`.
   */
  static clean(unsafeText) {
    if (typeof unsafeText === "boolean" || typeof unsafeText === "number") return unsafeText;
    if (unsafeText === null || unsafeText === void 0) return "";
    const str = String(unsafeText);
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }
  /**
   * Bereinigt einen HTML-String auf XSS-Resilienz.
   * Nutzt primär DOMPurify, falls über RuntimeEnv lesbar,
   * und fällt andernfalls auf eine gehärtete Inhouse-Sanitization (Zero-Dependency) zurück.
   */
  static purify(rawHTML, options = {}) {
    if (typeof rawHTML !== "string") {
      return rawHTML;
    }
    const globalPurify = RuntimeEnv.domPurify();
    if (globalPurify && typeof globalPurify.sanitize === "function") {
      return globalPurify.sanitize(rawHTML, options);
    }
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawHTML, "text/html");
    const forbiddenTags = /* @__PURE__ */ new Set([
      "SCRIPT",
      "IFRAME",
      "OBJECT",
      "EMBED",
      "FRAME",
      "FRAMESET",
      "STYLE",
      "META",
      "LINK",
      "BASE",
      "TEMPLATE",
      "NOSCRIPT",
      "APPLET",
      "FORM",
      "MATH"
    ]);
    const uriAttributes = /* @__PURE__ */ new Set([
      "href",
      "src",
      "action",
      "data",
      "poster",
      "formaction",
      "xlink:href",
      "xml:base"
    ]);
    const allElements = doc.body.querySelectorAll("*");
    allElements.forEach((element) => {
      const tagName = element.tagName.toUpperCase();
      if (forbiddenTags.has(tagName)) {
        element.remove();
        DebugAgent.warn(`[GuardDOM.purify()] Aspis [GuardDOM]: Gef\xE4hrlicher Tag <${tagName.toLowerCase()}> wurde entfernt.`);
        return;
      }
      const attributeNames = element.getAttributeNames ? element.getAttributeNames() : Array.from(element.attributes).map((a) => a.name);
      attributeNames.forEach((attrName) => {
        const lowerAttrName = attrName.toLowerCase();
        const rawAttrValue = element.getAttribute(attrName) || "";
        const normalizedValue = rawAttrValue.replace(/[\x00-\x20\x7F-\x9F]/g, "").toLowerCase();
        if (lowerAttrName.startsWith("on")) {
          element.removeAttribute(attrName);
          DebugAgent.warn(`[GuardDOM.purify()] Aspis [GuardDOM]: Event-Handler '${attrName}' entfernt.`);
          return;
        }
        if (uriAttributes.has(lowerAttrName) || lowerAttrName.endsWith(":href")) {
          const isDangerousProtocol = normalizedValue.startsWith("javascript:") || normalizedValue.startsWith("vbscript:") || normalizedValue.startsWith("data:text/html") || normalizedValue.startsWith("data:image/svg+xml") || normalizedValue.startsWith("data:application/");
          if (isDangerousProtocol) {
            element.setAttribute(attrName, "#");
            DebugAgent.warn(`[GuardDOM.purify()] Aspis [GuardDOM]: Unsichere URL in '${attrName}' auf '#' zur\xFCckgesetzt.`);
          }
        }
      });
    });
    return doc.body.innerHTML;
  }
}
export {
  GuardDOM
};
