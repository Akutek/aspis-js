/** Typen für Factory-Zuschneiden, Lade-Bänder und Tailor. */

/** @typedef {import("./managers.js").PlanItem} PlanItem */

/** @typedef {import("../services/MixinService.js").MixinService} MixinService */

/** @typedef {import("../services/CompositionService.js").CompositionService} CompositionService */

/**
 * @typedef {object} LoadTask
 * @property {PlanItem} item
 * @property {LoadBand} band
 * @property {"add" | "keep" | "update"} origin
 * @property {string[]} specifiers
 */

/**
 * @typedef {object} LoadQueue
 * @property {LoadTask[]} view
 * @property {LoadTask[]} near
 * @property {LoadTask[]} far
 * @property {LoadTask[]} history
 */

/**
 * @typedef {object} TailorContext
 * @property {Function | null} Base
 * @property {Function[]} mixins
 * @property {Object<string, Function>[]} compositions
 * @property {"full" | "half"} mode
 * @property {Function | null} Class
 * @property {Function} mixinService
 * @property {Function} compositionService
 */

/** @typedef {"view" | "near" | "far" | "history"} LoadBand */

export {};
