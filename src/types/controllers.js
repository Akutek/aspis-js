/** @typedef {import("../controllers/BaseController.js").BaseController} BaseController */
/** @typedef {import("../core/Registry.js").Registry} Registry */
/** @typedef {import("../agents/DebugAgent.js").DebugAgent} DebugAgent */
/** @typedef {import("../agents/ErrorAgent.js").ErrorAgent} ErrorAgent */
/** @typedef {import("./schema.js").AccordionItemView} AccordionItemView */
/** @typedef {import("./schema.js").AccordionView} AccordionView */
/** @typedef {import("./schema.js").DropdownView} DropdownView */
/** @typedef {import("./schema.js").FormView} FormView */
/** @typedef {import("./schema.js").LoaderView} LoaderView */
/** @typedef {import("./schema.js").ModalView} ModalView */
/** @typedef {import("./schema.js").TableView} TableView */

/**
 * @typedef {object} ControllerFetcher
 * @property {(url: string, params?: unknown, opts?: RequestInit) => Promise<unknown>} [get]
 * @property {(url: string, body?: unknown, opts?: RequestInit) => Promise<unknown>} [post]
 * @property {(url: string, opts?: Record<string, unknown>) => Promise<unknown>} [request]
 */

/**
 * @typedef {object} ControllerDispatcher
 * @property {(event: string, data?: unknown) => void} [emit]
 * @property {(event: string, cb: (payload?: unknown) => void) => unknown} [on]
 * @property {(element: HTMLElement, callback: () => void) => () => void} [onClickOutside]
 */

/**
 * @typedef {object} ControllerRenderService
 * @property {(el: HTMLElement, name: string, data?: unknown) => Promise<HTMLElement> | HTMLElement} [paste]
 * @property {(el: HTMLElement, name: string, data?: unknown) => Promise<HTMLElement> | HTMLElement} [append]
 * @property {(...args: unknown[]) => unknown} [compile]
 */

/**
 * @typedef {object} ControllerOptions
 * @property {string} [sliceKey]
 * @property {string} [layout]
 * @property {ControllerFetcher} [fetcher]
 * @property {Registry} [registry]
 * @property {DebugAgent} [debug]
 * @property {ErrorAgent} [error]
 * @property {ControllerRenderService} [renderService]
 * @property {boolean} [validateOnBlur]
 * @property {boolean} [validateOnChange]
 */

/** @typedef {LoaderView} LoaderLike */

/**
 * @typedef {BaseController & {
 *   _view: AccordionView | LoaderLike | null,
 *   loadData: (url: string) => Promise<void>,
 *   scanDomAndBuildView: () => void,
 *   syncAccordionUI: () => void,
 *   bindAccordionEvents: () => void,
 *   toggle: (itemId: string) => void,
 *   updateItemUI: (item: AccordionItemView) => void,
 *   handleAccordionKeyDown: (event: KeyboardEvent) => void,
 *   renderAccordion: () => Promise<void>
 * }} AccordionHost
 */

/**
 * @typedef {BaseController & {
 *   _view: DropdownView | LoaderLike | null,
 *   _clickOutsideUnsub?: (() => void) | null,
 *   scanDomOptions: () => void,
 *   bindDropdownEvents: () => void,
 *   loadOptions: (url: string) => Promise<void>,
 *   renderDropdown: () => Promise<void>,
 *   toggle: () => void,
 *   open: () => void,
 *   close: () => void,
 *   selectValue: (value: unknown) => void,
 *   validateUI: () => void,
 *   updateFocusUI: () => void,
 *   syncWithNativeInput: () => void,
 *   handleDropdownKeyDown: (event: KeyboardEvent) => void
 * }} DropdownHost
 */

/**
 * @typedef {BaseController & {
 *   _view: TableView | LoaderLike | null,
 *   loadData: (url: string) => Promise<void>,
 *   reload: (filterPayload?: Record<string, string | number | boolean | null | undefined>) => void,
 *   renderTable: () => Promise<void>
 * }} TableHost
 */

/**
 * @typedef {BaseController & {
 *   _view: FormView | null,
 *   _dataUrl?: string | null,
 *   _connection?: string | null,
 *   _apiToken?: string | null,
 *   _validateOnBlur?: boolean,
 *   _validateOnChange?: boolean,
 *   buildFormView?: () => void,
 *   bindFormEvents?: () => void,
 *   bindFormDropdownSync?: () => void,
 *   renderForm?: () => Promise<void> | void,
 *   submit?: () => Promise<void>,
 *   reset?: () => void,
 *   updateField?: (name: string, value: unknown, triggerValidation?: boolean) => void,
 *   updateFieldUI?: (name: string) => void,
 *   showFormMessage?: (msg: string, type?: string) => void,
 *   hideFormMessage?: () => void,
 *   toggleSubmittingUI?: (isSubmitting: boolean) => void,
 *   focusFirstInvalidField?: () => void,
 *   handleFieldInput?: (event: Event) => void,
 *   handleFieldChange?: (event: Event) => void,
 *   handleFieldBlur?: (event: FocusEvent) => void
 * }} FormHost
 */

/**
 * @typedef {BaseController & {
 *   _view: (ModalView & { contentKind?: string, variant?: string }) | LoaderLike | null,
 *   _modalRoot?: HTMLElement | null,
 *   _modalMountedOnBody?: boolean,
 *   _dataUrl?: string | null,
 *   _connection?: string | null,
 *   _apiToken?: string | null,
 *   _contentKind?: string,
 *   _mountMode?: "self" | "body",
 *   _templateName?: string,
 *   mountModal?: () => Promise<void> | void,
 *   fillModalContent?: () => Promise<void> | void,
 *   modalHostTarget?: () => HTMLElement | null,
 *   modalContentTemplate?: (kind: string) => string,
 *   bindModalEvents: () => void,
 *   bindModalOpeners: () => void,
 *   open: () => void,
 *   close: () => void,
 *   toggle: () => void,
 *   syncModalOpen: () => void
 * }} ModalHost
 */

export {};

