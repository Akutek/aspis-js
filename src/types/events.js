/** Typen für EventDispatcher und Event-Manifest. */

/** @typedef {Object<string, { events: string }>} EventManifest */

/**
 * @template [T=unknown]
 * @typedef {(payload: T) => void} EventListenerCallback
 */

/** @typedef {() => void} ClickOutsideCallback */

/**
 * @template [T=unknown]
 * @typedef {Set<EventListenerCallback<T>>} EventListenerSet
 */

/** @typedef {Map<string, EventListenerSet>} ListenersMap */

/** @typedef {(event: MouseEvent) => void} GlobalClickHandler */

export {};

