/** @typedef {import("../types/agents.js").DebugErrorAgents} DebugErrorAgents */
/** @typedef {import("../types/agents.js").DebugManifest} DebugManifest */
/** @typedef {import("../types/agents.js").ErrorManifest} ErrorManifest */
import { DebugAgent } from "../agents/DebugAgent.js";
import { ErrorAgent } from "../agents/ErrorAgent.js";
import { DebugAgentExtension } from "../extensions/debug-agent/DebugAgentExtension.js";
import { ErrorAgentExtension } from "../extensions/error-agent/ErrorAgentExtension.js";
class DebugErrorManager {
  /** Erzeugt DebugAgent und ErrorAgent auf basic-Level (Platzhalter für spätere Pipelines). */
  static init() {
    return {
      debug: DebugAgent.shared(),
      error: ErrorAgent.shared()
    };
  }
  static apply(agents, debugManifest = {}, errorManifest = {}, registry = null) {
    if (!agents) return;
    DebugAgentExtension.apply(agents.debug, debugManifest);
    ErrorAgentExtension.apply(agents.error, errorManifest);
    DebugAgentExtension.bind(agents.debug, registry);
    ErrorAgentExtension.bind(agents.error, registry);
  }
  static log(debugAgent, message, ...args) {
    debugAgent.log(message, ...args);
  }
  static info(debugAgent, message, ...args) {
    debugAgent.info(message, ...args);
  }
  static warn(debugAgent, message, ...args) {
    debugAgent.warn(message, ...args);
  }
  static error(errorAgent, message, ...args) {
    errorAgent.error(message, ...args);
  }
  static capture(errorAgent, error, message) {
    errorAgent.capture(error, message);
  }
}
export {
  DebugErrorManager
};
