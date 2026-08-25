/** Typen für Importer und ImporterExtension. */

/** @typedef {import("../core/Importer.js").Importer} Importer */

/** @typedef {import("../core/Cache.js").Cache} Cache */

/** @typedef {import("../core/Store.js").Store} Store */

/** @typedef {import("./extensions.js").BaseExpansion} BaseExpansion */

/**
 * @typedef {object} ImportRoute
 * @property {string} [directory]
 * @property {string} [file]
 * @property {string} [export]
 */

/**
 * @typedef {object} ImporterManifest
 * @property {Object<string, ImportRoute>} [classRouting]
 * @property {Object<string, unknown>} [boot]
 * @property {Object<string, ImportRoute>} [manifestRouting]
 */

/**
 * @typedef {object} ImporterRuntime
 * @property {Function[]} pipeline
 * @property {Map<string, unknown>} modules
 * @property {Map<string, object>} indexes
 * @property {Map<string, Promise<unknown>>} pending
 * @property {string[]} loading
 */

export {};
