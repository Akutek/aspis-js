/** Typen für Registry und RegistryManager. */

/** @typedef {import("../core/Registry.js").Registry} Registry */

/** @typedef {import("../core/Importer.js").Importer} Importer */

/** @typedef {import("../core/Cache.js").Cache} Cache */

/** @typedef {import("../core/Store.js").Store} Store */

/** @typedef {import("../agents/DebugAgent.js").DebugAgent} DebugAgent */

/** @typedef {import("../agents/ErrorAgent.js").ErrorAgent} ErrorAgent */

/** @typedef {import("./events.js").EventManifest} EventManifest */

/**
 * @typedef {object} ControllerInstance
 * @property {() => void} [destroy]
 * @property {boolean} [_destroyed]
 */

/**
 * @typedef {object} CardinalRoute
 * @property {string} [directory]
 * @property {string} [file]
 */

/**
 * @typedef {object} AppConfigSettings
 * @property {boolean} [strictMode]
 * @property {boolean} [debug]
 * @property {{ view?: number, near?: number, history?: number }} [factory]
 * @property {{ timeoutMs?: number }} [channel]
 */

/**
 * @typedef {object} AppConfigPublicPaths
 * @property {string | null} [base]
 * @property {string} [controllers]
 * @property {string} [templates]
 * @property {string} [events]
 */

/**
 * @typedef {object} AppConfig
 * @property {AppConfigSettings} [settings]
 * @property {AppConfigPublicPaths} [publicPaths]
 * @property {boolean} [debug]
 * @property {Object<string, CardinalRoute>} [cardinals]
 * @property {Object<string, object>} [components]
 */

/** @typedef {(root?: ParentNode & Element) => Promise<void>} CycleHook */

/** @typedef {string} RegistryKey */

/** @typedef {unknown} RegistryService */

/** @typedef {Object<RegistryKey, RegistryService>} RegistryEntries */

/** @typedef {Object<string, unknown>} ManifestData */

/** @typedef {new (...args: unknown[]) => unknown} ControllerConstructor */

/** Haken in der Registry unter `cycle`. Optionaler Root = nur betroffener DOM plus Merge. */

export {};

