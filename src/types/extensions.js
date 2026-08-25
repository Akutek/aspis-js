/** Typen für BaseExtension. */

/** @typedef {(...args: unknown[]) => unknown} PipelineFn */

/**
 * @typedef {object} PipelineHandle
 * @property {PipelineFn} handle
 */

/** @typedef {PipelineFn | PipelineHandle} PipelineStep */

/** @typedef {{ install?: (host: unknown, extension: unknown) => unknown } | PipelineStep} ExtensionPlugin */

/**
 * @typedef {object} BaseExpansion
 * @property {Object<string, unknown>} [manifest]
 * @property {PipelineStep | PipelineStep[] | unknown[]} [middleware]
 * @property {ExtensionPlugin} [plugin]
 * @property {() => Promise<unknown>} [load]
 */

/**
 * @typedef {object} ExtensionHost
 * @property {object | null} [runtime]
 * @property {unknown} [manifest]
 * @property {unknown} [extension]
 */

export {};

