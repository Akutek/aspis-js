/** @typedef {import("../types/registry.js").Registry} Registry */
import { BaseWatcher } from "./BaseWatcher.js";
import { IntersectionWatcherExtension } from "../extensions/watcher/IntersectionWatcherExtension.js";
class IntersectionWatcher extends BaseWatcher {
  static get extension() {
    return IntersectionWatcherExtension;
  }
  get kind() {
    return "intersection";
  }
  bind(registry = null) {
    return IntersectionWatcherExtension.bind(this, registry);
  }
  start(target, init) {
    return IntersectionWatcherExtension.start(this, target, init);
  }
  observe(target, init) {
    return IntersectionWatcherExtension.observe(this, target, init);
  }
  stop() {
    return IntersectionWatcherExtension.stop(this);
  }
}
export {
  IntersectionWatcher
};
