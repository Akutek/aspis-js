/** @typedef {import("../types/agents.js").ErrorManifest} ErrorManifest */
/** @typedef {import("../types/extensions.js").BaseExpansion} BaseExpansion */
import { ErrorAgentExtension } from "../extensions/error-agent/ErrorAgentExtension.js";
class ErrorAgent {
  /** @type {ErrorAgent | null} */
  static #shared = null;
  #namespace = "";
  /** Die ErrorAgentExtension-Klasse (statisch). Kein zweites Objekt. */
  extension;
  manifest;
  runtime;
  constructor(namespace) {
    this.#namespace = namespace;
    this.manifest = {};
    this.extension = ErrorAgentExtension;
    this.runtime = null;
    ErrorAgentExtension.prepare(this);
  }
  /** Liefert die gemeinsame Error-Instanz (legt sie bei Bedarf an). */
  static shared() {
    if (!this.#shared) {
      this.#shared = new ErrorAgent("aspis");
    }
    return this.#shared;
  }
  get namespace() {
    return this.#namespace;
  }
  setNamespace(namespace) {
    if (typeof namespace === "string" && namespace.trim()) {
      this.#namespace = namespace.trim();
    }
  }
  hydrate(manifest) {
    ErrorAgentExtension.apply(this, manifest);
  }
  expand(expansion = {}) {
    return ErrorAgentExtension.expand(this, expansion);
  }
  error(message, ...args) {
    ErrorAgentExtension.emit(this, "error", message, args);
  }
  /**
   * @param {unknown} error
   * @param {any} [message]
   */
  capture(error, message = "") {
    const text = typeof message === "string" && message ? message : message && typeof message === "object" && "message" in message ? String(message.message ?? "") : (error instanceof Error ? error.message : "") || "ErrorAgent.capture()";
    ErrorAgentExtension.emit(this, "error", text, [error]);
  }
  /** Wirft einen kontrollierten Systemfehler inkl. Kontext und bricht hart ab. */
  throw(message, ...args) {
    this.error(message, ...args);
    const text = typeof message === "string" ? message : message && typeof message === "object" && "message" in message ? String(message.message ?? "") : "ErrorAgent.throw()";
    throw new Error(`[Aspis Error][${this.#namespace}] ${text}`);
  }
}
export {
  ErrorAgent
};
