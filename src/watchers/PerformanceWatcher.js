/** @typedef {import("../types/registry.js").Registry} Registry */
import { BaseWatcher } from "./BaseWatcher.js";
import { PerformanceWatcherExtension } from "../extensions/watcher/PerformanceWatcherExtension.js";
class PerformanceWatcher extends BaseWatcher {
  static get extension() {
    return PerformanceWatcherExtension;
  }
  get kind() {
    return "performance";
  }
  bind(registry = null) {
    return PerformanceWatcherExtension.bind(this, registry);
  }
  start(init) {
    return PerformanceWatcherExtension.start(this, init);
  }
  stop() {
    return PerformanceWatcherExtension.stop(this);
  }
}
export {
  PerformanceWatcher
};
