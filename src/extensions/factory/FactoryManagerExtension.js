/** @typedef {import("../../types/managers.js").Registry} Registry */
/** @typedef {import("../../types/managers.js").FactoryPrep} FactoryPrep */
/** @typedef {import("../../types/managers.js").WatcherPrep} WatcherPrep */
/** @typedef {import("../../types/managers.js").ComposePrep} ComposePrep */
/** @typedef {import("../../types/managers.js").ControllerPrep} ControllerPrep */
/** @typedef {import("../../types/managers.js").CompareDifference} CompareDifference */
/** @typedef {import("../../types/managers.js").PlanItem} PlanItem */
/** @typedef {import("../../types/tailor.js").Tailor} Tailor */
/** @typedef {import("../../types/factory.js").LoadTask} LoadTask */
/** @typedef {import("../../types/cache.js").Cache} Cache */
/** @typedef {import("../../types/registry.js").ControllerInstance} ControllerInstance */
import { ImportManager } from "../../managers/ImportManager.js";
import { RegistryManager } from "../../managers/RegistryManager.js";
import { CacheManager } from "../../managers/CacheManager.js";
import { CompareManager } from "../../managers/CompareManager.js";
import { DebugErrorManager } from "../../managers/DebugErrorManager.js";
import { ComposeMixinService } from "../../services/ComposeMixinService.js";
import { ComposeCompositionService } from "../../services/ComposeCompositionService.js";
import { DebugAgent } from "../../agents/DebugAgent.js";
import { ErrorAgent } from "../../agents/ErrorAgent.js";
import { ObserverManagerExtension } from "../observer/ObserverManagerExtension.js";
class FactoryManagerExtension {
  static get cacheKey() {
    return "factory:current";
  }
  static get historyKey() {
    return "factory:history";
  }
  static get hostKey() {
    return "tailor";
  }
  static get specifier() {
    return "core.Tailor";
  }
  static emptyWatchers() {
    return { skipped: true, specifiers: [], queue: ObserverManagerExtension.emptyQueue() };
  }
  static emptyCompose() {
    return { items: [], mixin: ComposeMixinService, composition: ComposeCompositionService };
  }
  static emptyControllers() {
    return { specifiers: [], classes: {} };
  }
  static emptyCompared() {
    return { add: [], keep: [], update: [], remove: [] };
  }
  static empty() {
    return {
      compared: this.emptyCompared(),
      watchers: this.emptyWatchers(),
      compose: this.emptyCompose(),
      controllers: this.emptyControllers(),
      tailor: null,
      splicer: null,
      tailored: {},
      mounted: 0
    };
  }
  static assemble(parts) {
    const watchers = parts && parts.watchers && typeof parts.watchers === "object" ? parts.watchers : this.emptyWatchers();
    const compose = parts && parts.compose && typeof parts.compose === "object" ? parts.compose : this.emptyCompose();
    const controllers = parts && parts.controllers && typeof parts.controllers === "object" ? parts.controllers : this.emptyControllers();
    const compared = parts && parts.compared && typeof parts.compared === "object" ? parts.compared : this.emptyCompared();
    return {
      compared: {
        add: Array.isArray(compared.add) ? compared.add.slice() : [],
        keep: Array.isArray(compared.keep) ? compared.keep.slice() : [],
        update: Array.isArray(compared.update) ? compared.update.slice() : [],
        remove: Array.isArray(compared.remove) ? compared.remove.slice() : [],
        plan: compared.plan
      },
      watchers: {
        skipped: Boolean(watchers.skipped),
        specifiers: Array.isArray(watchers.specifiers) ? watchers.specifiers.slice() : [],
        queue: watchers.queue && typeof watchers.queue === "object" ? watchers.queue : ObserverManagerExtension.emptyQueue()
      },
      compose: {
        items: Array.isArray(compose.items) ? compose.items.slice() : [],
        mixin: typeof compose.mixin === "function" ? compose.mixin : ComposeMixinService,
        composition: typeof compose.composition === "function" ? compose.composition : ComposeCompositionService
      },
      controllers: {
        specifiers: Array.isArray(controllers.specifiers) ? controllers.specifiers.slice() : [],
        classes: controllers.classes && typeof controllers.classes === "object" ? controllers.classes : {}
      },
      tailor: parts && parts.tailor ? parts.tailor : null,
      splicer: parts && parts.splicer ? parts.splicer : null,
      tailored: parts && parts.tailored && typeof parts.tailored === "object" ? parts.tailored : {},
      mounted: parts && typeof parts.mounted === "number" ? parts.mounted : 0
    };
  }
  static async host(registry) {
    if (registry && typeof registry.has === "function" && registry.has(this.hostKey)) {
      return RegistryManager.get(registry, this.hostKey);
    }
    const TailorClass = await ImportManager.import(registry, this.specifier);
    if (typeof TailorClass !== "function") {
      return null;
    }
    const tailor = new TailorClass();
    this.bind(tailor, registry);
    RegistryManager.register(registry, this.hostKey, tailor);
    return tailor;
  }
  static bind(tailor, registry) {
    if (!tailor?.extension) {
      return this;
    }
    tailor.extension.bind(tailor, registry);
    return this;
  }
  static async mount(registry, parts) {
    if (!registry || !parts) {
      return 0;
    }
    const compared = parts.compared || this.emptyCompared();
    this.#unmount(registry, compared.remove);
    this.#unmount(registry, compared.update);
    await this.#ensureDispatcher(registry);
    const tools = this.#tools(registry);
    const queue = parts.watchers && parts.watchers.queue ? parts.watchers.queue : ObserverManagerExtension.emptyQueue();
    let mounted = 0;
    mounted += await this.#mountBand(registry, parts, queue.view, tools);
    mounted += await this.#mountBand(registry, parts, queue.near, tools);
    mounted += await this.#mountBand(registry, parts, queue.history, tools);
    this.#syncLive(registry, compared);
    return mounted;
  }
  static get dispatcherKey() {
    return "dispatcher";
  }
  static get dispatcherSpecifier() {
    return "services.EventDispatcher";
  }
  static #unmount(registry, items) {
    if (!Array.isArray(items)) {
      return 0;
    }
    let count = 0;
    for (let i = 0; i < items.length; i += 1) {
      const element = items[i] && items[i].element;
      if (!(element instanceof HTMLElement) || !registry.has(element)) {
        continue;
      }
      RegistryManager.unbind(registry, element);
      count += 1;
    }
    return count;
  }
  static async #ensureDispatcher(registry) {
    if (registry.has(this.dispatcherKey)) {
      return;
    }
    const Dispatcher = await ImportManager.import(registry, this.dispatcherSpecifier);
    if (typeof Dispatcher !== "function") {
      return;
    }
    const eventManifest = registry.has("eventManifest") ? RegistryManager.get(registry, "eventManifest") : {};
    RegistryManager.register(registry, this.dispatcherKey, new Dispatcher(eventManifest || {}));
  }
  static #tools(registry) {
    return {
      store: registry.has("store") ? RegistryManager.get(registry, "store") : null,
      dispatcher: registry.has(this.dispatcherKey) ? RegistryManager.get(registry, this.dispatcherKey) : null,
      debug: registry.has("debug") ? RegistryManager.get(registry, "debug") : DebugAgent.shared(),
      error: registry.has("error") ? RegistryManager.get(registry, "error") : ErrorAgent.shared()
    };
  }
  static async #mountBand(registry, parts, tasks, tools) {
    if (!Array.isArray(tasks)) {
      return 0;
    }
    let count = 0;
    for (let i = 0; i < tasks.length; i += 1) {
      const ok = await this.#mountTask(registry, parts, tasks[i], tools);
      if (ok) {
        count += 1;
      }
    }
    return count;
  }
  static async #mountTask(registry, parts, task, tools) {
    const element = task && task.item && task.item.element;
    if (!(element instanceof HTMLElement)) {
      return false;
    }
    if (task.origin === "keep" && registry.has(element)) {
      element.dataset.aspisOrigin = "keep";
      element.dataset.aspisController = this.#key(task);
      return false;
    }
    const Class = parts.tailored && parts.tailored[this.#key(task)];
    if (typeof Class !== "function") {
      return false;
    }
    if (registry.has(element)) {
      RegistryManager.unbind(registry, element);
    }
    try {
      const Ctor = Class;
      const instance = new Ctor(element, tools.store, tools.dispatcher, {
        registry,
        debug: tools.debug,
        error: tools.error,
        layout: task.item.layout,
        sliceKey: task.item.sliceKey
      });
      RegistryManager.bind(registry, element, instance);
      element.dataset.aspisOrigin = task.origin;
      element.dataset.aspisController = this.#key(task);
      if (typeof instance.start === "function") {
        await instance.start();
      }
      return true;
    } catch (error) {
      if (registry.has(element)) {
        RegistryManager.unbind(registry, element);
      }
      DebugErrorManager.capture(
        tools.error,
        error,
        `[FactoryManagerExtension.mount()] ${this.#key(task)}`
      );
      return false;
    }
  }
  static #syncLive(registry, compared) {
    if (!registry.has("cache")) {
      return;
    }
    const cache = RegistryManager.get(registry, "cache");
    const live = [];
    const buckets = [compared.add, compared.keep, compared.update];
    for (let b = 0; b < buckets.length; b += 1) {
      const items = buckets[b];
      if (!Array.isArray(items)) {
        continue;
      }
      for (let i = 0; i < items.length; i += 1) {
        const item = items[i];
        if (item && item.element instanceof HTMLElement && registry.has(item.element)) {
          live.push(item);
        }
      }
    }
    CacheManager.set(cache, CompareManager.liveKey, live);
  }
  static #key(task) {
    if (!task) {
      return "";
    }
    if (task.item && typeof task.item.type === "string" && task.item.type) {
      return task.item.type;
    }
    if (Array.isArray(task.specifiers) && task.specifiers[0]) {
      return task.specifiers[0];
    }
    return "";
  }
}
export {
  FactoryManagerExtension
};
