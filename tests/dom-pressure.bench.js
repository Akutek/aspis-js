/** @typedef {import("../src/types/registry.js").Registry} Registry */
import { afterEach, beforeAll, bench, describe, vi } from "vitest";
import { accordionForest, extraAccordion } from "./helpers/accordion-fixture.js";
import { fileFetch } from "./helpers/file-fetch.js";
import { useFileAssetRoot } from "./helpers/file-assets.js";
let start;
let stop;
let runCycle;
let host = null;
beforeAll(async () => {
  useFileAssetRoot();
  const aspis = await import("../src/aspis.js");
  start = aspis.start;
  stop = aspis.stop;
  runCycle = aspis.runCycle;
});
afterEach(async () => {
  if (host) {
    await stop(host);
    host = null;
  } else if (typeof stop === "function") {
    await stop();
  }
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});
describe("Druck 10 Controller", () => {
  bench("startup", async () => {
    host = await boot();
  }, {
    warmupIterations: 1,
    iterations: 3,
    setup: prepareForest(10),
    teardown: releaseHost
  });
  bench("keep-cycle", async () => {
    if (!host) {
      throw new Error("Kein Host.");
    }
    await runCycle(host);
  }, {
    warmupIterations: 1,
    iterations: 3,
    setup: prepareBooted(10),
    teardown: releaseHost
  });
  bench("scoped-add", async () => {
    if (!host) {
      throw new Error("Kein Host.");
    }
    const extra = extraAccordion("b10");
    document.body.appendChild(extra);
    await runCycle(host, extra);
  }, {
    warmupIterations: 1,
    iterations: 3,
    setup: prepareBooted(10),
    teardown: releaseHost
  });
});
describe("Druck 100 Controller", () => {
  bench("startup", async () => {
    host = await boot();
  }, {
    warmupIterations: 0,
    iterations: 2,
    setup: prepareForest(100),
    teardown: releaseHost
  });
  bench("keep-cycle", async () => {
    if (!host) {
      throw new Error("Kein Host.");
    }
    await runCycle(host);
  }, {
    warmupIterations: 0,
    iterations: 2,
    setup: prepareBooted(100),
    teardown: releaseHost
  });
  bench("scoped-add", async () => {
    if (!host) {
      throw new Error("Kein Host.");
    }
    const extra = extraAccordion("b100");
    document.body.appendChild(extra);
    await runCycle(host, extra);
  }, {
    warmupIterations: 0,
    iterations: 2,
    setup: prepareBooted(100),
    teardown: releaseHost
  });
});
describe("Druck 1000 Controller", () => {
  bench("startup", async () => {
    host = await boot();
    logHeap("startup-1000");
  }, {
    warmupIterations: 0,
    iterations: 1,
    setup: prepareForest(1e3),
    teardown: releaseHost
  });
  bench("keep-cycle", async () => {
    if (!host) {
      throw new Error("Kein Host.");
    }
    await runCycle(host);
    logHeap("keep-1000");
  }, {
    warmupIterations: 0,
    iterations: 1,
    setup: prepareBooted(1e3),
    teardown: releaseHost
  });
  bench("churn-add-remove", async () => {
    if (!host) {
      throw new Error("Kein Host.");
    }
    const extra = extraAccordion("churn");
    document.body.appendChild(extra);
    await runCycle(host, extra);
    extra.remove();
    await runCycle(host);
    logHeap("churn-1000");
  }, {
    warmupIterations: 0,
    iterations: 1,
    setup: prepareBooted(1e3),
    teardown: releaseHost
  });
});
function prepareForest(count) {
  return () => {
    vi.stubGlobal("fetch", fileFetch);
    document.body.innerHTML = accordionForest(count);
  };
}
function prepareBooted(count) {
  return async () => {
    vi.stubGlobal("fetch", fileFetch);
    document.body.innerHTML = accordionForest(count);
    host = await boot();
  };
}
async function releaseHost() {
  if (host) {
    await stop(host);
    host = null;
  }
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
}
async function boot() {
  const registry = await start();
  if (!registry) {
    throw new Error("Boot lieferte keine Registry.");
  }
  return registry;
}
function logHeap(label) {
  const heap = process.memoryUsage();
  const used = Math.round(heap.heapUsed / 1024 / 1024);
  const rss = Math.round(heap.rss / 1024 / 1024);
  process.stdout.write(`[bench] ${label} heapUsed ${used}MB rss ${rss}MB
`);
}
