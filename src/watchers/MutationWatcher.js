/** @typedef {import("../types/registry.js").Registry} Registry */
import { BaseWatcher } from "./BaseWatcher.js";
import { MutationWatcherExtension } from "../extensions/watcher/MutationWatcherExtension.js";
class MutationWatcher extends BaseWatcher {
  static get extension() {
    return MutationWatcherExtension;
  }
  get kind() {
    return "mutation";
  }
  bind(registry = null) {
    return MutationWatcherExtension.bind(this, registry);
  }
  start(target, init) {
    return MutationWatcherExtension.start(this, target, init);
  }
  observe(target, init) {
    return MutationWatcherExtension.observe(this, target, init);
  }
  stop() {
    return MutationWatcherExtension.stop(this);
  }
}
export {
  MutationWatcher
};
