/** Typen für Services (Validierung, Render, Formularfelder). */

/**
 * @typedef {object} RuleConfigObject
 * @property {unknown} [param]
 * @property {string} [message]
 */

/**
 * @typedef {object} FieldState
 * @property {FormFieldValue} value
 * @property {FieldRules} rules
 * @property {string | null} error
 * @property {boolean} isTouched
 * @property {boolean} isDirty
 */

/**
 * @typedef {object} TemplateCompileOptions
 * @property {RenderData} [data]
 */

/**
 * @typedef {object} TemplateServiceLike
 * @property {(name: string, options?: TemplateCompileOptions) => HTMLElement | Element | null} compile
 * @property {(name: string) => Promise<unknown>} get
 */

/**
 * @typedef {object} TreeCleaner
 * @property {(element: HTMLElement) => void} cleanTree
 */

/**
 * @typedef {object} RenderableItem
 * @property {() => RenderData} toRenderData
 */

/** @typedef {(value: unknown, param?: unknown) => boolean} ValidationRuleFn */

/** @typedef {[unknown, string]} RuleConfigTuple */

/** @typedef {boolean | string | RuleConfigTuple | RuleConfigObject} RuleConfig */

/** @typedef {Object<string, RuleConfig>} FieldRules */

/** @typedef {Object<string, unknown>} FormValues */

/** @typedef {Object<string, FieldRules>} FormSchema */

/** @typedef {Object<string, string>} FormErrors */

/** @typedef {string | boolean | string[] | null} FormFieldValue */

/** @typedef {Object<string, unknown>} RenderData */

/** @typedef {RenderableItem | RenderData} LoopItem */

/** @typedef {Node | Node[]} AppendableElements */

/** @typedef {Element} PurifiedElement */

/** @typedef {new (...args: never[]) => object} AnyConstructor */

export {};
