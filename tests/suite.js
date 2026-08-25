/** @typedef {import("../src/types/registry.js").Registry} Registry */
import { start, stop, runCycle } from "../src/aspis.js";

/**
 * @param {number|string} id
 * @returns {HTMLElement}
 */
export function accordion(id) {
  const el = document.createElement("div");
  el.setAttribute("data-controller", "accordion");
  el.setAttribute("data-slice-key", "features.accordionFeature");
  el.setAttribute("data-single-open", "true");
  el.innerHTML =
    `<div data-accordion-item data-id="t${id}">` +
    `<button type="button" data-target="trigger">T${id}</button>` +
    `<div data-target="panel">x</div></div>`;
  return el;
}

/**
 * @param {Registry} registry
 * @returns {{add: number, keep: number, update: number, remove: number}}
 */
export function counts(registry) {
  const cache = registry.get("cache");
  const diff = cache && typeof cache.get === "function" ? cache.get("compare:difference") : null;
  return {
    add: Array.isArray(diff?.add) ? diff.add.length : 0,
    keep: Array.isArray(diff?.keep) ? diff.keep.length : 0,
    update: Array.isArray(diff?.update) ? diff.update.length : 0,
    remove: Array.isArray(diff?.remove) ? diff.remove.length : 0
  };
}

/**
 * @param {ParentNode} root
 * @param {Registry} registry
 * @returns {number}
 */
export function bound(root, registry) {
  return [...root.querySelectorAll("[data-controller]")].filter((el) => registry.has(el)).length;
}

/**
 * @param {() => Promise<unknown>} fn
 * @returns {Promise<number>}
 */
export async function timed(fn) {
  const t0 = performance.now();
  await fn();
  return Math.round(performance.now() - t0);
}

/**
 * @param {boolean} cond
 * @param {string} msg
 */
function assert(cond, msg) {
  if (!cond) {
    throw new Error(msg);
  }
}

/**
 * @param {HTMLElement} stage
 * @returns {Promise<{name: string, detail: string}[]>}
 */
export async function lifecycle(stage) {
  await stop();
  stage.replaceChildren(accordion(0), accordion(1));
  const registry = await start();
  if (!registry) {
    throw new Error("start() ohne Registry");
  }
  const first = counts(registry);
  assert(first.add === 2 && first.keep === 0 && first.update === 0 && first.remove === 0, `start add: ${JSON.stringify(first)}`);
  assert(bound(stage, registry) === 2, `start bound=${bound(stage, registry)}`);

  await runCycle(registry);
  const kept = counts(registry);
  assert(kept.add === 0 && kept.keep === 2 && kept.update === 0 && kept.remove === 0, `keep: ${JSON.stringify(kept)}`);

  stage.append(accordion(2));
  await runCycle(registry);
  const added = counts(registry);
  assert(added.add === 1 && added.keep === 2, `add: ${JSON.stringify(added)}`);
  assert(bound(stage, registry) === 3, `add bound=${bound(stage, registry)}`);

  const firstNode = stage.firstElementChild;
  if (!(firstNode instanceof HTMLElement)) {
    throw new Error("kein erstes Accordion");
  }
  firstNode.dataset.layout = "alt";
  await runCycle(registry);
  const updated = counts(registry);
  assert(updated.update === 1, `update: ${JSON.stringify(updated)}`);

  firstNode.remove();
  await runCycle(registry);
  const removed = counts(registry);
  assert(removed.remove === 1 && removed.keep === 2, `remove: ${JSON.stringify(removed)}`);
  assert(bound(stage, registry) === 2, `remove bound=${bound(stage, registry)}`);

  await stop(registry);
  assert(bound(stage, registry) === 0, `stop bound=${bound(stage, registry)}`);
  stage.replaceChildren();

  return [
    { name: "start → add 2", detail: JSON.stringify(first) },
    { name: "keep-cycle", detail: JSON.stringify(kept) },
    { name: "DOM-add → add 1", detail: JSON.stringify(added) },
    { name: "layout → update 1", detail: JSON.stringify(updated) },
    { name: "DOM-remove → remove 1", detail: JSON.stringify(removed) },
    { name: "stop → destroy", detail: "bound=0" }
  ];
}

/**
 * @param {HTMLElement} stage
 * @param {number} n
 * @returns {Promise<{n: number, startup: number, keep: number, add1: number, churnAdd: number, churnRemove: number, first: object, afterKeep: object, afterAdd: object}>}
 */
export async function pressure(stage, n) {
  await stop();
  stage.classList.add("pressure");
  stage.replaceChildren();
  for (let i = 0; i < n; i += 1) {
    stage.append(accordion(i));
  }
  /** @type {Registry|null} */
  let registry = null;
  const startup = await timed(async () => {
    registry = await start();
  });
  if (!registry) {
    throw new Error("start() ohne Registry");
  }
  const first = counts(registry);
  assert(first.add === n && first.keep === 0, `start n=${n}: ${JSON.stringify(first)}`);
  const keep = await timed(() => runCycle(registry));
  const afterKeep = counts(registry);
  assert(afterKeep.add === 0 && afterKeep.keep === n, `keep n=${n}: ${JSON.stringify(afterKeep)}`);
  stage.append(accordion(n));
  const add1 = await timed(() => runCycle(registry));
  const afterAdd = counts(registry);
  assert(afterAdd.add === 1 && afterAdd.keep === n, `+1 n=${n}: ${JSON.stringify(afterAdd)}`);
  const batch = [];
  for (let i = 0; i < 10; i += 1) {
    const el = accordion(`c${i}`);
    batch.push(el);
    stage.append(el);
  }
  const churnAdd = await timed(() => runCycle(registry));
  for (let i = 0; i < batch.length; i += 1) {
    batch[i].remove();
  }
  const churnRemove = await timed(() => runCycle(registry));
  await stop(registry);
  stage.classList.remove("pressure");
  stage.replaceChildren();
  return { n, startup, keep, add1, churnAdd, churnRemove, first, afterKeep, afterAdd };
}
