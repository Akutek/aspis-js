/** Typen für Utils (Observer, Binder, Delegator, Cache-Pipeline). */

/** @typedef {import("./store.js").TargetConfig} TargetConfig */

/**
 * @typedef {object} ObserverRegistry
 * @property {(key: string | HTMLElement) => unknown} get
 * @property {(key: string | HTMLElement) => boolean} [has]
 */

/**
 * @typedef {object} FetcherLike
 * @property {(url: string, params?: unknown, opts?: RequestInit) => Promise<unknown>} [get]
 */

/**
 * @typedef {object} DispatcherLike
 * @property {(event: string, cb: (payload?: unknown) => void) => () => void} on
 * @property {(event: string, payload?: unknown) => void} [dispatch]
 */

/**
 * @typedef {object} ControllerEventDelegatorTarget
 * @property {(task?: string) => AbortSignal | null} [getSignal]
 * @property {(task: string) => void} [clearTask]
 * @property {AbortSignal} [signal]
 * @property {FetcherLike} [fetcher]
 */

/**
 * @typedef {object} ControllerEventDelegatorOptions
 * @property {string} [eventPath]
 * @property {FetcherLike} [fetcher]
 */

/**
 * @typedef {object} LoadingStateProxy
 * @property {unknown} error
 * @property {boolean} isLoading
 * @property {object | null} [view]
 */

/** @typedef {Node} ObserverTarget */

/** @typedef {Map<string, HTMLElement>} ResolvedTargetsMap */

/** @typedef {Object<string, TargetConfig>} TargetsConfig */

/** @typedef {() => void} UnsubscribeFunction */

/** @typedef {(event: Event, target: HTMLElement) => void} DelegateHandler */

/** @typedef {AddEventListenerOptions & { signal?: AbortSignal }} DelegateOptions */

/**
 * @template [T=unknown]
 * @typedef {(context: T, next: (ctx?: T) => unknown) => unknown} CacheMiddleware
 */

export {};

