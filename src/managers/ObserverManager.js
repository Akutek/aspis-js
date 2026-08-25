/** @typedef {import("../types/managers.js").Registry} Registry */
/** @typedef {import("../types/managers.js").WatcherPrep} WatcherPrep */
/** @typedef {import("../types/managers.js").CompareDifference} CompareDifference */
import { BaseManager } from "./BaseManager.js";
import { ObserverManagerExtension } from "../extensions/observer/ObserverManagerExtension.js";
class ObserverManager extends BaseManager {
  static get extension() {
    return ObserverManagerExtension;
  }
  static get cacheKey() {
    return this.extension.cacheKey;
  }
  static async observe(registry, compared) {
    try {
      const prepared = this.extension.prepare(registry, compared ?? { add: [], keep: [], update: [], remove: [] });
      this.cacheSet(registry, this.cacheKey, prepared);
      const queue = prepared.queue;
      this.info(
        registry,
        `Queue view ${queue.view.length}, near ${queue.near.length}, far ${queue.far.length}, history ${queue.history.length}.`
      );
      if (prepared.skipped) {
        this.info(registry, "Plan ohne Watcher-Hosts, Specifier \xFCbersprungen.");
      } else {
        const hosts = await this.extension.hosts(registry, prepared.specifiers);
        this.extension.watchFar(registry, prepared.queue);
        this.info(registry, `${hosts.length} Watcher-Hosts gebunden.`);
      }
      return prepared;
    } catch (error) {
      this.capture(registry, error);
      const empty = this.extension.empty();
      this.cacheSet(registry, this.cacheKey, empty);
      return empty;
    }
  }
  static last(registry) {
    const stored = this.cacheGet(registry, this.cacheKey, null);
    if (stored && typeof stored === "object" && stored.queue && typeof stored.queue === "object") {
      return {
        skipped: Boolean(stored.skipped),
        specifiers: Array.isArray(stored.specifiers) ? stored.specifiers : [],
        queue: stored.queue
      };
    }
    return this.extension.empty();
  }
}
export {
  ObserverManager
};
