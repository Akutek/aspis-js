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
import { Channel } from "../core/Channel.js";
class BootManager extends BaseManager {
  static async boot() {
    const debugError = DebugErrorManager.init();
    const cache = CacheManager.init();
    const registry = RegistryManager.init(cache);
    const bootAt = this.#now();
    try {
      RegistryManager.register(registry, {
        debug: debugError.debug,
        error: debugError.error,
        cache
      });
      ImportManager.init(registry);
      const dispatcher = new EventDispatcher({});
      RegistryManager.register(registry, "dispatcher", dispatcher);
      this.#bootPhase(registry, "cardinals", "start");
      const cardinalsAt = this.#now();
      const appPart = await this.#measure(() => RegistryManager.load("config/app-config.json", AppConfigHydrator));
      const appConfig = appPart.value;
      CacheManager.set(cache, "manifest:app-config", appConfig);
      RegistryManager.register(registry, "config", appConfig);
      if (appConfig.publicPaths?.base) {
        AssetPath.configure(appConfig.publicPaths.base);
      }
      const registryCardinal = appConfig.cardinals?.["registry-manifest"];
      const registryManifestPath = registryCardinal ? AssetPath.join(registryCardinal.directory, registryCardinal.file) : AssetPath.resolve("manifests/registry-manifest.json");
      const registryPart = await this.#measure(() => RegistryManager.load(
        registryManifestPath,
        RegistryManifestHydrator
      ));
      const registryManifest = registryPart.value;
      CacheManager.set(cache, "manifest:registry", registryManifest);
      RegistryManager.register(registry, "registryManifest", registryManifest);
      registry.expand({ manifest: registryManifest });
      ImportManager.apply(registry, registryManifest);
      this.#bootPhase(registry, "cardinals", "done", cardinalsAt);
      const debugCardinal = registryManifest.errorAndDebug?.debug;
      const debugManifestPath = debugCardinal ? AssetPath.join(debugCardinal.directory, debugCardinal.file) : AssetPath.resolve("manifests/debug/debug-index-manifest.json");
      const errorCardinal = registryManifest.errorAndDebug?.error;
      const errorManifestPath = errorCardinal ? AssetPath.join(errorCardinal.directory, errorCardinal.file) : AssetPath.resolve("manifests/error/error-index-manifest.json");
      const schemaRoute = registryManifest.manifestRouting?.schemas;
      if (!schemaRoute?.directory || !schemaRoute?.file) {
        throw new Error("Aspis [BootManager.boot()]: manifestRouting.schemas fehlt.");
      }
      const templateRoute = registryManifest.manifestRouting?.templates;
      if (!templateRoute?.directory || !templateRoute?.file) {
        throw new Error("Aspis [BootManager.boot()]: manifestRouting.templates fehlt.");
      }
      const templateIndexPath = AssetPath.join(templateRoute.directory, templateRoute.file);
      this.#bootPhase(registry, "indexes", "start");
      const indexesAt = this.#now();
      const [debugPart, errorPart, stateIndexPart, schemasPart, templatesPart, eventsIndexPart] = await Promise.all([
        this.#measure(() => RegistryManager.load(debugManifestPath, DebugManifestHydrator)),
        this.#measure(() => RegistryManager.load(errorManifestPath, ErrorManifestHydrator)),
        this.#measure(() => this.#indexFile(registryManifest.manifestRouting?.states, "manifestRouting.states", "state")),
        this.#measure(() => SchemaCatalog.load(AssetPath.join(schemaRoute.directory, schemaRoute.file))),
        this.#measure(() => TemplateCatalog.load(templateIndexPath)),
        this.#measure(() => this.#indexFile(registryManifest.manifestRouting?.events, "manifestRouting.events", "events"))
      ]);
      const debugManifest = debugPart.value;
      const errorManifest = errorPart.value;
      const stateRoute = stateIndexPart.value;
      const schemas = schemasPart.value;
      const templateIndex = templatesPart.value;
      const eventRoute = eventsIndexPart.value;
      CacheManager.set(cache, "manifest:debug", debugManifest);
      RegistryManager.register(registry, "debugManifest", debugManifest);
      CacheManager.set(cache, "manifest:error", errorManifest);
      RegistryManager.register(registry, "errorManifest", errorManifest);
      DebugErrorManager.apply(debugError, debugManifest, errorManifest, registry);
      CacheManager.set(cache, "manifest:index:schemas", schemas);
      RegistryManager.register(registry, "schemaManifest", schemas);
      CacheManager.set(cache, "manifest:index:templates", templateIndex);
      RegistryManager.register(registry, "templateManifest", templateIndex);
      this.#bootPhase(registry, "indexes", "done", indexesAt);
      this.#bootPhase(registry, "manifests", "start");
      const manifestsAt = this.#now();
      const [statePart, eventPart] = await Promise.all([
        this.#measure(() => RegistryManager.load(AssetPath.join(stateRoute.directory, stateRoute.file), StateManifestHydrator)),
        this.#measure(() => RegistryManager.load(AssetPath.join(eventRoute.directory, eventRoute.file), EventManifestHydrator))
      ]);
      const stateManifest = statePart.value;
      const eventManifest = eventPart.value;
      CacheManager.set(cache, "manifest:state", stateManifest);
      RegistryManager.register(registry, "stateManifest", stateManifest);
      CacheManager.set(cache, "manifest:events", eventManifest);
      RegistryManager.register(registry, "eventManifest", eventManifest);
      dispatcher.useManifest(eventManifest);
      this.#bootPhase(registry, "manifests", "done", manifestsAt);
      this.#bootPhase(registry, "services", "start");
      const servicesAt = this.#now();
      const store = this.store(registry);
      if (store) {
        StoreExtension.apply(store, stateManifest);
      }
      const cleaner = new ControllerCleaner(registry);
      const templates = new TemplateService({
        basePath: AssetPath.resolve("templates/"),
        indexPath: templateIndexPath,
        catalog: templateIndex
      });
      const renderService = new TemplateRenderService(templates, cleaner);
      const channel = new Channel();
      channel.bind(registry);
      RegistryManager.register(registry, {
        fetcher: new ControllerDataFetcher(),
        cleaner,
        templates,
        renderService,
        assetPath: AssetPath,
        channel
      });
      channel.attachWorker(AssetPath.resolve("workers/pipeline.worker.js"));
      this.#bootPhase(registry, "services", "done", servicesAt);
      const totalMs = this.#elapsed(bootAt);
      this.#emit(registry, "boot:done", { totalMs });
      this.info(
        registry,
        `[runCycle] boot app-config ${appPart.ms}ms, registry-manifest ${registryPart.ms}ms, debug/error ${Math.max(debugPart.ms, errorPart.ms)}ms, state ${stateIndexPart.ms + statePart.ms}ms, schemas ${schemasPart.ms}ms, templates ${templatesPart.ms}ms, events ${eventsIndexPart.ms + eventPart.ms}ms, total ${totalMs}ms.`
      );
      this.info(registry, `Boot abgeschlossen. Asset-Root: ${AssetPath.root}`);
      return registry;
    } catch (error) {
      this.capture(registry, error);
      return null;
    }
  }
  /**
   * @template T
   * @param {() => Promise<T>} work
   * @returns {Promise<{ value: T, ms: number }>}
   */
  static async #measure(work) {
    const at = this.#now();
    const value = await work();
    return { value, ms: this.#elapsed(at) };
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
  static #bootPhase(registry, name, status, from) {
    /** @type {{ name: string, status: string, ms?: number }} */
    const payload = { name, status };
    if (typeof from === "number") {
      payload.ms = this.#elapsed(from);
    }
    this.#emit(registry, "boot:phase", payload);
  }
  static #emit(registry, name, data) {
    if (!this.has(registry, "dispatcher")) {
      return;
    }
    const dispatcher = this.service(registry, "dispatcher");
    if (dispatcher && typeof dispatcher.emit === "function") {
      dispatcher.emit(name, data);
    }
  }
  static #now() {
    return typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
  }
  static #elapsed(from) {
    return Math.max(0, Math.round(this.#now() - from));
  }
}
export {
  BootManager
};
