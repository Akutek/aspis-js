/**
 * Utility-Klasse des Aspis-Frameworks zur sicheren DOM-Manipulation
 * (Sichtbarkeit, Klassen-Management und Attribut-Steuerung).
 * 
 * @public
 */
export class ModifierDOM {
    /**
     * Prüft, ob das übergebene Objekt eine gültige DOM-Element-Instanz ist.
     * 
     * @internal
     * @static
     * @param {any} target - Das zu prüfende Objekt.
     * @returns {boolean} `true`, wenn das Objekt eine `Element`-Instanz ist, sonst `false`.
     */
    static #isValid(target) {
        return target instanceof Element;
    }

    /**
     * Normalisiert verschiedene Eingabeformen (Element, Iterable, Array) in eine Liste von DOM-Elementen.
     * 
     * @internal
     * @static
     * @param {DOMTarget} target - Das zu normalisierende Ziel-Element oder Iterable.
     * @returns {Element[]} Array aus den extrahierten DOM-Elementen.
     */
    static #normalize(target) {
        if (!target) return [];
        if (target instanceof Element) return [target];
        if (typeof target[Symbol.iterator] === 'function' && typeof target !== 'string') {
            return Array.from(target);
        }
        return [];
    }

    /**
     * Macht das oder die Ziel-Elemente sichtbar (entfernt das `hidden`-Attribut sowie die `is-hidden`-Klasse).
     * 
     * @public
     * @static
     * @param {DOMTarget} target - Das oder die aufzuzeigenden DOM-Elemente.
     * @returns {void}
     */
    static show(target) {
        this.#normalize(target).forEach(el => {
            if (!this.#isValid(el)) return;
            el.removeAttribute('hidden');
            el.classList.remove('is-hidden');
        });
    }

    /**
     * Versteckt das oder die Ziel-Elemente (setzt das `hidden`-Attribut und fügt die `is-hidden`-Klasse hinzu).
     * 
     * @public
     * @static
     * @param {DOMTarget} target - Das oder die zu versteckenden DOM-Elemente.
     * @returns {void}
     */
    static hide(target) {
        this.#normalize(target).forEach(el => {
            if (!this.#isValid(el)) return;
            el.setAttribute('hidden', '');
            el.classList.add('is-hidden');
        });
    }

    /**
     * Fügt eine oder mehrere Leerzeichen-getrennte CSS-Klassen zu den Ziel-Elementen hinzu.
     * 
     * @public
     * @static
     * @param {DOMTarget} target - Das oder die Ziel-Elemente.
     * @param {string} classNames - Ein oder mehrere Leerzeichen-getrennte CSS-Klassennamen.
     * @returns {void}
     */
    static addClass(target, classNames) {
        if (!classNames || typeof classNames !== 'string') return;
        const classes = classNames.split(/\s+/).filter(Boolean);
        if (classes.length === 0) return;

        this.#normalize(target).forEach(el => {
            if (!this.#isValid(el)) return;
            el.classList.add(...classes);
        });
    }

    /**
     * Entfernt eine oder mehrere Leerzeichen-getrennte CSS-Klassen von den Ziel-Elementen.
     * 
     * @public
     * @static
     * @param {DOMTarget} target - Das oder die Ziel-Elemente.
     * @param {string} classNames - Ein oder mehrere Leerzeichen-getrennte CSS-Klassennamen.
     * @returns {void}
     */
    static removeClass(target, classNames) {
        if (!classNames || typeof classNames !== 'string') return;
        const classes = classNames.split(/\s+/).filter(Boolean);
        if (classes.length === 0) return;

        this.#normalize(target).forEach(el => {
            if (!this.#isValid(el)) return;
            el.classList.remove(...classes);
        });
    }

    /**
     * Schaltet eine oder mehrere Leerzeichen-getrennte CSS-Klassen auf den Ziel-Elementen um.
     * 
     * @public
     * @static
     * @param {DOMTarget} target - Das oder die Ziel-Elemente.
     * @param {string} className - Ein oder mehrere Leerzeichen-getrennte CSS-Klassennamen.
     * @param {boolean} [force] - Optionaler Schalter: `true` erzwingt Hinzufügen, `false` Entfernen.
     * @returns {void}
     */
    static toggleClass(target, className, force) {
        if (!className || typeof className !== 'string') return;
        const classes = className.split(/\s+/).filter(Boolean);

        this.#normalize(target).forEach(el => {
            if (!this.#isValid(el)) return;

            classes.forEach(cls => {
                if (force !== undefined) {
                    el.classList.toggle(cls, !!force);
                } else {
                    el.classList.toggle(cls);
                }
            });
        });
    }

    /**
     * Schaltet eine CSS-Klasse basierend auf einer State-Slice-Konfiguration um.
     * 
     * @public
     * @static
     * @param {DOMTarget} target - Das oder die Ziel-Elemente.
     * @param {StateSlice} slice - Das State-Slice mit der Style-Konfiguration.
     * @param {string} styleKey - Der Schlüssel des Styles im Slice.
     * @param {boolean} isActive - Bestimmt, ob die Klasse hinzugefügt (`true`) oder entfernt (`false`) wird.
     * @returns {void}
     */
    static toggleSliceClass(target, slice, styleKey, isActive) {
        if (!slice) return;

        const classMapping = slice?.config?.styles?.[styleKey] 
            || slice?.styles?.[styleKey] 
            || slice?.[styleKey] 
            || styleKey;

        if (typeof classMapping === 'string') {
            if (isActive) {
                this.addClass(target, classMapping);
            } else {
                this.removeClass(target, classMapping);
            }
        }
    }

    /**
     * Setzt, aktualisiert oder entfernt ein HTML-Attribut auf den Ziel-Elementen.
     * 
     * @public
     * @static
     * @param {DOMTarget} target - Das oder die Ziel-Elemente.
     * @param {string} attrName - Der Name des HTML-Attributes.
     * @param {AttributeValue} value - Der Wert (`null`/`undefined`/`false` entfernt das Attribut, `true` setzt ein Boolean/Aria-Attribut).
     * @returns {void}
     */
    static attr(target, attrName, value) {
        if (!attrName || typeof attrName !== 'string') return;

        this.#normalize(target).forEach(el => {
            if (!this.#isValid(el)) return;
            
            if (value === null || value === undefined || value === false) {
                el.removeAttribute(attrName);
            } else if (value === true) {
                el.setAttribute(attrName, attrName.startsWith('aria-') ? 'true' : '');
            } else {
                el.setAttribute(attrName, String(value));
            }
        });
    }
}

/**
 * Zulässiger Eingabetyp für DOM-Ziel-Elemente (Einzelnes Element, Iterable/Array von Elementen oder Falsy-Wert).
 * @typedef {Element | Iterable<Element> | Array<Element> | null | undefined} DOMTarget
 */
/**
 * Style-Konfiguration innerhalb eines Slices.
 * @typedef {Object} SliceConfig
 * @property {Record<string, string>} [styles] - Mapping von Style-Schlüsseln zu CSS-Klassennamen.
 */
/**
 * Repräsentiert ein State-Slice-Objekt im Store.
 * @typedef {Object} StateSlice
 * @property {SliceConfig} [config] - Layout- und Binding-Konfiguration.
 * @property {Record<string, string>} [styles] - Direktes Style-Mapping auf Slice-Ebene.
 */
/**
 * Erlaubte Datentypen für Attribut-Werte.
 * @typedef {string | number | boolean | null | undefined} AttributeValue
 */