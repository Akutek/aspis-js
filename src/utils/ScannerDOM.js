/** @typedef {import("../types/managers.js").ControllerScanResult} ControllerScanResult */
import { DebugAgent } from "../agents/DebugAgent.js";
import { ControllerTrigger } from "./ControllerTrigger.js";
class ScannerDOM {
  /** Durchsucht ein DOM-Element und dessen Kinder nach Elementen mit dem Attribut `data-controller`. */
  static scan(rootElement = document.body) {
    if (!rootElement || typeof rootElement.querySelectorAll !== "function") {
      DebugAgent.warn("[ScannerDOM.scan()] Aspis [ScannerDOM]: Ung\xFCltiges oder fehlendes Root-Element \xFCbergeben. Scan abgebrochen.");
      return [];
    }
    const scanResults = [];
    if (typeof rootElement.matches === "function" && rootElement.matches("[data-controller]")) {
      const parsed = this.#parseNode(rootElement);
      if (parsed) scanResults.push(parsed);
    }
    const elements = rootElement.querySelectorAll("[data-controller]");
    for (const element of elements) {
      const parsed = this.#parseNode(element);
      if (parsed) scanResults.push(parsed);
    }
    return scanResults;
  }
  /** Liest die Controller-Metadaten (`data-controller` und `data-layout`) aus einem einzelnen DOM-Node aus. */
  static #parseNode(container) {
    const rawType = container.dataset.controller || container.getAttribute("data-controller");
    const type = ControllerTrigger.normalize(rawType);
    if (!type) {
      DebugAgent.warn("[ScannerDOM.#parseNode()] Aspis [ScannerDOM]: Element mit leerem 'data-controller'-Attribut \xFCbersprungen:", container);
      return null;
    }
    const layout = container.dataset.layout || container.getAttribute("data-layout") || "default";
    const sliceKey = container.dataset.sliceKey || container.getAttribute("data-slice-key") || "";
    return {
      element: container,
      type,
      layout: layout.trim(),
      sliceKey: sliceKey.trim() || null
    };
  }
}
export {
  ScannerDOM
};
