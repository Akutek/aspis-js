/** @typedef {import("../../types/managers.js").Registry} Registry */
/** @typedef {import("../../types/managers.js").Plan} Plan */
/** @typedef {import("../../types/managers.js").PlanItem} PlanItem */
/** @typedef {import("../../types/managers.js").CompareDifference} CompareDifference */
/** @typedef {import("../../types/managers.js").WatcherPrep} WatcherPrep */
/** @typedef {import("../../types/factory.js").LoadQueue} LoadQueue */
/** @typedef {import("../../types/factory.js").LoadTask} LoadTask */
/** @typedef {import("../../types/factory.js").LoadBand} LoadBand */
import { PlanManager } from "../../managers/PlanManager.js";
import { CompareManager } from "../../managers/CompareManager.js";
import { ImportManager } from "../../managers/ImportManager.js";
import { RegistryManager } from "../../managers/RegistryManager.js";
import { RuntimeEnv } from "../../core/RuntimeEnv.js";
const NEED_TAGS = ["watcher", "observer"];
const INTERSECTION_SPECIFIER = "watchers.IntersectionWatcher";
class ObserverManagerExtension {
  static get cacheKey() {
    return "factory:watchers";
  }
  static empty() {
    return { skipped: true, specifiers: [], queue: this.emptyQueue() };
  }
  static emptyQueue() {
    return { view: [], near: [], far: [], history: [] };
  }
  static needed(plan) {
    const needs = plan && Array.isArray(plan.needs) ? plan.needs : [];
    for (let i = 0; i < needs.length; i += 1) {
      const tag = typeof needs[i] === "string" ? needs[i].trim().toLowerCase() : "";
      if (NEED_TAGS.includes(tag)) {
        return true;
      }
    }
    return false;
  }
  static prepare(registry, compared) {
    const difference = compared && typeof compared === "object" ? compared : CompareManager.last(registry);
    const plan = difference.plan || PlanManager.last(registry);
    const queue = this.queue(difference);
    const watcherNeeded = this.needed(plan);
    const hasFar = Array.isArray(queue.far) && queue.far.length > 0;
    if (!watcherNeeded && !hasFar) {
      return { skipped: true, specifiers: [], queue };
    }
    let specifiers;
    if (watcherNeeded) {
      const fromPlan = Array.isArray(plan.watchers) ? plan.watchers.filter(Boolean) : [];
      specifiers = fromPlan.length > 0 ? fromPlan.slice() : this.catalog();
    } else {
      specifiers = [];
    }
    if (!specifiers.includes(INTERSECTION_SPECIFIER)) {
      specifiers.push(INTERSECTION_SPECIFIER);
    }
    return {
      skipped: false,
      specifiers,
      queue
    };
  }
  static async hosts(registry, specifiers = []) {
    const mounted = [];
    const list = Array.isArray(specifiers) ? specifiers : [];
    for (let i = 0; i < list.length; i += 1) {
      const specifier = list[i];
      const key = this.hostKey(specifier);
      if (!key) {
        continue;
      }
      if (registry && typeof registry.has === "function" && registry.has(key)) {
        mounted.push(RegistryManager.get(registry, key));
        continue;
      }
      const WatcherClass = await ImportManager.import(registry, specifier);
      if (typeof WatcherClass !== "function") {
        continue;
      }
      const watcher = new WatcherClass();
      if (typeof watcher.bind === "function") {
        watcher.bind(registry);
      }
      if (typeof watcher.start === "function") {
        watcher.start();
      }
      RegistryManager.register(registry, key, watcher);
      mounted.push(watcher);
    }
    return mounted;
  }
  /** Beobachtet `far`-Knoten, bis sie in view/near rutschen und ein Cycle sie spawnt. */
  static watchFar(registry, queue) {
    if (!registry || typeof registry.has !== "function" || !registry.has("intersectionWatcher")) {
      return this;
    }
    const watcher = RegistryManager.get(registry, "intersectionWatcher");
    if (!watcher || typeof watcher.observe !== "function") {
      return this;
    }
    const far = queue && Array.isArray(queue.far) ? queue.far : [];
    for (let i = 0; i < far.length; i += 1) {
      const element = far[i] && far[i].item ? far[i].item.element : null;
      if (element instanceof Element) {
        watcher.observe(element);
      }
    }
    return this;
  }
  static hostKey(specifier) {
    const name = String(specifier || "").split(".").pop() || "";
    if (!name) {
      return "";
    }
    return name.charAt(0).toLowerCase() + name.slice(1);
  }
  static queue(difference) {
    const queued = this.emptyQueue();
    this.#place(queued, difference && difference.add, "add");
    this.#place(queued, difference && difference.update, "update");
    this.#place(queued, difference && difference.keep, "keep");
    return queued;
  }
  static band(element) {
    if (!element || typeof element.getBoundingClientRect !== "function") {
      return "far";
    }
    if (typeof window === "undefined") {
      return "view";
    }
    if (element.isConnected === false) {
      return "far";
    }
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0 && rect.top === 0 && rect.left === 0) {
      return "view";
    }
    const viewport = RuntimeEnv.viewport();
    const viewportHeight = viewport.height;
    const viewportWidth = viewport.width;
    const visible = rect.bottom > 0 && rect.top < viewportHeight && rect.right > 0 && rect.left < viewportWidth;
    if (visible) {
      return "view";
    }
    const margin = viewportHeight;
    const nearby = rect.bottom > -margin && rect.top < viewportHeight + margin && rect.right > -viewportWidth && rect.left < viewportWidth * 2;
    return nearby ? "near" : "far";
  }
  static specifiersToLoad(queue, history = {}) {
    const unique = /* @__PURE__ */ new Set();
    const bands = ["view", "near"];
    for (let b = 0; b < bands.length; b += 1) {
      this.#collect(unique, queue && queue[bands[b]]);
    }
    const historyTasks = queue && Array.isArray(queue.history) ? queue.history : [];
    for (let i = 0; i < historyTasks.length; i += 1) {
      const specifiers = historyTasks[i] && Array.isArray(historyTasks[i].specifiers) ? historyTasks[i].specifiers : [];
      for (let s = 0; s < specifiers.length; s += 1) {
        if (specifiers[s] && !history[specifiers[s]]) {
          unique.add(specifiers[s]);
        }
      }
    }
    return [...unique];
  }
  static catalog() {
    return [
      "watchers.MutationWatcher",
      "watchers.IntersectionWatcher",
      "watchers.ResizeWatcher",
      "watchers.PerformanceWatcher",
      "watchers.ReportingWatcher"
    ];
  }
  static #place(queued, items, origin) {
    if (!Array.isArray(items)) {
      return;
    }
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      if (!item) {
        continue;
      }
      const specifiers = Array.isArray(item.specifiers) ? item.specifiers.filter(Boolean) : [];
      const task = {
        item,
        origin,
        specifiers,
        band: origin === "keep" ? "history" : origin === "update" ? "view" : this.band(item.element)
      };
      queued[task.band].push(task);
    }
  }
  static #collect(unique, tasks) {
    if (!Array.isArray(tasks)) {
      return;
    }
    for (let i = 0; i < tasks.length; i += 1) {
      const specifiers = tasks[i] && Array.isArray(tasks[i].specifiers) ? tasks[i].specifiers : [];
      for (let s = 0; s < specifiers.length; s += 1) {
        if (specifiers[s]) {
          unique.add(specifiers[s]);
        }
      }
      const task = tasks[i];
      const mixins = task && task.item && Array.isArray(task.item.mixins) ? task.item.mixins : [];
      for (let m = 0; m < mixins.length; m += 1) {
        if (mixins[m]) {
          unique.add(mixins[m]);
        }
      }
    }
  }
}
export {
  ObserverManagerExtension
};
