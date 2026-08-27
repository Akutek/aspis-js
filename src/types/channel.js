/** Typen für den Channel-Host und Worker-Nachrichten. */

/**
 * @typedef {object} ChannelEnvelope
 * @property {1} v
 * @property {number} [id]
 * @property {string} type
 * @property {unknown} [payload]
 * @property {boolean} [ok]
 * @property {string} [error]
 */

/**
 * @typedef {"loopback" | "worker"} ChannelTransport
 */

/**
 * @typedef {object} ChannelRuntime
 * @property {import("./agents.js").DebugAgent | null} [debug]
 * @property {import("./agents.js").ErrorAgent | null} [error]
 * @property {{ emit?: (name: string, data?: unknown) => void } | null} [dispatcher]
 * @property {import("./registry.js").Registry | null} [registry]
 */

/**
 * @typedef {(payload: unknown) => void} ChannelSubscriber
 */

export {};
