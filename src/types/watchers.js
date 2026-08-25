/** Typen für Watcher-Hosts. */

/** @typedef {import("../agents/DebugAgent.js").DebugAgent} DebugAgent */

/** @typedef {import("../agents/ErrorAgent.js").ErrorAgent} ErrorAgent */

/** @typedef {import("../core/Registry.js").Registry} Registry */

/** @typedef {import("../watchers/BaseWatcher.js").BaseWatcher} BaseWatcher */

/** @typedef {import("../watchers/MutationWatcher.js").MutationWatcher} MutationWatcher */

/** @typedef {import("../watchers/IntersectionWatcher.js").IntersectionWatcher} IntersectionWatcher */

/** @typedef {import("../watchers/ResizeWatcher.js").ResizeWatcher} ResizeWatcher */

/** @typedef {import("../watchers/PerformanceWatcher.js").PerformanceWatcher} PerformanceWatcher */

/** @typedef {import("../watchers/ReportingWatcher.js").ReportingWatcher} ReportingWatcher */

/**
 * @typedef {object} WatcherRuntime
 * @property {string} [kind]
 * @property {DebugAgent | null} [debug]
 * @property {ErrorAgent | null} [error]
 * @property {MutationObserver | IntersectionObserver | ResizeObserver | PerformanceObserver | ReportingObserver | null} [observer]
 * @property {Set<Node>} [roots]
 * @property {boolean} [watching]
 * @property {Registry | null} [registry]
 * @property {Object<string, unknown> | MutationObserverInit | IntersectionObserverInit | PerformanceObserverInit | null} [config]
 * @property {unknown} [lastEntries]
 */

/**
 * @typedef {object} MutationBatch
 * @property {HTMLElement[]} added
 * @property {HTMLElement[]} removed
 */

/**
 * @typedef {object} IntersectionBatch
 * @property {IntersectionObserverEntry[]} shown
 * @property {IntersectionObserverEntry[]} hidden
 */

/**
 * @typedef {object} ResizeMeasure
 * @property {Element} target
 * @property {number} width
 * @property {number} height
 */

export {};
