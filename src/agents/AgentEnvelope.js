/** @typedef {import("../types/agents.js").AgentEnvelopeRecord} AgentEnvelopeRecord */
/** @typedef {import("../types/agents.js").AgentFilter} AgentFilter */
/** @typedef {import("../types/agents.js").AgentHost} AgentHost */
/** @typedef {import("../types/agents.js").AgentMessage} AgentMessage */
/** @typedef {import("../types/agents.js").RegistryLike} RegistryLike */
const AREA_FROM_PREFIX = [
  ["basecontroller", "controller"],
  ["controllerregistry", "controller"],
  ["eventdispatcher", "events"],
  ["controllereventdelegator", "controller"],
  ["eventdelegator", "events"],
  ["cachepipelinehelper", "cache"],
  ["storeexpandmanager", "store"],
  ["renderservice", "render"],
  ["templatecatalog", "render"],
  ["templateservice", "render"],
  ["schemacatalog", "schema"],
  ["modifierdom", "render"],
  ["datafetcher", "fetch"],
  ["datenfetcher", "fetch"],
  ["manifestloader", "import"],
  ["manifestbinder", "store"],
  ["formfieldservice", "controller"],
  ["validationservice", "controller"],
  ["controllerloadinghelper", "controller"],
  ["controllercleaner", "controller"],
  ["controllerdropdown", "controller"],
  ["componentcleaner", "controller"],
  ["manifesttargetresolver", "controller"],
  ["targetresolver", "controller"],
  ["loadingstate", "controller"],
  ["storedomdependencyscanner", "store"],
  ["guarddom", "scan"],
  ["scannerdom", "scan"],
  ["domdependencyscanner", "scan"],
  ["basewatcherextension", "watcher"],
  ["basewatcher", "watcher"],
  ["mutationwatcherextension", "watcher"],
  ["mutationwatcherdom", "watcher"],
  ["mutationwatcher", "watcher"],
  ["intersectionwatcherextension", "watcher"],
  ["intersectionwatcherdom", "watcher"],
  ["intersectionwatcher", "watcher"],
  ["resizewatcherextension", "watcher"],
  ["resizewatcherdom", "watcher"],
  ["resizewatcher", "watcher"],
  ["performancewatcherextension", "watcher"],
  ["performancewatcher", "watcher"],
  ["reportingwatcherextension", "watcher"],
  ["reportingwatcher", "watcher"],
  ["mutationobserver", "watcher"],
  ["appconfig", "boot"],
  ["debugmanifest", "debug"],
  ["errormanifest", "error"],
  ["planmanifest", "plan"],
  ["statemanifest", "store"],
  ["registrymanifest", "registry"],
  ["templatemanifest", "hydrate"],
  ["schemamanifest", "schema"],
  ["eventmanifest", "events"],
  ["basehydrator", "hydrate"],
  ["hydrator", "hydrate"],
  ["priorityqueue", "queue"],
  ["runcycle", "cycle"],
  ["mixin", "compose"],
  ["composition", "compose"],
  ["observer", "watcher"],
  ["watcher", "watcher"],
  ["scanner", "scan"],
  ["importer", "import"],
  ["store", "store"],
  ["registry", "registry"],
  ["import", "import"],
  ["boot", "boot"],
  ["cache", "cache"],
  ["debug", "debug"],
  ["error", "error"],
  ["controller", "controller"],
  ["schemaservice", "schema"],
  ["splicer", "splicer"],
  ["scan", "scan"],
  ["plan", "plan"],
  ["compare", "compare"],
  ["factory", "factory"],
  ["compose", "compose"],
  ["tailor", "tailor"],
  ["main", "boot"]
];
function isAgentMessageRecord(value) {
  return Boolean(value) && typeof value === "object";
}
class AgentEnvelope {
  static levelOf(type) {
    return type === "log" ? "debug" : type;
  }
  static areaOf(message) {
    if (isAgentMessageRecord(message) && typeof message.area === "string") {
      return message.area.trim().toLowerCase() || "app";
    }
    const text = this.textOf(message);
    const match = text.match(/^\[([A-Za-z]+)/);
    if (!match) {
      return "app";
    }
    const token = match[1].toLowerCase();
    for (let i = 0; i < AREA_FROM_PREFIX.length; i += 1) {
      if (token.startsWith(AREA_FROM_PREFIX[i][0])) {
        return AREA_FROM_PREFIX[i][1];
      }
    }
    return "app";
  }
  static textOf(message) {
    if (typeof message === "string") {
      return message;
    }
    if (message && typeof message === "object" && "message" in message && typeof message.message === "string") {
      return message.message;
    }
    return String(message ?? "");
  }
  static installFilter(agent, settings = {}) {
    if (!agent?.runtime) {
      return;
    }
    const levels = Array.isArray(settings.levels) ? settings.levels : [];
    const areas = Array.isArray(settings.areas) ? settings.areas : [];
    agent.runtime.filter = {
      levels: levels.length > 0 ? new Set(levels.map((item) => String(item).toLowerCase())) : null,
      areas: areas.length > 0 ? new Set(areas.map((item) => String(item).toLowerCase())) : null,
      context: Array.isArray(settings.context) ? settings.context.slice() : []
    };
  }
  static allowsDebug(agent, type, area) {
    const level = this.levelOf(type);
    if (level === "error") {
      return true;
    }
    if (agent.debugState === false) {
      return false;
    }
    const filter = agent.runtime?.filter;
    if (filter?.levels && !filter.levels.has(level)) {
      return false;
    }
    if (filter?.areas && !filter.areas.has(area)) {
      return false;
    }
    return true;
  }
  static peek(registry, key) {
    if (!registry || typeof registry.has !== "function" || !registry.has(key)) {
      return null;
    }
    return registry.get(key);
  }
  static contextOf(agent) {
    const wanted = agent.runtime?.filter?.context;
    if (!Array.isArray(wanted) || wanted.length === 0) {
      return null;
    }
    const registry = agent.runtime?.registry ?? null;
    const context = {};
    if (wanted.includes("store.keys")) {
      const store = this.peek(registry, "store");
      const tree = store?.runtime?.tree;
      context.storeKeys = tree && typeof tree === "object" ? Object.keys(tree) : [];
    }
    if (wanted.includes("cache.metrics")) {
      const cache = this.peek(registry, "cache");
      context.cache = cache && typeof cache.getMetrics === "function" ? cache.getMetrics() : null;
    }
    return Object.keys(context).length > 0 ? context : null;
  }
  static build(agent, type, message, args = [], options = {}) {
    const area = this.areaOf(message);
    const envelope = {
      type,
      level: this.levelOf(type),
      area,
      namespace: agent.namespace || "aspis",
      time: (/* @__PURE__ */ new Date()).toISOString().split("T")[1].replace("Z", ""),
      message: this.textOf(message),
      args,
      context: options.skipContext ? null : this.contextOf(agent)
    };
    return envelope;
  }
  static print(envelope) {
    const prefix = `[Aspis][${envelope.namespace}][${envelope.area}][${envelope.time}]`;
    const extras = envelope.context ? [envelope.context, ...envelope.args] : envelope.args;
    if (envelope.level === "error") {
      console.error(`${prefix} ERROR:`, envelope.message, ...extras);
      return;
    }
    if (envelope.level === "info") {
      console.info(`${prefix} INFO:`, envelope.message, ...extras);
      return;
    }
    if (envelope.level === "warn") {
      console.warn(`${prefix} WARN:`, envelope.message, ...extras);
      return;
    }
    console.log(`${prefix}`, envelope.message, ...extras);
  }
  static forward(agent, extension, envelope) {
    const steps = extension.steps(agent);
    steps.forEach((step) => {
      if (typeof step === "function") {
        step(envelope);
        return;
      }
      if (step && typeof step === "object" && "handle" in step && typeof step.handle === "function") {
        step.handle(envelope);
      }
    });
  }
}
export {
  AgentEnvelope
};
