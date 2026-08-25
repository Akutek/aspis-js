/** @typedef {import("../../types/managers.js").Plan} Plan */
/** @typedef {import("../../types/managers.js").PlanItem} PlanItem */
/** @typedef {import("../../types/managers.js").ScanResults} ScanResults */
/** @typedef {import("../../types/managers.js").CompareDifference} CompareDifference */
/** @typedef {import("../../types/managers.js").ControllerScanResult} ControllerScanResult */
class CompareManagerExtension {
  static get cacheKey() {
    return "compare:difference";
  }
  static get liveKey() {
    return "compare:live";
  }
  static empty(plan) {
    const safe = plan && typeof plan === "object" ? plan : { scanResults: [], items: [], specifiers: [], needs: [] };
    return { add: [], keep: [], update: [], remove: [], plan: safe };
  }
  static compare(plan, live) {
    const wanted = this.#wanted(plan);
    const present = Array.isArray(live) ? live.filter(Boolean) : [];
    return this.#difference(wanted, present, plan);
  }
  static #wanted(plan) {
    if (plan && Array.isArray(plan.items) && plan.items.length > 0) {
      return plan.items.filter(Boolean);
    }
    return [];
  }
  static #difference(wanted, live, plan) {
    const liveMap = this.#byElement(live);
    const wantedMap = this.#byElement(wanted);
    const add = [];
    const keep = [];
    const update = [];
    const remove = [];
    for (let i = 0; i < wanted.length; i += 1) {
      const item = wanted[i];
      if (!item) {
        continue;
      }
      const present = item.element ? liveMap.get(item.element) : void 0;
      if (item.element && present) {
        if (this.#sameDuty(item, present)) {
          keep.push(item);
        } else {
          update.push(item);
        }
      } else {
        add.push(item);
      }
    }
    for (let i = 0; i < live.length; i += 1) {
      const item = live[i];
      if (item?.element && !wantedMap.has(item.element)) {
        remove.push(this.#asItem(item));
      }
    }
    return { add, keep, update, remove, plan };
  }
  /** Gleicher Knoten, gleiche Pflicht (Typ, Layout, Slice, Mixins). Sonst `update`. */
  static #sameDuty(wanted, live) {
    return this.#duty(wanted) === this.#duty(this.#asItem(live));
  }
  static #duty(item) {
    return [
      String(item.type || ""),
      String(item.layout || ""),
      item.sliceKey == null ? "" : String(item.sliceKey),
      this.#list(item.specifiers),
      this.#list(item.mixins),
      this.#list(item.compositions)
    ].join("");
  }
  static #list(value) {
    return Array.isArray(value) ? value.map(String).join("") : "";
  }
  static #byElement(items) {
    const map = /* @__PURE__ */ new Map();
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      if (item?.element) {
        map.set(item.element, item);
      }
    }
    return map;
  }
  static #asItem(item) {
    if (item && typeof item === "object" && Array.isArray(item.specifiers)) {
      return item;
    }
    const bag = item;
    return {
      type: bag.type || "",
      layout: bag.layout || "",
      element: bag.element,
      specifiers: [],
      needs: []
    };
  }
}
export {
  CompareManagerExtension
};
