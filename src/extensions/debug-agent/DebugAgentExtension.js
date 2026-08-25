/** @typedef {import("../../types/agents.js").DebugAgent} DebugAgent */
/** @typedef {import("../../types/agents.js").DebugManifest} DebugManifest */
/** @typedef {import("../../types/agents.js").AgentHost} AgentHost */
/** @typedef {import("../../types/registry.js").Registry} Registry */
import { BaseExtension } from "../BaseExtension.js";
import { AgentEnvelope } from "../../agents/AgentEnvelope.js";
class DebugAgentExtension extends BaseExtension {
  static prepare(agent) {
    super.prepare(agent, {
      registry: null,
      filter: { levels: null, areas: null, context: [] }
    });
    if (agent.manifest == null) {
      agent.manifest = {};
    }
    return this;
  }
  static apply(agent, manifest = {}) {
    super.apply(agent, manifest);
    if (typeof manifest.settings?.debug === "boolean") {
      agent.setDebugState(manifest.settings.debug);
    }
    if (typeof manifest.settings?.namespace === "string" && manifest.settings.namespace) {
      agent.setNamespace(manifest.settings.namespace);
    }
    AgentEnvelope.installFilter(agent, manifest.settings || {});
    if (Array.isArray(manifest?.pipelines)) {
      if (!agent.runtime) this.prepare(agent);
      if (agent.runtime) {
        agent.runtime[this.pipelineKey] = [];
      }
      manifest.pipelines.forEach((entry) => this.use(agent, entry));
    }
    return this;
  }
  static bind(agent, registry = null) {
    if (!agent) {
      return this;
    }
    if (!agent.runtime) {
      this.prepare(agent);
    }
    if (agent.runtime) {
      agent.runtime.registry = registry;
    }
    return this;
  }
  /** Filter, Umschlag, Konsole, Pipeline. Store/Cache nur nach den Checks. */
  static emit(agent, type, message, args = []) {
    const area = AgentEnvelope.areaOf(message);
    if (!AgentEnvelope.allowsDebug(agent, type, area)) {
      return;
    }
    const envelope = AgentEnvelope.build(agent, type, message, args);
    AgentEnvelope.print(envelope);
    AgentEnvelope.forward(agent, this, envelope);
  }
  static graft(agent, extraManifest = {}) {
    const base = agent.manifest || {};
    const extra = extraManifest || {};
    agent.manifest = {
      ...base,
      ...extra,
      settings: { ...base.settings || {}, ...extra.settings || {} },
      pipelines: [...base.pipelines || [], ...extra.pipelines || []]
    };
    AgentEnvelope.installFilter(agent, agent.manifest.settings || {});
    if (typeof extra.settings?.debug === "boolean") {
      agent.setDebugState(extra.settings.debug);
    }
    (extra.pipelines || []).forEach((entry) => this.use(agent, entry));
    return this;
  }
}
export {
  DebugAgentExtension
};
