/** @typedef {import("../types/extensions.js").BaseExpansion} BaseExpansion */
/** @typedef {import("../types/agents.js").DebugManifest} DebugManifest */
/** @typedef {import("../types/agents.js").DebugState} DebugState */
import { DebugAgentExtension } from "../extensions/debug-agent/DebugAgentExtension.js";
class DebugAgent {
  /** @type {DebugAgent | null} */
  static #shared = null;
  #namespace = "";
  #debugState = null;
  /** Die DebugAgentExtension-Klasse (statisch). Kein zweites Objekt. */
  extension;
  manifest;
  runtime;
  constructor(namespace = "aspis") {
    this.#namespace = namespace;
    this.manifest = {};
    this.extension = DebugAgentExtension;
    this.runtime = null;
    DebugAgentExtension.prepare(this);
  }
  /** Liefert die gemeinsame Debug-Instanz (legt sie bei Bedarf an). */
  static shared() {
    if (!this.#shared) {
      this.#shared = new DebugAgent("aspis");
    }
    return this.#shared;
  }
  static init(debugState) {
    if (typeof debugState === "boolean") {
      this.shared().setDebugState(debugState);
    }
  }
  static debug(message, ...args) {
    this.shared().debug(message, ...args);
  }
  static info(message, ...args) {
    this.shared().info(message, ...args);
  }
  static warn(message, ...args) {
    this.shared().warn(message, ...args);
  }
  static error(message, ...args) {
    this.shared().error(message, ...args);
  }
  get namespace() {
    return this.#namespace;
  }
  setNamespace(namespace) {
    if (typeof namespace === "string" && namespace.trim()) {
      this.#namespace = namespace.trim();
    }
  }
  get debugState() {
    return this.#debugState;
  }
  setDebugState(state) {
    if (typeof state === "boolean" || state === null) {
      this.#debugState = state;
    }
  }
  /** Wendet ein Debug-Manifest an (Pipelines). Logik liegt an DebugAgentExtension.apply. */
  hydrate(manifest) {
    DebugAgentExtension.apply(this, manifest);
  }
  expand(expansion = {}) {
    return DebugAgentExtension.expand(this, expansion);
  }
  #emit(type, message, ...args) {
    DebugAgentExtension.emit(this, type, message, args);
  }
  log(message, ...args) {
    this.#emit("log", message, ...args);
  }
  debug(message, ...args) {
    this.#emit("log", message, ...args);
  }
  info(message, ...args) {
    this.#emit("info", message, ...args);
  }
  warn(message, ...args) {
    this.#emit("warn", message, ...args);
  }
  error(message, ...args) {
    this.#emit("error", message, ...args);
  }
}
export {
  DebugAgent
};
