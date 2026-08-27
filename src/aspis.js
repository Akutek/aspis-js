/** @typedef {import("./types/registry.js").Cache} Cache */
/** @typedef {import("./types/registry.js").CycleHook} CycleHook */
/** @typedef {import("./types/registry.js").Registry} Registry */
/** @typedef {import("./types/managers.js").PlanItem} PlanItem */
import { BootManager } from "./managers/BootManager.js";
import { ScanManager } from "./managers/ScanManager.js";
import { PlanManager } from "./managers/PlanManager.js";
import { CompareManager } from "./managers/CompareManager.js";
import { ObserverManager } from "./managers/ObserverManager.js";
import { ComposeManager } from "./managers/ComposeManager.js";
import { ControllerManager } from "./managers/ControllerManager.js";
import { SplicerManager } from "./managers/SplicerManager.js";
import { FactoryManager } from "./managers/FactoryManager.js";
import { RegistryManager } from "./managers/RegistryManager.js";
import { ObserverManagerExtension } from "./extensions/observer/ObserverManagerExtension.js";
import { CompareManagerExtension } from "./extensions/compare/CompareManagerExtension.js";
import { ControllerCleaner } from "./services/ControllerCleaner.js";
import { DebugAgent } from "./agents/DebugAgent.js";
import { RuntimeEnv } from "./core/RuntimeEnv.js";
let inflight = /** @type {Promise<void> | null} */ (null);
let queued = false;
let active = /** @type {import("./types/registry.js").Registry | null} */ (null);

/**
 * Einstieg: einmal Boot, danach wiederholbarer Zyklus
 * Scan → Plan → Compare → Observer → Compose → Controller → Splice → Factory.
 * Registry ist die Landkarte der Hosts. Phasen-Ergebnisse sind Return-Werte.
 * Überlappende Aufrufe warten auf denselben Cycle und planen danach einen
 * weiteren vollen Durchlauf — sonst bleiben Knoten unsichtbar, die während
 * Factory/Paste entstanden (z. B. Modal-Formular).
 * Optionaler `root`: Scan nur dort, restliche Treffer kommen aus dem letzten Scan (Merge).
 *
 * @param {import("./types/registry.js").Registry} registry
 * @param {(ParentNode & Element)=} [root]
 * @returns {Promise<void>}
 */
