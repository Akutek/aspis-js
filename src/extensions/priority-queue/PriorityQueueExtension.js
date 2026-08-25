/** @typedef {import("../../types/queue.js").PriorityQueuePattern} PriorityQueuePattern */
import { PriorityQueueService } from "../../services/PriorityQueueService.js";
class PriorityQueueExtension {
  static get patternKey() {
    return "priority-queue:pattern";
  }
  static empty() {
    return { ranks: {}, order: [], key: "type", direction: "asc" };
  }
  static normalize(pattern) {
    const base = this.empty();
    if (!pattern || typeof pattern !== "object") {
      return base;
    }
    const ranks = pattern.ranks && typeof pattern.ranks === "object" ? { ...pattern.ranks } : {};
    const order = Array.isArray(pattern.order) ? pattern.order.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim().toLowerCase()) : [];
    const key = typeof pattern.key === "string" && pattern.key.trim() ? pattern.key.trim() : base.key;
    const direction = pattern.direction === "desc" ? "desc" : "asc";
    return { ranks, order, key, direction };
  }
  static merge(current, extra) {
    const left = this.normalize(current);
    const right = this.normalize(extra);
    const order = (left.order ?? []).slice();
    const rightOrder = right.order ?? [];
    for (let i = 0; i < rightOrder.length; i += 1) {
      if (!order.includes(rightOrder[i])) {
        order.push(rightOrder[i]);
      }
    }
    return {
      ranks: { ...left.ranks, ...right.ranks },
      order,
      key: extra && typeof extra.key === "string" && extra.key.trim() ? right.key : left.key,
      direction: extra && extra.direction ? right.direction : left.direction
    };
  }
  static sort(items, pattern) {
    return PriorityQueueService.sort(items, this.normalize(pattern));
  }
}
export {
  PriorityQueueExtension
};
