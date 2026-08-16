/**
 * Mögliche Eingabetypen für die Textbereinigung und Escaping.
 * @typedef {string | number | boolean | null | undefined | any} SafeInput
 */
/**
 * Der Rückgabewert der Textbereinigung (bereinigter String, Number oder Boolean).
 * @typedef {string | number | boolean} CleanResult
 */
/**
 * Mögliche Eingabetypen für die HTML-Bereinigung.
 * @typedef {string | any} HTMLInput
 */
/**
 * Optionale Konfigurationsoptionen für die HTML-Bereinigung bzw. DOMPurify.
 * @typedef {Record<string, any>} PurifyOptions
 */

/**
 * Utility-Klasse des Aspis-Frameworks zur Bereinigung und Entschärfung (Sanitization)
 * von Strings und HTML-Inhalten zum Schutz vor Cross-Site Scripting (XSS).
 * 
 * @public
 */
export class GuardDOM {
    /**
     * Konvertiert einen unsicheren Eingabewert in einen HTML-escapeten String.
     * Primitive Typen wie `boolean` oder `number` werden direkt unverändert zurückgegeben,
     * `null` und `undefined` liefern einen leeren String.
     * 
     * @public
     * @static
     * @param {SafeInput} unsafeText - Der zu bereinigende/escapende Wert.
     * @returns {CleanResult} Der escapete String oder der ursprüngliche primitive Wert.
     */
    static clean(unsafeText) {
        if (typeof unsafeText === 'boolean' || typeof unsafeText === 'number') return unsafeText;
        if (unsafeText === null || unsafeText === undefined) return '';
        const str = String(unsafeText);
        
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    /**
     * Bereinigt einen HTML-String auf XSS-Resilienz.
     * Nutzt primär DOMPurify, falls global (`window.DOMPurify`) verfügbar,
     * und fällt andernfalls auf eine gehärtete Inhouse-Sanitization (Zero-Dependency) zurück.
     * 
     * @public
     * @static
     * @template {HTMLInput} T
     * @param {T} rawHTML - Der zu bereinigende HTML-String oder ein unmanipulierter Wert.
     * @param {PurifyOptions} [options={}] - Optionale Konfigurationseinstellungen für die Bereinigung / DOMPurify.
     * @returns {T extends string ? string : T} Der bereinigte HTML-String oder der unveränderte Eingabewert.
     */
    static purify(rawHTML, options = {}) {
        if (typeof rawHTML !== 'string') return rawHTML;


        const globalPurify = typeof window !== 'undefined' ? window.DOMPurify : null;
        if (globalPurify && typeof globalPurify.sanitize === 'function') {
            return globalPurify.sanitize(rawHTML, options);
        }

        const parser = new DOMParser();
        const doc = parser.parseFromString(rawHTML, 'text/html');
        const forbiddenTags = new Set([
            'SCRIPT', 'IFRAME', 'OBJECT', 'EMBED', 'FRAME', 'FRAMESET',
            'STYLE', 'META', 'LINK', 'BASE', 'TEMPLATE', 'NOSCRIPT',
            'APPLET', 'FORM', 'MATH'
        ]);

        const uriAttributes = new Set([
            'href', 'src', 'action', 'data', 'poster', 'formaction',
            'xlink:href', 'xml:base'
        ]);

        const allElements = doc.body.querySelectorAll('*');
        
        allElements.forEach(element => {
            const tagName = element.tagName.toUpperCase();

            if (forbiddenTags.has(tagName)) {
                element.remove();
                LoggerService.warn(`[GuardDOM.purify()] Aspis [GuardDOM]: Gefährlicher Tag <${tagName.toLowerCase()}> wurde entfernt.`);
                return;
            }

            const attributeNames = element.getAttributeNames ? element.getAttributeNames() : Array.from(element.attributes).map(a => a.name);

            attributeNames.forEach(attrName => {
                const lowerAttrName = attrName.toLowerCase();
                const rawAttrValue = element.getAttribute(attrName) || '';
                const normalizedValue = rawAttrValue.replace(/[\x00-\x20\x7F-\x9F]/g, '').toLowerCase();

                if (lowerAttrName.startsWith('on')) {
                    element.removeAttribute(attrName);
                    LoggerService.warn(`[GuardDOM.purify()] Aspis [GuardDOM]: Event-Handler '${attrName}' entfernt.`);
                    return;
                }

                if (uriAttributes.has(lowerAttrName) || lowerAttrName.endsWith(':href')) {
                    const isDangerousProtocol = 
                        normalizedValue.startsWith('javascript:') ||
                        normalizedValue.startsWith('vbscript:') ||
                        normalizedValue.startsWith('data:text/html') ||
                        normalizedValue.startsWith('data:image/svg+xml') ||
                        normalizedValue.startsWith('data:application/');

                    if (isDangerousProtocol) {
                        element.setAttribute(attrName, '#');
                        LoggerService.warn(`[GuardDOM.purify()] Aspis [GuardDOM]: Unsichere URL in '${attrName}' auf '#' zurückgesetzt.`);
                    }
                }
            });
        });

        return doc.body.innerHTML;
    }
}