function runCycle(registry, root) {
  if (inflight) {
    queued = true;
    return inflight.then(() => {
      if (!queued) {
        return undefined;
      }
      queued = false;
      return runCycle(registry);
    });
  }
  inflight = (async () => {
    const channel = registry.has("channel") ? registry.get("channel") : null;
    if (channel && typeof channel.holdPipeline === "function") {
      channel.holdPipeline(true);
    }
    try {
      const started = now();
      emitPhase(registry, "scan", "start");
      const scanAt = now();
      await (root ? ScanManager.scan(registry, root) : ScanManager.scan(registry));
      emitPhase(registry, "scan", "done", scanAt);
      emitPhase(registry, "plan", "start");
      const planAt = now();
      await PlanManager.plan(registry);
      emitPhase(registry, "plan", "done", planAt);
      emitPhase(registry, "compare", "start");
      const compareAt = now();
      const compared = await CompareManager.compare(registry);
      emitPhase(registry, "compare", "done", compareAt);
      emitPhase(registry, "observe", "start");
      const observeAt = now();
      const watchers = await ObserverManager.observe(registry, compared);
      emitPhase(registry, "observe", "done", observeAt);
      emitPhase(registry, "compose", "start");
      const composeAt = now();
      const compose = await ComposeManager.compose(registry, compared);
      emitPhase(registry, "compose", "done", composeAt);
      emitPhase(registry, "controller", "start");
      const controlAt = now();
      const controllers = await ControllerManager.control(registry, compared, watchers);
      emitPhase(registry, "controller", "done", controlAt);
      emitPhase(registry, "splice", "start");
      const spliceAt = now();
      const spliced = await SplicerManager.splice(registry, { compared, watchers, compose, controllers });
      emitPhase(registry, "splice", "done", spliceAt);
      emitPhase(registry, "factory", "start");
      const factoryAt = now();
      await FactoryManager.factory(registry, spliced);
      emitPhase(registry, "factory", "done", factoryAt);
      const done = now();
      emit(registry, "cycle:done", { totalMs: elapsed(started), compared });
      DebugAgent.info(
        `[runCycle] scan ${ms(scanAt, planAt)}, plan ${ms(planAt, compareAt)}, compare ${ms(compareAt, observeAt)} (add ${compared.add.length} keep ${compared.keep.length} update ${compared.update.length} remove ${compared.remove.length}), observe ${ms(observeAt, composeAt)}, compose ${ms(composeAt, controlAt)}, controller ${ms(controlAt, spliceAt)}, splice ${ms(spliceAt, factoryAt)}, factory ${ms(factoryAt, done)}, total ${ms(started, done)}.`
      );
    } finally {
      if (channel && typeof channel.holdPipeline === "function") {
        channel.holdPipeline(false);
      }
    }
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}
/**
 * Boot, ersten Cycle, `cycle` in der Registry für Watcher.
 *
 * @returns {Promise<import("./types/registry.js").Registry|null>}
 */
async function start() {
  if (active) {
    await stop(active);
  }
  const registry = await BootManager.boot();
  if (!registry) {
    return null;
  }
  active = registry;
  const cycle = (root) => root ? runCycle(registry, root) : runCycle(registry);
  RegistryManager.register(registry, "cycle", cycle);
  await runCycle(registry);
  return registry;
}
/**
 * Watcher aus, Controller destroy, Cycle-Haken lösen. Wartet auf einen laufenden Cycle.
 * Danach Channel (Worker terminate) und erst dann EventDispatcher.destroy.
 *
 * @param {import("./types/registry.js").Registry|null} [registry]
 * @returns {Promise<void>}
 */
async function stop(registry) {
  const host = registry ?? active;
  if (!host) {
    if (inflight) {
      await inflight;
    }
    active = null;
    return;
  }
  if (host.has("cycle")) {
    host.delete("cycle");
  }
  const catalog = ObserverManagerExtension.catalog();
  for (let i = 0; i < catalog.length; i += 1) {
    const specifier = catalog[i];
    if (!specifier) {
      continue;
    }
    const key = ObserverManagerExtension.hostKey(specifier);
    if (!key || !host.has(key)) {
      continue;
    }
    const watcher = host.get(key);
    if (watcher && typeof watcher.stop === "function") {
      watcher.stop();
    }
  }
  if (inflight) {
    await inflight;
  }
  releaseLive(host);
  ControllerCleaner.cleanTree(host, RuntimeEnv.documentElement());
  if (host.has("channel")) {
    const channel = host.get("channel");
    if (channel && typeof channel.destroy === "function") {
      channel.destroy();
    }
  }
  if (host.has("dispatcher")) {
    const dispatcher = host.get("dispatcher");
    if (dispatcher && typeof dispatcher.destroy === "function") {
      dispatcher.destroy();
    }
  }
  DebugAgent.info("[runCycle] Runtime angehalten.");
  if (active === host) {
    active = null;
  }
}
function releaseLive(host) {
  if (!host.has("cache")) {
    return;
  }
  const cache = host.get("cache");
  if (!cache || typeof cache.get !== "function") {
    return;
  }
  const live = cache.get(CompareManagerExtension.liveKey);
  if (Array.isArray(live)) {
    for (let i = 0; i < live.length; i += 1) {
      const item = live[i];
      const element = item && item.element;
      if (element instanceof HTMLElement && host.has(element)) {
        host.delete(element);
      }
    }
  }
  cache.delete(CompareManagerExtension.liveKey);
}
function emit(registry, name, data) {
  if (!registry || typeof registry.has !== "function" || !registry.has("dispatcher")) {
    return;
  }
  const dispatcher = registry.get("dispatcher");
  if (dispatcher && typeof dispatcher.emit === "function") {
    dispatcher.emit(name, data);
  }
}
function emitPhase(registry, name, status, from) {
  /** @type {{ name: string, status: string, ms?: number }} */
  const payload = { name, status };
  if (typeof from === "number") {
    payload.ms = elapsed(from);
  }
  emit(registry, "cycle:phase", payload);
}
function now() {
  return typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
}
function elapsed(from) {
  return Math.max(0, Math.round(now() - from));
}
function ms(from, to) {
  return `${Math.max(0, Math.round(to - from))}ms`;
}
export {
  runCycle,
  start,
  stop
};
