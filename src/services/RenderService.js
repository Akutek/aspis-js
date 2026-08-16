/**
 * Generisches Key-Value-Objekt für Render-Daten.
 * @typedef {Record<string, any>} RenderData
 */
/**
 * Konfigurations- oder Datenobjekt für den Compile-Prozess von Templates.
 * @typedef {Object} TemplateCompileOptions
 * @property {RenderData} data - Die Daten, die in das Template gerendert werden sollen.
 */
/**
 * Interface für den Template-Service des Aspis-Frameworks.
 * Handles Compilation, Caching und das Laden von HTML-Templates.
 * @typedef {Object} TemplateService
 * @property {function(string, TemplateCompileOptions=): HTMLElement|Element|null} compile - Kompiliert ein Template direkt aus dem Cache oder Speicher.
 * @property {function(string): Promise<any>} get - Lädt die Template-Ressource asynchron nach, falls sie nicht vorhanden ist.
 */
/**
 * Interface für einen optionalen DOM-Tree-Cleaner (z. B. Event-Listener-Remover / Abort-Cleanup).
 * @typedef {Object} TreeCleaner
 * @property {function(HTMLElement): void} cleanTree - Säubert den DOM-Baum des Ziel-Elements von alten Listeners oder Subscriptions.
 */
/**
 * Schnittstelle für Objekte, die ein Aufbereiten ihrer Render-Daten über `toRenderData()` unterstützen.
 * @typedef {Object} RenderableItem
 * @property {function(): RenderData} toRenderData - Liefert die aufbereiteten Daten für das Rendering.
 */
/**
 * Beliebiges Element aus einer Datenliste für die Loop-Verarbeitung (Objekt mit `toRenderData` oder primitives JSON-Objekt).
 * @typedef {RenderableItem | RenderData} LoopItem
 */
/**
 * Möglicher Eingabetyp für Elemente, die in einen Ziel-Container zusammengefügt werden.
 * @typedef {Node | Array<Node>} AppendableElements
 */
/**
 * Interface für das globale GuardDOM-Utility zur HTML-Sanitisierung.
 * @typedef {Object} GuardDOMGlobal
 * @property {function(string): string} purify - Säubert einen HTML-String von potenziellen XSS-Vektoren.
 */
/**
 * Der Rückgabetyp der internen `#purifyElement`-Methode.
 * @typedef {Element | HTMLElement | null} PurifiedElement
 */

/**
 * Zentrale Rendering-Service-Klasse des Aspis-Frameworks.
 * Verwalter für das Asynchrone Kompilieren von Templates, Injizieren in das DOM,
 * Iterieren über Datenlisten und automatisches Anwenden von Sanitisierungs- und Cleanup-Routinen.
 * 
 * @public
 */
export class RenderService {
    /**
     * Instanz des Template-Services zum Laden und Kompilieren.
     * @internal
     * @type {TemplateService}
     */
    #templates;

    /**
     * Optionaler TreeCleaner zum Säubern von DOM-Subtrees vor dem Auswechseln von Inhalten.
     * @internal
     * @type {TreeCleaner | null}
     */
    #cleaner;

    /**
     * Erzeugt eine neue Instanz des RenderService.
     * 
     * @public
     * @param {TemplateService} templateService - Der zu nutzende TemplateService.
     * @param {TreeCleaner|null} [cleaner=null] - Optionaler TreeCleaner für DOM-Bereinigungen.
     * @throws {Error} Wenn kein `templateService` übergeben wurde.
     */
    constructor(templateService, cleaner = null) {
        if (!templateService) {
            throw new Error("Aspis [RenderService]: TemplateService ist erforderlich.");
        }
        this.#templates = templateService;
        this.#cleaner = cleaner;
    }

