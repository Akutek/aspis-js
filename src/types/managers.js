/** Typen für Boot- und Phasen-Manager. */

/** @typedef {import("./factory.js").LoadQueue} LoadQueue */

/** @typedef {import("../core/Tailor.js").Tailor} Tailor */

/** @typedef {import("../core/Splicer.js").Splicer} Splicer */

/** @typedef {import("../agents/DebugAgent.js").DebugAgent} DebugAgent */

/** @typedef {import("../agents/ErrorAgent.js").ErrorAgent} ErrorAgent */

/** @typedef {import("../core/Cache.js").Cache} Cache */

/** @typedef {import("../core/Registry.js").Registry} Registry */

/** @typedef {import("../core/Store.js").Store} Store */

/** @typedef {import("./agents.js").DebugErrorAgents} DebugErrorAgents */

/** @typedef {import("./registry.js").ManifestData} ManifestData */

/**
 * @typedef {object} BootRegistryEntries
 * @property {DebugAgent} debug
 * @property {ErrorAgent} error
 * @property {Cache} cache
 */

/**
 * @typedef {object} ControllerScanResult
 * @property {HTMLElement} element
 * @property {string} type
 * @property {string} layout
 * @property {string | null} [sliceKey]
 */

/**
 * @typedef {object} PlanItem
 * @property {string} type
 * @property {string | undefined} [layout]
 * @property {HTMLElement | undefined} [element]
 * @property {string | null | undefined} [sliceKey]
 * @property {string[]} specifiers
 * @property {string[]} needs
 * @property {string[] | undefined} [watchers]
 * @property {string[] | undefined} [mixins]
 * @property {string[] | undefined} [compositions]
 */

/**
 * @typedef {object} Plan
 * @property {ScanResults} [scanResults]
 * @property {PlanItem[]} [items]
 * @property {string[]} [specifiers]
 * @property {string[]} [needs]
 * @property {string[]} [watchers]
 */

/**
 * @typedef {object} CompareDifference
 * @property {PlanItem[]} add
 * @property {PlanItem[]} keep
 * @property {PlanItem[]} update
 * @property {PlanItem[]} remove
 * @property {Plan | undefined} [plan]
 */

/**
 * @typedef {object} WatcherPrep
 * @property {boolean} skipped
 * @property {string[]} specifiers
 * @property {LoadQueue} queue
 */

/**
 * @typedef {object} ComposePrep
 * @property {PlanItem[]} items
 * @property {Function} mixin
 * @property {Function} composition
 */

/**
 * @typedef {object} ControllerPrep
 * @property {string[]} specifiers
 * @property {Object<string, Function>} classes
 */

/**
 * @typedef {object} SplicePrep
 * @property {Tailor | null} tailor
 * @property {Splicer | null} splicer
 * @property {Object<string, Function>} tailored
 */

/**
 * @typedef {object} FactoryPrep
 * @property {CompareDifference} compared
 * @property {WatcherPrep} watchers
 * @property {ComposePrep} compose
 * @property {ControllerPrep} controllers
 * @property {Tailor | null} [tailor]
 * @property {Splicer | null} [splicer]
 * @property {Object<string, Function>} [tailored]
 * @property {number} [mounted]
 */

/** @typedef {ControllerScanResult[]} ScanResults */

/** @typedef {("store"|"watcher"|"observer")} PlanNeed */

export const PLAN_NEEDS = ["store", "watcher", "observer"];
