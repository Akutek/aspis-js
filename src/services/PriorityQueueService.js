/** @typedef {import("../types/queue.js").PriorityQueuePattern} PriorityQueuePattern */
class PriorityQueueService {
  static sort(items, pattern = {}) {
    if (!Array.isArray(items)) {
      return [];
    }
    if (items.length < 2) {
      return items.slice();
    }
    const direction = pattern.direction === "desc" ? -1 : 1;
    const ranked = [];
    for (let i = 0; i < items.length; i += 1) {
      ranked.push({
        item: items[i],
        index: i,
        rank: this.#rank(items[i], pattern)
      });
    }
    ranked.sort((left, right) => {
      if (left.rank !== right.rank) {
        return (left.rank - right.rank) * direction;
      }
      return left.index - right.index;
    });
    const sorted = [];
    for (let i = 0; i < ranked.length; i += 1) {
      sorted.push(ranked[i].item);
    }
    return sorted;
  }
  static #rank(item, pattern) {
    if (item && typeof item === "object" && "rank" in item && typeof item.rank === "number" && Number.isFinite(item.rank)) {
      return item.rank;
    }
    const key = this.#key(item, pattern);
    const ranks = pattern.ranks && typeof pattern.ranks === "object" ? pattern.ranks : {};
    if (key && typeof ranks[key] === "number" && Number.isFinite(ranks[key])) {
      return ranks[key];
    }
    const order = Array.isArray(pattern.order) ? pattern.order : [];
    if (key && order.length > 0) {
      const at = order.indexOf(key);
      if (at >= 0) {
        return at;
      }
    }
    return Number.POSITIVE_INFINITY;
  }
  static #key(item, pattern) {
    if (!item || typeof item !== "object") {
      return "";
    }
    const field = typeof pattern.key === "string" && pattern.key.trim() ? pattern.key.trim() : "type";
    const value = item[field];
    return typeof value === "string" ? value.trim().toLowerCase() : "";
  }
}
export {
  PriorityQueueService
};