    /**
     * Kompiliert ein Template mit den übergebenen Daten und fügt das gesäuberte Ergebnis
     * in den `targetContainer` ein (ersetzt dessen bisherigen Inhalt).
     * 
     * @public
     * @async
     * @param {HTMLElement} targetContainer - Das Ziel-Element im DOM, das den Inhalt aufnehmen soll.
     * @param {string} templateName - Der Name/Bezeichner des zu rendernden Templates.
     * @param {RenderData} [data={}] - Die Render-Daten für das Template.
     * @returns {Promise<Element>} Das erfolgreich erzeugte und injizierte DOM-Element.
     * @throws {Error} Wenn `targetContainer` kein gültiges `HTMLElement` ist oder das Rendering fehlschlägt.
     */
    async paste(targetContainer, templateName, data = {}) {
        if (!targetContainer || !(targetContainer instanceof HTMLElement)) {
            throw new Error("Aspis [RenderService]: Ungültiges Ziel-Element für paste().");
        }

        const element = await this.compile(templateName, data);
        if (!element) {
            throw new Error(`Aspis [RenderService]: Rendering für '${templateName}' fehlgeschlagen.`);
        }

        if (this.#cleaner && typeof this.#cleaner.cleanTree === 'function') {
            this.#cleaner.cleanTree(targetContainer);
        }

        const cleanElement = this.#purifyElement(element);
        targetContainer.replaceChildren(cleanElement);
        return cleanElement;
    }

    /**
     * Kompiliert ein Template mit Daten. Baut bei Bedarf eine Asynchron-Sperre auf,
     * um nicht geladene Templates aus der Quelle nachzuladen.
     * 
     * @public
     * @async
     * @param {string} templateName - Name des Templates.
     * @param {RenderData} [data={}] - Die Render-Daten.
     * @returns {Promise<HTMLElement | Element | null>} Das erzeugte DOM-Element oder `null`, wenn die Kompilierung fehlschlägt.
     */
    async compile(templateName, data = {}) {
        let element = this.#templates.compile(templateName, { data });

        if (!element) {
            const templateData = await this.#templates.get(templateName);
            if (templateData) {
                element = this.#templates.compile(templateName, { data });
            }
        }

        return element;
    }

    /**
     * Iteriert über ein Array von Daten-Objekten oder `RenderableItem`-Instanzen,
     * rendert für jedes Item das angegebene Template und liefert ein gesammeltes `DocumentFragment` zurück.
     * 
     * @public
     * @async
     * @param {string} templateName - Name des zu wiederholenden Templates.
     * @param {Array<LoopItem>} [list=[]] - Liste der Datenobjekte/Modelle.
     * @returns {Promise<DocumentFragment>} Ein `DocumentFragment` mit allen gerenderten und gesäuberten Elementen.
     */
    async loop(templateName, list = []) {
        if (!Array.isArray(list)) {
            LoggerService.warn("[RenderService.loop()] Aspis [RenderService]: loop() erwartet ein Array.");
            return document.createDocumentFragment();
        }

        const fragment = document.createDocumentFragment();

        for (const item of list) {
            const renderData = item && typeof item.toRenderData === 'function' 
                ? item.toRenderData() 
                : item;

            const element = await this.compile(templateName, renderData);
            if (element) {
                fragment.appendChild(this.#purifyElement(element));
            }
        }

        return fragment;
    }

    /**
     * Ersetzt die Kinder des Ziel-Containers durch ein einzelnes Element oder ein Array von Elementen.
     * 
     * @public
     * @param {HTMLElement} targetContainer - Das Ziel-DOM-Element.
     * @param {AppendableElements} [elements=[]] - Das einzufügende Node-Element oder ein Array davon.
     * @returns {void}
     * @throws {Error} Wenn `targetContainer` kein gültiges `HTMLElement` ist.
     */
    combine(targetContainer, elements = []) {
        if (!targetContainer || !(targetContainer instanceof HTMLElement)) {
            throw new Error("Aspis [RenderService]: Ungültiges Ziel-Element für combine().");
        }

        const nodeList = Array.isArray(elements) ? elements : [elements];
        targetContainer.replaceChildren(...nodeList);
    }

    /**
     * Säubert das übergebene DOM-Element über das globale `GuardDOM`-Utility (falls vorhanden).
     * 
     * @internal
     * @param {HTMLElement | Element | null} element - Das zu desinfizierende DOM-Element.
     * @returns {PurifiedElement} Das desinfizierte Element oder das Ausgangselement.
     */
    #purifyElement(element) {
        if (!element) return null;
        if (typeof GuardDOM !== 'undefined' && typeof GuardDOM.purify === 'function') {
            const cleanHtml = GuardDOM.purify(element.outerHTML);
            const template = document.createElement('template');
            template.innerHTML = cleanHtml;
            return template.content.firstElementChild || element;
        }
        return element;
    }
}