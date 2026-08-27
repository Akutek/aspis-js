/** Typen für Schema-Views. */

/** @typedef {import("./services.js").FieldRules} FieldRules */

/**
 * @typedef {object} SchemaView
 * @property {string} kind
 * @property {string} [layout]
 */

/**
 * @typedef {SchemaView} TableView
 * @property {"table"} kind
 * @property {Object<string, unknown>[]} rows
 */

/**
 * @typedef {object} FormFieldView
 * @property {unknown} value
 * @property {unknown} initialValue
 * @property {string | null} error
 * @property {boolean} isTouched
 * @property {boolean} isDirty
 * @property {FieldRules} rules
 */

/**
 * @typedef {SchemaView} FormView
 * @property {"form"} kind
 * @property {Object<string, FormFieldView>} fields
 * @property {boolean} isSubmitting
 * @property {string | null} submitError
 * @property {boolean} submitSuccess
 */

/**
 * @typedef {object} AccordionItemView
 * @property {string} id
 * @property {string} title
 * @property {string} content
 * @property {boolean} isOpen
 * @property {boolean} disabled
 * @property {string} [itemUrl]
 */

/**
 * @typedef {SchemaView} AccordionView
 * @property {"accordion"} kind
 * @property {boolean} [singleOpen]
 * @property {AccordionItemView[]} items
 */

/**
 * @typedef {object} DropdownOptionView
 * @property {string} value
 * @property {string} label
 * @property {boolean} [disabled]
 * @property {boolean} [isSelected]
 * @property {boolean} [isFocused]
 */

/**
 * @typedef {SchemaView} DropdownView
 * @property {"dropdown"} kind
 * @property {boolean} isOpen
 * @property {string} value
 * @property {string | null} error
 * @property {boolean} [isTouched]
 * @property {number} focusedIndex
 * @property {number} selectedIndex
 * @property {string} placeholder
 * @property {DropdownOptionView[]} options
 * @property {FieldRules | undefined} [rules]
 */

/**
 * @typedef {SchemaView} ModalView
 * @property {"modal"} kind
 * @property {boolean} isOpen
 * @property {string} title
 * @property {string} message
 * @property {string} contentKind
 * @property {string} variant
 * @property {number | null} [progress]
 * @property {boolean} [closeOnBackdrop]
 */

/**
 * @typedef {SchemaView} LoaderView
 * @property {"loader"} kind
 * @property {string} message
 * @property {number | null} progress
 */

/**
 * @typedef {object} SchemaManifest
 * @property {string} id
 * @property {string} kind
 * @property {Object<string, unknown>} defaults
 * @property {Object<string, unknown>} [row]
 * @property {Object<string, unknown>} [field]
 * @property {Object<string, unknown>} [item]
 * @property {Object<string, unknown>} [option]
 * @property {Object<string, unknown>} [variants]
 */

/** @typedef {| AccordionView | DropdownView | FormView | ModalView | TableView | LoaderView} AnySchemaView */

export {};
