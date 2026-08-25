/** @typedef {import("../types/controllers.js").ControllerDispatcher} ControllerDispatcher */
/** @typedef {import("../types/controllers.js").ControllerFetcher} ControllerFetcher */
/** @typedef {import("../types/controllers.js").ControllerOptions} ControllerOptions */
/** @typedef {import("../types/controllers.js").ControllerRenderService} ControllerRenderService */
/** @typedef {import("../types/schema.js").AnySchemaView} AnySchemaView */
/** @typedef {import("../types/store.js").TargetConfig} TargetConfig */
/** @typedef {import("../types/utils.js").DispatcherLike} DispatcherLike */
/** @typedef {import("../types/utils.js").FetcherLike} FetcherLike */
/** @typedef {import("../types/utils.js").LoadingStateProxy} LoadingStateProxy */
/** @typedef {import("../core/Store.js").Store} Store */
/** @typedef {import("../core/Registry.js").Registry} Registry */
import { DebugAgent } from "../agents/DebugAgent.js";
import { ErrorAgent } from "../agents/ErrorAgent.js";
import { ControllerEventDelegator } from "../utils/ControllerEventDelegator.js";
import { ControllerLoadingHelper } from "../utils/ControllerLoadingHelper.js";
import { StoreDomDependencyScanner } from "../utils/StoreDomDependencyScanner.js";
import { ModifierDOM } from "../utils/ModifierDOM.js";
class BaseController {
  /** @type {Store | null} */
  _store;
  /** @type {ControllerDispatcher | null} */
  _dispatcher;
  /** @type {HTMLElement | null} */
  _container;
  /** @type {ControllerOptions | null} */
  _options;
  /** @type {string | undefined} */
  _sliceKey;
  /** @type {string | undefined} */
  _layout;
  /** @type {string | undefined} */
  _kind;
  /** @type {Registry | undefined} */
  _registry;
  /** @type {import("../agents/DebugAgent.js").DebugAgent | undefined} */
  _debug;
  /** @type {import("../agents/ErrorAgent.js").ErrorAgent | undefined} */
  _error;
  _isStarted = false;
  /** @type {AnySchemaView | null} */
  _view = null;
  /** @type {(() => void) | null} */
  _clickOutsideUnsub = null;
  /** @type {HTMLElement | null} */
  _modalRoot = null;
  _modalMountedOnBody = false;
  /** @type {string | null} */
  _dataUrl = null;
  /** @type {string | null} */
  _connection = null;
  /** @type {string | null} */
  _apiToken = null;
  /** @type {string | null} */
  _contentKind = null;
  _mountMode = "body";
  /** @type {string | null} */
  _templateName = null;
  _validateOnBlur = false;
  _validateOnChange = false;
  _destroyed = false;
  /** @type {(() => void) | null} */
  #unsubscribeStore = null;
  /** @type {ControllerEventDelegator | null} */
  #eventDelegator = null;
  #lifecycleController;
  #taskControllers = /* @__PURE__ */ new Map();
  constructor(container, store, dispatcher, options = {}) {
    this._container = container;
    this.#lifecycleController = this.#newAbortController();
    this._store = store;
    this._dispatcher = dispatcher;
    this._options = options;
    this._registry = options.registry || null;
    this._debug = options.debug || DebugAgent.shared();
    this._error = options.error || ErrorAgent.shared();
    this._layout = options.layout || (container && container.dataset ? container.dataset.layout : "") || null;
    this._sliceKey = options.sliceKey || container?.dataset?.sliceKey || null;
    this._kind = "BaseController";
    this.#eventDelegator = container ? new ControllerEventDelegator(container, dispatcher, this, options) : null;
    if (typeof this.prepare === "function") {
      this.prepare(options);
    }
  }
  /** Mixin-Hook: Defaults (Slice, Art). Die Factory überspringt Mixin-Konstruktoren. */
  prepare(_options) {
  }
  /** Mixin-Hook nach Basis-Init. */
  async onReady() {
  }
  /** Mixin-Hook bei Slice-Änderungen. */
  onStateChange(_slice) {
  }
  /** Mixin-Hook vor dem Aufräumen. */
  onDestroy() {
  }
  get signal() {
    return this.#lifecycleController.signal;
  }
  get fetcher() {
    if (this._options?.fetcher) {
      return this._options.fetcher;
    }
    const registry = this._registry;
    if (registry && typeof registry.has === "function" && registry.has("fetcher")) {
      return registry.get("fetcher");
    }
    return {
      get: async (url, _params, opts) => {
        const res = await fetch(url, opts);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return res.json();
      }
    };
  }
  get renderService() {
    if (this._options?.renderService) {
      return this._options.renderService;
    }
    const registry = this._registry;
    if (registry && typeof registry.has === "function" && registry.has("renderService")) {
      return registry.get("renderService");
    }
    return null;
  }
  getSignal(taskKey = null) {
    if (!taskKey) {
      return this.#lifecycleController.signal;
    }
    const existing = this.#taskControllers.get(taskKey);
    if (existing) {
      existing.abort(`Task '${taskKey}' \xFCberschrieben.`);
    }
    const taskController = this.#newAbortController();
    this.#taskControllers.set(taskKey, taskController);
    const AbortSignalApi = this.#abortSignalApi();
    if (AbortSignalApi && typeof AbortSignalApi.any === "function") {
      return AbortSignalApi.any([this.#lifecycleController.signal, taskController.signal]);
    }
    if (this.#lifecycleController.signal.aborted) {
      taskController.abort(this.#lifecycleController.signal.reason);
    } else {
      this.#lifecycleController.signal.addEventListener("abort", () => {
        taskController.abort(this.#lifecycleController.signal.reason);
      }, { once: true });
    }
    return taskController.signal;
  }
  clearTask(taskKey) {
    this.#taskControllers.delete(taskKey);
  }
  delegate(eventName, selector, handler, options = {}) {
    if (!this.#eventDelegator) {
      return;
    }
    this.#eventDelegator.delegate(eventName, selector, handler, options);
  }
  setLoadingState(stateProxy, message = "Lade...") {
    if (!this._container) {
      return;
    }
    ControllerLoadingHelper.apply(this._container, stateProxy, message);
  }
  async onInit() {
    if (!this._container) {
      throw new Error(`Aspis [${this._kind}]: Kein Container-Element \xFCbergeben.`);
    }
    await this.onReady();
  }
  async start() {
    if (this._isStarted || this.signal.aborted) {
      return;
    }
    this._isStarted = true;
    if (this.#eventDelegator && typeof this.#eventDelegator.initEvents === "function") {
      await this.#eventDelegator.initEvents(this.fetcher);
    }
    if (this.signal.aborted) {
      return;
    }
    await this.onInit();
    if (this.signal.aborted) {
      return;
    }
    if (this._container && this._store) {
      StoreDomDependencyScanner.register(this._container, this._store);
    }
    if (this._sliceKey && this._store && typeof this._store.effect === "function") {
      this.#unsubscribeStore = this._store.effect(() => {
        if (!this._store || this.signal.aborted) {
          return;
        }
        const path = this._sliceKey || "";
        if (typeof this._store.isPathDeclared === "function" && !this._store.isPathDeclared(path)) {
          return;
        }
        const slice = typeof this._store.getSlice === "function" ? this._store.getSlice(path) : null;
        if (slice && typeof slice === "object") {
          this._onStateChange(slice);
        }
      });
    }
  }
  destroy() {
    if (this._destroyed) {
      return;
    }
    this._destroyed = true;
    this.#lifecycleController.abort("Controller zerst\xF6rt.");
    for (const taskCtrl of this.#taskControllers.values()) {
      taskCtrl.abort("Controller zerst\xF6rt.");
    }
    this.#taskControllers.clear();
    if (this.#unsubscribeStore) {
      this.#unsubscribeStore();
      this.#unsubscribeStore = null;
    }
    if (this.#eventDelegator) {
      this.#eventDelegator.destroy();
      this.#eventDelegator = null;
    }
    if (this._container && this._store) {
      StoreDomDependencyScanner.unregister(this._container, this._store);
    }
    try {
      if (typeof this.onDestroy === "function") {
        this.onDestroy();
      }
    } catch (error) {
      this._capture("destroy", error);
    } finally {
      this._container = null;
      this._store = null;
      this._dispatcher = null;
      this._options = null;
      this._registry = null;
    }
    this._debugMsg("destroy", "Instanz gereinigt.");
  }
  _onStateChange(slice) {
    if (!this._container) {
      return;
    }
    const config = slice.config && typeof slice.config === "object" ? slice.config : null;
    if (config?.targets) {
      for (const [, targetConfig] of Object.entries(config.targets)) {
        const element = targetConfig.selector === ":scope" ? this._container : this._container.querySelector(targetConfig.selector);
        if (!element || !targetConfig.bindClasses) {
          continue;
        }
        for (const [stateProp, styleKey] of Object.entries(targetConfig.bindClasses)) {
          const isActive = Boolean(slice[stateProp]);
          if (typeof ModifierDOM.toggleSliceClass === "function") {
            ModifierDOM.toggleSliceClass(element, slice, styleKey, isActive);
          }
        }
      }
    }
    this.onStateChange(slice);
  }
  /** AbortController der Container-Window, sonst der Modul-Realm. jsdom prüft addEventListener.brand gegen window.AbortSignal. */
  #newAbortController() {
    const View = this._container && this._container.ownerDocument ? this._container.ownerDocument.defaultView : null;
    const Ctor = View && View.AbortController || AbortController;
    return new Ctor();
  }
  #abortSignalApi() {
    const View = this._container && this._container.ownerDocument ? this._container.ownerDocument.defaultView : null;
    if (View && View.AbortSignal) {
      return View.AbortSignal;
    }
    return typeof AbortSignal !== "undefined" ? AbortSignal : null;
  }
  _tag(method) {
    return `[${this._kind || "BaseController"}.${method}()]`;
  }
  _debugMsg(method, message, ...args) {
    this._debug.debug(`${this._tag(method)} ${message}`, ...args);
  }
  _warn(method, message, ...args) {
    this._debug.warn(`${this._tag(method)} ${message}`, ...args);
  }
  _capture(method, error) {
    this._error.capture(error, this._tag(method));
  }
}
function errorName(error) {
  return error instanceof Error ? error.name : "";
}
function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
export {
  BaseController,
  errorMessage,
  errorName
};
