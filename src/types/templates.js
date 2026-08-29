/** Typen für TemplateService (Katalog, Compile, Cache). */

/** @typedef {import("./importer.js").ImportRoute} ImportRoute */

/**
 * @typedef {object} TemplateServiceOptions
 * @property {string} [basePath]
 * @property {boolean} [autoInit]
 * @property {string} [indexPath]
 * @property {Object<string, ImportRoute> | null} [catalog]
 */

/**
 * @typedef {object} TemplateConfig
 * @property {string} [name]
 * @property {Object<string, string>} [placeholder]
 * @property {Object<string, string>} [slots]
 * @property {Object<string, string>} [attributes]
 * @property {Object<string, string>} [files]
 * @property {Object<string, string | TemplateLoopSpec>} [loops]
 * @property {string} [html]
 * @property {boolean} [partial]
 * @property {Object<string, unknown>} [events]
 * @property {Object<string, unknown>} [styles]
 * @property {Object<string, unknown>} [targets]
 * @property {Object<string, unknown>} [bindings]
 */

/**
 * @typedef {object} TemplateLoopSpec
 * @property {string} [placeholder]
 * @property {string} [from]
 * @property {string} [part]
 */

/**
 * Rohquelle aus dem Katalog: hydrierter Stein, noch nicht kompiliert.
 * @typedef {object} TemplateSource
 * @property {string} name
 * @property {TemplateConfig} config
 * @property {string} layoutHtml
 * @property {Object<string, string>} [parts]
 */

/**
 * @typedef {object} BlueprintSlotSpec
 * @property {string} template
 * @property {boolean} [loop]
 * @property {string} [from]
 * @property {string} [classKey]
 * @property {Object<string, string>} [map]
 * @property {Object<string, BlueprintSlotSpec>} [slots]
 */

/**
 * Bauplan: welche Steine in welche Slots, welche Klassen.
 * @typedef {object} Blueprint
 * @property {string} name
 * @property {"blueprint"} kind
 * @property {string} root
 * @property {string} [branch]
 * @property {string} [from]
 * @property {Object<string, string>} classes
 * @property {Object<string, string>} map
 * @property {Object<string, BlueprintSlotSpec>} slots
 */

/**
 * @typedef {object} CatalogResource
 * @property {"brick" | "blueprint"} kind
 * @property {TemplateSource} [brick]
 * @property {Blueprint} [blueprint]
 */

/**
 * @typedef {object} SlotDef
 * @property {string} key
 * @property {string} part
 * @property {string} placeholder
 * @property {boolean} loop
 * @property {string} from
 */

/**
 * @typedef {object} TemplatePart
 * @property {string} html
 * @property {SlotDef[]} slotDefs
 */

/**
 * @typedef {object} NormalizedTemplate
 * @property {string} id
 * @property {string} role
 * @property {boolean} isRoot
 * @property {string | null} childSlot
 * @property {string[]} allowedChildren
 * @property {Object<string, unknown>} events
 * @property {Object<string, unknown>} styles
 * @property {Object<string, unknown>} targets
 * @property {Object<string, unknown>} bindings
 * @property {string} html
 * @property {Object<string, TemplatePart>} [parts]
 * @property {SlotDef[]} [slotDefs]
 * @property {Object<string, string>} slots
 * @property {Object<string, string>} attributes
 * @property {Object<string, string>} data
 * @property {[string, string][]} sortedData
 * @property {[string, string][]} sortedAttributes
 * @property {Object<string, string>} placeholder
 * @property {TemplateConfig} config
 */

/**
 * @typedef {object} CompilePayload
 * @property {Object<string, unknown>} [data]
 * @property {Object<string, unknown>} [attributes]
 * @property {SlotPayloadMap} [slots]
 */

/** @typedef {string | TemplateServiceOptions} TemplateServiceConfig */

/** @typedef {Node | string | Array<Node | string>} SlotContent */

/** @typedef {Object<string, SlotContent>} SlotPayloadMap */

export {};

