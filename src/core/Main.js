/** @typedef {import("../types/registry.js").AppConfig} AppConfig */
/** @typedef {import("../types/registry.js").EventManifest} EventManifest */
/** @typedef {import("../types/store.js").StateManifest} StateManifest */
/** @typedef {import("../types/managers.js").ControllerScanResult} ControllerScanResult */
import { Store } from "./Store.js";
import { ControllerCleaner } from "../services/ControllerCleaner.js";
import { DebugAgent } from "../agents/DebugAgent.js";
import { TemplateService } from "../services/TemplateService.js";
import { RenderService } from "../services/RenderService.js";
import { DataFetcher } from "../services/DataFetcher.js";
import { EventDispatcher } from "../services/EventDispatcher.js";
import { ScannerDOM } from "../utils/ScannerDOM.js";
import { ModifierDOM } from "../utils/ModifierDOM.js";
import { ControllerRegistry } from "./ControllerRegistry.js";
import { Registry } from "./Registry.js";
class Main {
  /**
   * Bootet das Framework asynchron: Lädt Konfigurationen, baut den Service-Container
   * auf, scannt den DOM-Baum und startet alle Controller.
   *
   * Wirft, wenn `controllerRegistry` fehlt oder keine `getAsync`-Methode besitzt.
   */
  static async boot(controllerRegistry) {
    if (!controllerRegistry || typeof controllerRegistry.getAsync !== "function") {
      throw new Error("Aspis [Main]: Ung\xFCltige oder fehlende ControllerRegistry \xFCbergeben.");
    }
    try {
      const [config, stateManifest, eventManifest] = await Promise.all([
        fetch("./js/aspis/core/app-config.json").then((res) => {
          if (!res.ok) throw new Error("app-config.json konnte nicht geladen werden");
          return res.json();
        }),
        fetch("./js/aspis/core/state-manifest.json").then((res) => {
          if (!res.ok) throw new Error("state-manifest.json konnte nicht geladen werden");
          return res.json();
        }),
        fetch("./js/aspis/core/event-manifest.json").then((res) => {
          if (!res.ok) return {};
          return res.json();
        }).catch(() => ({}))
      ]);
      const services = this.createServices(controllerRegistry, config, stateManifest, eventManifest);
      const scanResults = ScannerDOM.scan(document.body);
      await this.assignControllers(scanResults, services);
      DebugAgent.info("[Main.boot()] Anwendung erfolgreich gebootet.");
      return services;
    } catch (error) {
      DebugAgent.error("[Main.boot()] Kritischer Fehler beim Bootstrapping der Anwendung:", error);
    }
  }
  static autoBoot(registryPath = "./controllers") {
    const start = () => {
      const loader = new ControllerRegistry(registryPath);
      this.boot(loader);
    };
    if (document.readyState === "loading") {
      window.addEventListener("DOMContentLoaded", start);
    } else {
      start();
    }
  }
  static createServices(controllerRegistry, config, manifest, eventManifest) {
    const registry = new Registry();
    const cleaner = new ControllerCleaner(registry);
    const templates = new TemplateService();
    const renderService = new RenderService(templates, cleaner);
    DebugAgent.init(manifest.settings?.debug ?? config.debug);
    registry.set("debug", DebugAgent.shared());
    registry.set("controllerRegistry", controllerRegistry);
    registry.set("config", config);
    registry.set("store", new Store(manifest));
    registry.set("eventManifest", eventManifest || {});
    registry.set("fetcher", new DataFetcher());
    registry.set("dispatcher", new EventDispatcher());
    registry.set("modifierDOM", ModifierDOM);
    registry.set("cleaner", cleaner);
    registry.set("templates", templates);
    registry.set("renderService", renderService);
    return registry;
  }
  static async assignControllers(scanResults, registry) {
    const promises = scanResults.map((detectedNode) => {
      return this.startController(detectedNode, registry);
    });
    await Promise.all(promises);
  }
  static async startController(item, registry) {
    const config = registry.get("config");
    const componentConfig = config.components?.[item.type] || {};
    const controllerClassName = componentConfig.type || item.type;
    const controllerRegistry = registry.get("controllerRegistry");
    const ControllerClass = await controllerRegistry.getAsync(controllerClassName);
    if (!ControllerClass) {
      DebugAgent.warn(`[Main.startController()] Dynamischer Lookup fehlgeschlagen. Controller '${controllerClassName}' ist nicht in der Registry registriert.`);
      return;
    }
    try {
      const store = registry.get("store");
      const dispatcher = registry.get("dispatcher");
      const renderService = registry.get("renderService");
      const eventsBase = config.publicPaths?.events || "/src/events";
      const eventPath = componentConfig.events ? `${eventsBase}/${componentConfig.events}` : null;
      const sliceKey = componentConfig.sliceKey || null;
      const controllerInstance = new ControllerClass(item.element, store, dispatcher, {
        eventPath,
        sliceKey,
        registry,
        renderService
      });
      controllerInstance.layout = item.layout;
      registry.set(item.element, controllerInstance);
      const dependsOnAttr = item.element.dataset.dependsOn || item.element.getAttribute("data-depends-on");
      if (dependsOnAttr && typeof store.addDependency === "function") {
        const paths = dependsOnAttr.split(",").map((path) => path.trim()).filter(Boolean);
        paths.forEach((path) => {
          store.addDependency(item.element, path);
          DebugAgent.info(`[Main.startController()] Reaktive PHP-Abh\xE4ngigkeit registriert: <${item.type}> lauscht auf Pfad '${path}'`);
        });
      }
      await controllerInstance.start();
    } catch (error) {
      DebugAgent.error(`[Main.startController()] Fehler im Lebenszyklus beim Starten des Controllers '${item.type}':`, error);
    }
  }
}
export {
  Main
};
