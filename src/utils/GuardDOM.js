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
     * Bereinigt einen HTML-String, indem verbotene Tags (z. B. `<script>`), Event-Handler (`on*`)
     * und unsichere URIs (`javascript:`, `vbscript:`, `data:text/html`) entfernt bzw. entschärft werden.
     * 
     * @public
     * @static
     * @template {HTMLInput} T
     * @param {T} rawHTML - Der zu bereinigende HTML-String oder ein unmanipulierter Wert.
     * @returns {T extends string ? string : T} Der bereinigte HTML-String oder der unveränderte Eingabewert.
     */
    static purify(rawHTML) {
        if (typeof rawHTML !== 'string') return rawHTML;

        const parser = new DOMParser();
        const doc = parser.parseFromString(rawHTML, 'text/html');
        const forbiddenTags = new Set(['SCRIPT', 'IFRAME', 'OBJECT', 'EMBED', 'FRAME', 'FRAMESET']);
        const allElements = doc.body.querySelectorAll('*');
        
        allElements.forEach(element => {
            if (forbiddenTags.has(element.tagName)) {
                element.remove();
                console.warn(`Aspis [GuardDOM]: Gefährlicher Tag <${element.tagName.toLowerCase()}> wurde entfernt.`);
                return;
            }

            Array.from(element.attributes).forEach(attr => {
                const attrName = attr.name.toLowerCase();
                const attrValue = attr.value.trim().toLowerCase();

                if (attrName.startsWith('on')) {
                    element.removeAttribute(attr.name);
                    console.warn(`Aspis [GuardDOM]: Event-Handler '${attr.name}' entfernt.`);
                }

                if (['href', 'src', 'action', 'data'].includes(attrName)) {
                    if (attrValue.startsWith('javascript:') || attrValue.startsWith('vbscript:') || attrValue.startsWith('data:text/html')) {
                        element.setAttribute(attr.name, '#');
                        console.warn(`Aspis [GuardDOM]: Unsichere URL in '${attr.name}' auf '#' zurückgesetzt.`);
                    }
                }
            });
        });

        return doc.body.innerHTML;
    }
}