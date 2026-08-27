/** @typedef {import("../../types/channel.js").ChannelRuntime} ChannelRuntime */
/** @typedef {import("../../types/extensions.js").ExtensionHost} ExtensionHost */
/** @typedef {import("../../types/registry.js").Registry} Registry */
import { BaseExtension } from "../BaseExtension.js";
import { DebugAgent } from "../../agents/DebugAgent.js";
import { ErrorAgent } from "../../agents/ErrorAgent.js";
import { RegistryManager } from "../../managers/RegistryManager.js";
class ChannelExtension extends BaseExtension {
  /**
   * @param {ExtensionHost} channel
   */
  static prepare(channel) {
    super.prepare(channel, {
      debug: null,
      error: null,
      dispatcher: null,
      registry: null
    });
    if (channel.manifest == null) {
      channel.manifest = {};
    }
    return this;
  }
  /**
   * @param {ExtensionHost} channel
   * @param {Registry | null} [registry]
   */
  static bind(channel, registry = null) {
    if (!channel) {
      return this;
    }
    if (!channel.runtime) {
      this.prepare(channel);
    }
    if (!channel.runtime) {
      return this;
    }
    const runtime = /** @type {ChannelRuntime} */ (channel.runtime);
    runtime.debug = this.#from(registry, "debug", DebugAgent.shared());
    runtime.error = this.#from(registry, "error", ErrorAgent.shared());
    runtime.dispatcher = this.#from(registry, "dispatcher", null);
    runtime.registry = registry;
    return this;
  }
  static #from(registry, key, fallback) {
    if (registry && typeof registry.has === "function" && registry.has(key)) {
      return RegistryManager.get(registry, key);
    }
    return fallback;
  }
}
export {
  ChannelExtension
};
