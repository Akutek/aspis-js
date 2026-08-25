/** @typedef {import("../src/types/registry.js").Registry} Registry */
/** @typedef {import("../src/types/registry.js").ControllerInstance} ControllerInstance */
/** @typedef {import("../src/types/registry.js").CycleHook} CycleHook */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { accordionMarkup, extraAccordion, controllerElement } from "./helpers/accordion-fixture.js";
import { fileFetch } from "./helpers/file-fetch.js";
import { useFileAssetRoot } from "./helpers/file-assets.js";
let start;
let stop;
let runCycle;
let CompareManager;
let FactoryManager;
let ImportManager;
let RegistryManager;
describe("DOM-Cycle", () => {
  beforeAll(async () => {
    useFileAssetRoot();
    const aspis = await import("../src/aspis.js");
    start = aspis.start;
    stop = aspis.stop;
    runCycle = aspis.runCycle;
    CompareManager = (await import("../src/managers/CompareManager.js")).CompareManager;
    FactoryManager = (await import("../src/managers/FactoryManager.js")).FactoryManager;
    ImportManager = (await import("../src/managers/ImportManager.js")).ImportManager;
    RegistryManager = (await import("../src/managers/RegistryManager.js")).RegistryManager;
  });
  beforeEach(() => {
    vi.stubGlobal("fetch", fileFetch);
    document.body.innerHTML = accordionMarkup();
  });
  afterEach(async () => {
    if (typeof stop === "function") {
      await stop();
    }
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
  it("add: neuer Accordion wird gespawnt", async () => {
    const registry = await bootRuntime();
    const element = controllerElement();
    const compared = CompareManager.last(registry);
    expect(compared.add.length).toBe(1);
    expect(compared.keep.length).toBe(0);
    expect(compared.update.length).toBe(0);
    expect(compared.remove.length).toBe(0);
    expect(registry.has(element)).toBe(true);
    expect(FactoryManager.last(registry).mounted).toBe(1);
    expect(element.dataset.aspisOrigin).toBe("add");
    expect(element.dataset.aspisController).toBe("accordion");
  });
  it("keep: zweiter Cycle ohne DOM-\xC4nderung beh\xE4lt die Instanz", async () => {
    const registry = await bootRuntime();
    const element = controllerElement();
    const first = registry.get(element);
    await runCycle(registry);
    const compared = CompareManager.last(registry);
    expect(compared.add.length).toBe(0);
    expect(compared.keep.length).toBe(1);
    expect(compared.update.length).toBe(0);
    expect(compared.remove.length).toBe(0);
    expect(registry.get(element)).toBe(first);
    expect(element.dataset.aspisOrigin).toBe("keep");
    expect(FactoryManager.last(registry).mounted).toBe(0);
  });
  it("update: gleiche Node, andere Pflicht zerst\xF6rt und startet neu", async () => {
    const registry = await bootRuntime();
    const element = controllerElement();
    const first = registry.get(element);
    element.dataset.sliceKey = "features.otherAccordion";
    await runCycle(registry);
    const compared = CompareManager.last(registry);
    expect(compared.add.length).toBe(0);
    expect(compared.keep.length).toBe(0);
    expect(compared.update.length).toBe(1);
    expect(compared.remove.length).toBe(0);
    expect(registry.has(element)).toBe(true);
    expect(registry.get(element)).not.toBe(first);
    expect(first._destroyed).toBe(true);
    expect(element.dataset.aspisOrigin).toBe("update");
    expect(FactoryManager.last(registry).mounted).toBe(1);
  });
  it("remove: Knoten weg ruft destroy genau einmal", async () => {
    const registry = await bootRuntime();
    const element = controllerElement();
    const instance = registry.get(element);
    if (typeof instance.destroy !== "function") {
      throw new Error("Controller ohne destroy().");
    }
    const spy = vi.spyOn(instance, "destroy");
    element.remove();
    await runCycle(registry);
    const compared = CompareManager.last(registry);
    expect(compared.add.length).toBe(0);
    expect(compared.keep.length).toBe(0);
    expect(compared.update.length).toBe(0);
    expect(compared.remove.length).toBe(1);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(instance._destroyed).toBe(true);
    expect(registry.has(element)).toBe(false);
    instance.destroy();
    expect(instance._destroyed).toBe(true);
  });
  it("\xFCberlappende runCycle-Aufrufe teilen dieselbe Promise", async () => {
    const registry = await bootRuntime();
    const first = runCycle(registry);
    const second = runCycle(registry);
    expect(second).toBe(first);
    await first;
  });
  it("stop: Watcher aus, Controller destroy, cycle gel\xF6st", async () => {
    const registry = await bootRuntime();
    const element = controllerElement();
    expect(registry.has(element)).toBe(true);
    expect(registry.has("cycle")).toBe(true);
    await stop(registry);
    expect(registry.has(element)).toBe(false);
    expect(registry.has("cycle")).toBe(false);
  });
  it("MutationWatcher: ein eingef\xFCgter Knoten, ein Cycle", async () => {
    const registry = await bootRuntime();
    await attachMutationWatcher(registry);
    const original = registry.get("cycle");
    let cycles = 0;
    registry.delete("cycle");
    const wrapped = (root) => {
      cycles += 1;
      return root ? original(root) : original();
    };
    RegistryManager.register(registry, "cycle", wrapped);
    const first = controllerElement();
    const extra = extraAccordion();
    document.body.appendChild(extra);
    await vi.waitFor(() => {
      expect(cycles).toBe(1);
      expect(registry.has(extra)).toBe(true);
    });
    expect(registry.has(first)).toBe(true);
    const compared = CompareManager.last(registry);
    expect(compared.add.length).toBe(1);
    expect(compared.keep.length).toBe(1);
    expect(compared.remove.length).toBe(0);
    await new Promise((resolve) => {
      setTimeout(resolve, 40);
    });
    expect(cycles).toBe(1);
  });
  it("Scope: runCycle am neuen Knoten l\xE4sst bestehende Instanzen auf keep", async () => {
    const registry = await bootRuntime();
    const first = controllerElement();
    const extra = extraAccordion("scoped");
    document.body.appendChild(extra);
    await runCycle(registry, extra);
    const compared = CompareManager.last(registry);
    expect(compared.add.length).toBe(1);
    expect(compared.keep.length).toBe(1);
    expect(compared.remove.length).toBe(0);
    expect(registry.has(first)).toBe(true);
    expect(registry.has(extra)).toBe(true);
    expect(registry.get(first)).toBeTruthy();
    expect(extra.dataset.aspisOrigin).toBe("add");
  });
});
async function bootRuntime() {
  const registry = await start();
  if (!registry) {
    throw new Error("Boot lieferte keine Registry.");
  }
  return registry;
}
async function attachMutationWatcher(registry) {
  if (registry.has("mutationWatcher")) {
    return;
  }
  const WatcherClass = await ImportManager.import(registry, "watchers.MutationWatcher");
  if (typeof WatcherClass !== "function") {
    throw new Error("MutationWatcher nicht geladen.");
  }
  const watcher = new WatcherClass();
  watcher.bind(registry);
  watcher.start(document.body, { childList: true, subtree: true });
  RegistryManager.register(registry, "mutationWatcher", watcher);
}
