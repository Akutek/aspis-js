/** Typen für DebugAgent und ErrorAgent. */

/** @typedef {import("../agents/DebugAgent.js").DebugAgent} DebugAgent */
/** @typedef {import("../agents/ErrorAgent.js").ErrorAgent} ErrorAgent */

/**
 * @typedef {object} AgentEnvelopeRecord
 * @property {string} type
 * @property {string} level
 * @property {string} area
 * @property {string} namespace
 * @property {string} time
 * @property {string} message
 * @property {unknown[]} args
 * @property {object | null} context
 */

/**
 * @typedef {object} AgentFilter
 * @property {Set<string> | null} levels
 * @property {Set<string> | null} areas
 * @property {string[]} context
 */

/**
 * @typedef {object} DebugPipelinePayload
 * @property {string} type
 * @property {string} namespace
 * @property {string} message
 * @property {unknown[]} args
 */

/**
 * @typedef {object} DebugPipeline
 * @property {(payload: AgentEnvelopeRecord | DebugPipelinePayload) => void} [handle]
 * @property {string} [id]
 * @property {boolean} [enabled]
 * @property {string} [directory]
 * @property {string} [file]
 * @property {string} [export]
 */

/**
 * @typedef {object} DebugManifestSettings
 * @property {boolean} [debug]
 * @property {string} [namespace]
 * @property {string[]} [levels]
 * @property {string[]} [areas]
 * @property {string[]} [context]
 */

/**
 * @typedef {object} DebugManifest
 * @property {DebugManifestSettings} [settings]
 * @property {DebugPipeline[]} [pipelines]
 */

/**
 * @typedef {object} ErrorPipelinePayload
 * @property {string} type
 * @property {string} namespace
 * @property {string} message
 * @property {unknown[]} args
 */

/**
 * @typedef {object} ErrorPipeline
 * @property {(payload: AgentEnvelopeRecord | ErrorPipelinePayload) => void} [handle]
 * @property {string} [id]
 * @property {boolean} [enabled]
 * @property {string} [directory]
 * @property {string} [file]
 * @property {string} [export]
 */

/**
 * @typedef {object} ErrorManifestSettings
 * @property {boolean} [capture]
 * @property {string} [namespace]
 * @property {string[]} [areas]
 * @property {string[]} [context]
 */

/**
 * @typedef {object} ErrorManifest
 * @property {ErrorManifestSettings} [settings]
 * @property {ErrorPipeline[]} [pipelines]
 */

/**
 * @typedef {object} AgentHostRuntime
 * @property {AgentFilter} [filter]
 * @property {RegistryLike} [registry]
 */

/**
 * @typedef {object} AgentHost
 * @property {AgentHostRuntime} [runtime]
 * @property {boolean | null} [debugState]
 * @property {string} [namespace]
 */

/**
 * @typedef {object} RegistryLike
 * @property {(key: string) => boolean} has
 * @property {(key: string) => unknown} get
 */

/**
 * @typedef {object} DebugErrorAgents
 * @property {import("../agents/DebugAgent.js").DebugAgent} debug
 * @property {import("../agents/ErrorAgent.js").ErrorAgent} error
 */

/** @typedef {boolean | null} DebugState */

/** @typedef {unknown[]} AgentLogArguments */

/** @typedef {string | { area?: string, message?: string }} AgentMessage */

export {};

