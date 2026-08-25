/** @typedef {import("../types/managers.js").Registry} Registry */
/** @typedef {import("../types/agents.js").DebugManifest} DebugManifest */
/** @typedef {import("../types/agents.js").ErrorManifest} ErrorManifest */
/** @typedef {import("../types/registry.js").AppConfig} AppConfig */
/** @typedef {import("../types/store.js").StateManifest} StateManifest */
/** @typedef {import("../types/events.js").EventManifest} EventManifest */
/** @typedef {import("../types/importer.js").ImportRoute} ImportRoute */
import { CacheManager } from "./CacheManager.js";
import { DebugErrorManager } from "./DebugErrorManager.js";
import { ImportManager } from "./ImportManager.js";
import { BaseManager } from "./BaseManager.js";
import { RegistryManager } from "./RegistryManager.js";
import { RegistryManifestHydrator } from "../hydrators/RegistryManifestHydrator.js";
import { DebugManifestHydrator } from "../hydrators/DebugManifestHydrator.js";
import { ErrorManifestHydrator } from "../hydrators/ErrorManifestHydrator.js";
import { StateManifestHydrator } from "../hydrators/StateManifestHydrator.js";
import { AppConfigHydrator } from "../hydrators/AppConfigHydrator.js";
import { RouteIndexHydrator } from "../hydrators/RouteIndexHydrator.js";
import { EventManifestHydrator } from "../hydrators/EventManifestHydrator.js";
import { StoreExtension } from "../extensions/store/StoreExtension.js";
import { TemplateService } from "../services/TemplateService.js";
import { TemplateRenderService } from "../services/TemplateRenderService.js";
import { EventDispatcher } from "../services/EventDispatcher.js";
import { ControllerDataFetcher } from "../services/ControllerDataFetcher.js";
import { ControllerCleaner } from "../services/ControllerCleaner.js";
import { SchemaCatalog } from "../services/schema/SchemaCatalog.js";
import { TemplateCatalog } from "../services/template/TemplateCatalog.js";
import { AssetPath } from "../core/AssetPath.js";
class BootManager extends BaseManager {
  static async boot() {
    const debugError = DebugErrorManager.init();
    const cache = CacheManager.init();
    const registry = RegistryManager.init(cache);
    try {
      RegistryManager.register(registry, {
        debug: debugError.debug,
        error: debugError.error,
        cache
      });
      ImportManager.init(registry);
      const appConfig = await RegistryManager.load("config/app-config.json", AppConfigHydrator);
      CacheManager.set(cache, "manifest:app-config", appConfig);
      RegistryManager.register(registry, "config", appConfig);
      if (appConfig.publicPaths?.base) {
        AssetPath.configure(appConfig.publicPaths.base);
      }
      const registryCardinal = appConfig.cardinals?.["registry-manifest"];
      const registryManifestPath = registryCardinal ? AssetPath.join(registryCardinal.directory, registryCardinal.file) : AssetPath.resolve("manifests/registry-manifest.json");
      const registryManifest = await RegistryManager.load(
        registryManifestPath,
        RegistryManifestHydrator
      );
      CacheManager.set(cache, "manifest:registry", registryManifest);
      RegistryManager.register(registry, "registryManifest", registryManifest);
      registry.expand({ manifest: registryManifest });
      ImportManager.apply(registry, registryManifest);
      const debugCardinal = registryManifest.errorAndDebug?.debug;
      const debugManifestPath = debugCardinal ? AssetPath.join(debugCardinal.directory, debugCardinal.file) : AssetPath.resolve("manifests/debug/debug-index-manifest.json");
      const debugManifest = await RegistryManager.load(
        debugManifestPath,
        DebugManifestHydrator
      );
      CacheManager.set(cache, "manifest:debug", debugManifest);
      RegistryManager.register(registry, "debugManifest", debugManifest);
      const errorCardinal = registryManifest.errorAndDebug?.error;
      const errorManifestPath = errorCardinal ? AssetPath.join(errorCardinal.directory, errorCardinal.file) : AssetPath.resolve("manifests/error/error-index-manifest.json");
      const errorManifest = await RegistryManager.load(
        errorManifestPath,
        ErrorManifestHydrator
      );
      CacheManager.set(cache, "manifest:error", errorManifest);
      RegistryManager.register(registry, "errorManifest", errorManifest);
      DebugErrorManager.apply(debugError, debugManifest, errorManifest, registry);
      const stateRoute = await this.#indexFile(
        registryManifest.manifestRouting?.states,
        "manifestRouting.states",
        "state"
      );
      const stateManifest = await RegistryManager.load(
        AssetPath.join(stateRoute.directory, stateRoute.file),
        StateManifestHydrator
      );
      CacheManager.set(cache, "manifest:state", stateManifest);
      RegistryManager.register(registry, "stateManifest", stateManifest);
      const store = this.store(registry);
      if (store) {
        StoreExtension.apply(store, stateManifest);
      }
      const schemaRoute = registryManifest.manifestRouting?.schemas;
      if (!schemaRoute?.directory || !schemaRoute?.file) {
        throw new Error("Aspis [BootManager.boot()]: manifestRouting.schemas fehlt.");
      }
      const schemas = await SchemaCatalog.load(AssetPath.join(schemaRoute.directory, schemaRoute.file));
      CacheManager.set(cache, "manifest:index:schemas", schemas);
      RegistryManager.register(registry, "schemaManifest", schemas);
      const cleaner = new ControllerCleaner(registry);
      const templateRoute = registryManifest.manifestRouting?.templates;
      if (!templateRoute?.directory || !templateRoute?.file) {
        throw new Error("Aspis [BootManager.boot()]: manifestRouting.templates fehlt.");
      }
      const templateIndexPath = AssetPath.join(templateRoute.directory, templateRoute.file);
      const templateIndex = await TemplateCatalog.load(templateIndexPath);
      CacheManager.set(cache, "manifest:index:templates", templateIndex);
      RegistryManager.register(registry, "templateManifest", templateIndex);
      const templates = new TemplateService({
        basePath: AssetPath.resolve("templates/"),
        indexPath: templateIndexPath,
        catalog: templateIndex
      });
      const eventRoute = await this.#indexFile(
        registryManifest.manifestRouting?.events,
        "manifestRouting.events",
        "events"
      );
      const eventManifest = await RegistryManager.load(
        AssetPath.join(eventRoute.directory, eventRoute.file),
        EventManifestHydrator
      );
      CacheManager.set(cache, "manifest:events", eventManifest);
      RegistryManager.register(registry, "eventManifest", eventManifest);
      const renderService = new TemplateRenderService(templates, cleaner);
      RegistryManager.register(registry, {
        fetcher: new ControllerDataFetcher(),
        dispatcher: new EventDispatcher(eventManifest),
        cleaner,
        templates,
        renderService,
        assetPath: AssetPath
      });
      this.info(registry, `Boot abgeschlossen. Asset-Root: ${AssetPath.root}`);
      return registry;
    } catch (error) {
      this.capture(registry, error);
      return null;
    }
  }
  static async #indexFile(routing, label, entryName) {
    if (!routing?.directory || !routing?.file) {
      throw new Error(`Aspis [BootManager.boot()]: ${label} fehlt.`);
    }
    const index = await RegistryManager.load(
      AssetPath.join(routing.directory, routing.file),
      RouteIndexHydrator
    );
    const entry = index[entryName];
    if (!entry?.directory || !entry?.file) {
      throw new Error(`Aspis [BootManager.boot()]: ${label} ohne Eintrag '${entryName}'.`);
    }
    return entry;
  }
}
export {
  BootManager
};
