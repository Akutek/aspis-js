/** @typedef {import("../types/registry.js").Registry} Registry */
import { BaseWatcher } from "./BaseWatcher.js";
import { ReportingWatcherExtension } from "../extensions/watcher/ReportingWatcherExtension.js";
class ReportingWatcher extends BaseWatcher {
  static get extension() {
    return ReportingWatcherExtension;
  }
  get kind() {
    return "reporting";
  }
  bind(registry = null) {
    return ReportingWatcherExtension.bind(this, registry);
  }
  start(init) {
    return ReportingWatcherExtension.start(this, init);
  }
  stop() {
    return ReportingWatcherExtension.stop(this);
  }
}
export {
  ReportingWatcher
};
