/** Typen für Store, Schema, Proxy, Effekte. */

/** @typedef {import("./extensions.js").BaseExpansion} BaseExpansion */
/** @typedef {import("../core/Store.js").Store} Store */

/**
 * @typedef {(
 *   context: Object<string, unknown>,
 *   next: (ctx?: Object<string, unknown>) => unknown
 * ) => unknown} StoreMiddleware
 */

/**
 * @typedef {object} TargetConfig
 * @property {string} selector
 * @property {Object<string, string>} [bindClasses]
 */

/**
 * @typedef {object} SliceConfig
 * @property {Object<string, string>} [styles]
 * @property {Object<string, TargetConfig>} [targets]
 */

/**
 * @typedef {object} StateSlice
 * @property {Object<string, unknown>} [initialState]
 * @property {SliceConfig} [config]
 */

/**
 * @typedef {object} StateManifestSettings
 * @property {boolean} [strictMode]
 * @property {boolean} [debug]
 */

/**
 * @typedef {object} StateManifest
 * @property {StateManifestSettings} [settings]
 * @property {string[]} [namespaces]
 * @property {Object<string, string>} [globalStyles]
 * @property {Object<string, StateSlice>} [slices]
 */

/**
 * @typedef {object} StoreRuntime
 * @property {Object<string, unknown>} data
 * @property {Object<string, SliceConfig>} configs
 * @property {boolean} strictMode
 * @property {Object<string, unknown>} tree
 * @property {Object<string, unknown>} stateProxy
 * @property {Function[]} setPipeline
 * @property {Map<string, Set<StoreEffectRecord>>} listeners
 * @property {Map<string, Set<string>>} dependencies
 * @property {Map<string, Set<HTMLElement>>} domDependencies
 * @property {WeakMap<object, Object<string, unknown>>} proxyCache
 * @property {Set<StoreEffectRecord>} effectQueue
 * @property {Map<HTMLElement, Set<string>>} pendingDomUpdates
 * @property {boolean} isFlushPending
 * @property {number | null} flushTimerId
 * @property {StoreEffectRecord[]} effectStack
 */

/**
 * @typedef {object} StoreSetContext
 * @property {import("../core/Store.js").Store} store
 * @property {Object<string, unknown>} obj
 * @property {string} prop
 * @property {unknown} value
 * @property {unknown} oldValue
 * @property {string} path
 */

/**
 * @typedef {object} StoreEffectRecord
 * @property {import("../core/Store.js").Store} store
 * @property {() => unknown} fn
 * @property {Set<string>} trackedPaths
 */

/**
 * @typedef {object} StoreSchemaExtractResult
 * @property {Object<string, unknown>} tree
 * @property {Object<string, SliceConfig>} configs
 */

/**
 * @typedef {BaseExpansion & {
 *   manifest?: StateManifest,
 *   middleware?: StoreMiddleware | StoreMiddleware[]
 * }} StoreExpansion
 */

/**
 * @typedef {object} AspisMutationEventDetail
 * @property {string | string[]} path
 * @property {string[]} paths
 * @property {string} [dependsOn]
 */

export {};

