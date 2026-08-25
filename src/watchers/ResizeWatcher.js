/** @typedef {import("../types/registry.js").Registry} Registry */
import { BaseWatcher } from "./BaseWatcher.js";
import { ResizeWatcherExtension } from "../extensions/watcher/ResizeWatcherExtension.js";
class ResizeWatcher extends BaseWatcher {
  static get extension() {
    return ResizeWatcherExtension;
  }
  get kind() {
    return "resize";
  }
  bind(registry = null) {
    return ResizeWatcherExtension.bind(this, registry);
  }
  start(target) {
    return ResizeWatcherExtension.start(this, target);
  }
  observe(target) {
    return ResizeWatcherExtension.observe(this, target);
  }
  stop() {
    return ResizeWatcherExtension.stop(this);
  }
}
export {
  ResizeWatcher
};
