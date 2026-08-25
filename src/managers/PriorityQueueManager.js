/** @typedef {import("../types/registry.js").Registry} Registry */
/** @typedef {import("../types/queue.js").PriorityQueuePattern} PriorityQueuePattern */
import { BaseManager } from "./BaseManager.js";
import { PriorityQueueExtension } from "../extensions/priority-queue/PriorityQueueExtension.js";
class PriorityQueueManager extends BaseManager {
  static get extension() {
    return PriorityQueueExtension;
  }
  static pattern(registry) {
    const stored = this.cacheGet(registry, this.extension.patternKey, null);
    if (stored && typeof stored === "object") {
      return this.extension.normalize(stored);
    }
    return this.extension.empty();
  }
  static sort(registry, items, pattern) {
    try {
      const merged = this.extension.merge(this.pattern(registry), pattern ?? {});
      return this.extension.sort(items, merged);
    } catch (error) {
      this.capture(registry, error);
      return Array.isArray(items) ? items.slice() : [];
    }
  }
  static expand(registry, expansion = {}) {
    const next = this.extension.merge(this.pattern(registry), expansion);
    this.cacheSet(registry, this.extension.patternKey, next);
    return next;
  }
}
export {
  PriorityQueueManager
};
