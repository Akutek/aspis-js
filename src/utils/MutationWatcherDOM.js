/** @typedef {import("../types/watchers.js").MutationBatch} MutationBatch */
class MutationWatcherDOM {
  static collect(records) {
    const added = [];
    const removed = [];
    if (!Array.isArray(records)) {
      return { added, removed };
    }
    for (let i = 0; i < records.length; i += 1) {
      const record = records[i];
      this.#pushElements(removed, record && record.removedNodes);
      this.#pushElements(added, record && record.addedNodes);
    }
    return {
      added: this.roots(added),
      removed: this.roots(removed)
    };
  }
  static roots(nodes) {
    if (!Array.isArray(nodes) || nodes.length < 2) {
      return Array.isArray(nodes) ? nodes.slice() : [];
    }
    const unique = [];
    for (let i = 0; i < nodes.length; i += 1) {
      const node = nodes[i];
      if (!node || unique.includes(node)) {
        continue;
      }
      unique.push(node);
    }
    return unique.filter((node) => {
      for (let i = 0; i < unique.length; i += 1) {
        const other = unique[i];
        if (other !== node && other.contains(node)) {
          return false;
        }
      }
      return true;
    });
  }
  static #pushElements(list, nodes) {
    if (!nodes || !nodes.length) {
      return;
    }
    for (let i = 0; i < nodes.length; i += 1) {
      const node = nodes[i];
      if (node instanceof HTMLElement) {
        list.push(node);
      }
    }
  }
}
export {
  MutationWatcherDOM
};
