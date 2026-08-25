/** @typedef {import("../types/extensions.js").BaseExpansion} BaseExpansion */
/** @typedef {import("../types/watchers.js").WatcherRuntime} WatcherRuntime */
import { BaseWatcherExtension } from "../extensions/watcher/BaseWatcherExtension.js";
class BaseWatcher {
  extension;
  manifest;
  runtime;
  get kind() {
    return "base";
  }
  static get extension() {
    return BaseWatcherExtension;
  }
  constructor() {
    const Ext = /** @type {typeof BaseWatcher} */ (this.constructor).extension;
    this.extension = Ext;
    this.manifest = {};
    this.runtime = null;
    Ext.prepare(this);
  }
  expand(expansion = {}) {
    return this.extension.expand(this, expansion);
  }
}
export {
  BaseWatcher
};
