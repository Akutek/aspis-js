import { GuardDOM } from "../utils/";

/**
 * Sanitizer-Funktion zur Bereinigung von Werten vor der HTML-Injektion.
 * @callback SanitizerFunction
 * @param {any} value - Der zu bereinigende Wert.
 * @returns {string} Der bereinigte/sanitisierte String.
 */
/**
 * Optionen zur Konfiguration der `TemplateService`-Instanz.
 * @typedef {Object} TemplateServiceOptions
 * @property {string} [basePath="./js/aspis/templates/"] - Basispfad für das Nachladen von externen Templates.
 * @property {SanitizerFunction|null} [sanitizer=null] - Benutzerdefinierte Sanitizer-Funktion. Fallback ist der interne Default-Sanitizer.
 * @property {boolean} [autoInit=true] - Steuert, ob beim Erzeugen direkt `init()` aufgerufen wird.
 */
/**
 * Konfigurationsobjekt, das als String (basePath) oder Optionsobjekt übergeben wird.
 * @typedef {string | TemplateServiceOptions} TemplateServiceConfig
 */
/**
 * Manifest- / Konfigurationsobjekt eines spezifischen Templates.
 * @typedef {Object} TemplateConfig
 * @property {string} [name] - Eindeutiger Name des Templates.
 * @property {Record<string, string>} [placeholder] - Platzhalter-Mapping.
 * @property {Record<string, string>} [slots] - Slot-Platzhalter.
 * @property {Record<string, string>} [attributes] - Attribut-Platzhalter.
 * @property {Record<string, string>} [files] - Mapping von Teil-Dateien beim Server-Fetch.
 * @property {string} [html] - Inline-HTML-String (optional).
 * @property {boolean} [partial] - Gibt an, ob es sich um ein Partial handelt.
 * @property {Record<string, any>} [events] - Registrierte Event-Handler oder Metadaten.
 * @property {Record<string, any>} [styles] - Stylesheet-Metadaten.
 * @property {Record<string, any>} [targets] - Target-Deklarationen.
 * @property {Record<string, any>} [bindings] - Data-Binding-Deklarationen.
 */
/**
 * Nach der Normalisierung im Cache gespeicherte Template-Struktur.
 * @typedef {Object} NormalizedTemplate
 * @property {string} id - Eindeutige Template-ID.
 * @property {string} role - Rolle des Templates (z.B. 'partial' oder 'container').
 * @property {boolean} isRoot - Gibt an, ob das Template ein Root-Element ist.
 * @property {string|null} childSlot - Standard-Child-Slot-Bezeichner.
 * @property {Array<string>} allowedChildren - Erlaubte Kind-Templates.
 * @property {Record<string, any>} events - Event-Konfigurationen.
 * @property {Record<string, any>} styles - Style-Konfigurationen.
 * @property {Record<string, any>} targets - DOM-Target-Zuordnungen.
 * @property {Record<string, any>} bindings - Data-Binding-Regeln.
 * @property {string} html - Aufbereiter HTML-Quelltext.
 * @property {Record<string, string>} slots - Map von Slot-Schlüsseln auf deren Platzhalter.
 * @property {Record<string, string>} attributes - Map von Attribut-Schlüsseln auf deren Platzhalter.
 * @property {Record<string, string>} data - Map von Daten-Schlüsseln auf deren Platzhalter.
 * @property {Array<[string, string]>} sortedData - Nach Länge absteigend sortierte Daten-Platzhalter-Paare.
 * @property {Array<[string, string]>} sortedAttributes - Nach Länge absteigend sortierte Attribut-Platzhalter-Paare.
 * @property {Record<string, string>} placeholder - Ursprüngliche Platzhalter-Map.
 * @property {TemplateConfig} config - Ursprüngliches Konfigurationsobjekt.
 */
/**
 * Möglicher Slot-Inhalt (einzelner Node, Array von Nodes, HTML/Text-String oder ein Array von Strings).
 * @typedef {Node | string | Array<Node | string>} SlotContent
 */
/**
 * Map von Slot-Namen zu den einzufügenden Inhalte-Nodes oder -Strings.
 * @typedef {Record<string, SlotContent>} SlotPayloadMap
 */
/**
 * Payload-Konfiguration für das Kompilieren eines Templates.
 * @typedef {Object} CompilePayload
 * @property {Record<string, any>} [data] - Daten-Ersatzwerte für Textplatzhalter.
 * @property {Record<string, any>} [attributes] - Werte für Attribut-Platzhalter.
 * @property {SlotPayloadMap} [slots] - Elemente oder Strings zur Befüllung von Slots.
 */
/**
 * Globales GuardDOM-Sicherheits-Utility (falls verfügbar).
 * @typedef {Object} GuardDOMGlobal
 * @property {function(any): string} [clean] - Bereinigt Eingabewerte.
 * @property {function(any): string} [purify] - Sanitisierte HTML-Strings.
 */

/**
 * Zentrale Template-Verwaltungs-Klasse des Aspis-Frameworks.
 * Zuständig für das Laden, Cachen, Parsing, Sanitisieren und Kompilieren
 * von HTML-Templates inkl. Slot-Handling und Data-Binding-Vorbereitungen.
 * 
 * @public
 */
export class TemplateService {
    /**
     * Cache-Speicher für aufbereitete Template-Objekte.
     * @internal
     * @type {Map<string, NormalizedTemplate>}
     */
    #cache = new Map();

    /**
     * Basis-Pfad für das dynamische Nachladen von Server-Templates.
     * @internal
     * @type {string}
     */
    #basePath;

    /**
     * Aktive Sanitizer-Funktion zur Bereinigung von Datenwerten.
     * @internal
     * @type {SanitizerFunction}
     */
    #sanitizer;

    /**
     * Erzeugt eine neue Instanz des TemplateService.
     * 
     * @public
     * @param {TemplateServiceConfig} [config={}] - Basispfad als String oder Konfigurationsobjekt.
     */
    constructor(config = {}) {
        const options = typeof config === 'string' ? { basePath: config } : config;
        const { 
            basePath = "./js/aspis/templates/", 
            sanitizer = null, 
            autoInit = true 
        } = options;

        this.#basePath = basePath.endsWith('/') ? basePath : `${basePath}/`;
        this.#sanitizer = sanitizer || this.#defaultSanitizer.bind(this);

        if (autoInit) {
            this.init();
        }
    }

    /**
     * Liest im DOM vorhandene `<template>`-Elemente mit `data-config`-Attributen aus
     * und lädt diese in den internen Cache.
     * 
     * @public
     * @returns {void}
     */
    init() {
        const templateElements = document.querySelectorAll('template');
        
        templateElements.forEach(el => {
            const configAttr = el.dataset.config || el.getAttribute('data-config') || el.getAttribute('data-aspis-config');
            if (!configAttr) return;

            try {
                const config = JSON.parse(configAttr);
                const templateData = this.#normalizeTemplate(el.id, config, el.innerHTML);
                this.#cache.set(config.name || el.id, templateData);
            } catch (error) {
                console.error(`Aspis [TemplateService]: JSON-Parse-Fehler bei Template #${el.id}`, error);
            }
        });

        console.info(`Aspis [TemplateService]: Initialisiert. ${this.#cache.size} Templates aus dem DOM geladen.`);
    }

    /**
     * Prüft, ob ein Template unter dem angegebenen Namen im Cache vorhanden ist.
     * 
     * @public
     * @param {string} name - Der eindeutige Name des Templates.
     * @returns {boolean} `true`, wenn das Template im Cache existiert.
     */
    has(name) {
        return this.#cache.has(name);
    }

    /**
     * Leert den gesamten internen Template-Cache.
     * 
     * @public
     * @returns {void}
     */
    clearCache() {
        this.#cache.clear();
    }

    /**
     * Liefert das aufbereitete Template aus dem Cache oder versucht es asynchron vom Server zu laden.
     * 
     * @public
     * @async
     * @param {string} name - Der Name des Templates.
     * @returns {Promise<NormalizedTemplate | null>} Das geladene Template oder `null` im Fehlerfall.
     */
    async get(name) {
        if (this.#cache.has(name)) {
            return this.#cache.get(name);
        }

        console.warn(`Aspis [TemplateService]: '${name}' nicht im Cache. Starte dynamischen Fetch...`);
        try {
            return await this.#loadFromServer(name);
        } catch (error) {
            return null;
        }
    }

    /**
     * Kompiliert ein gecachtes Template anhand der übergebenen Payload (Daten, Attribute, Slots)
     * und erzeugt eine gebrauchsfertige HTML-Element-Instanz.
     * 
     * @public
     * @param {string} name - Name des zu kompilierenden Templates.
     * @param {CompilePayload} [payload={}] - Payload-Objekt mit Daten, Attributen und Slots.
     * @returns {Element | null} Das erzeugte DOM-Element oder `null` bei einem Fehler.
     */
    compile(name, payload = {}) {
        const template = this.#cache.get(name);
        if (!template) {
            console.error(`Aspis [TemplateService]: Template '${name}' nicht im Cache gefunden. Kompilierung abgebrochen.`);
            return null;
        }

        const payloadData = payload.data ?? {};
        const payloadAttributes = payload.attributes ?? {};
        const payloadSlots = payload.slots ?? {};

        let workingHtml = template.html;

        workingHtml = this.#replacePlaceholders(workingHtml, template.sortedData, payloadData);
        workingHtml = this.#replacePlaceholders(workingHtml, template.sortedAttributes, payloadAttributes);

        const fragment = document.createRange().createContextualFragment(workingHtml);
        const element = fragment.firstElementChild;

        if (!element) {
            console.error(`Aspis [TemplateService]: Transformation von '${name}' in den DOM fehlgeschlagen.`);
            return null;
        }

        this.#processSlots(element, template.slots, payloadSlots);

        return element;
    }

    /**
     * Liefert die für ein Template definierten Event-Konfigurationen zurück.
     * 
     * @public
     * @param {string} name - Name des Templates.
     * @returns {Record<string, any>} Event-Zuordnungen oder ein leeres Objekt.
     */
    getTemplateEvents(name) {
        return this.#cache.get(name)?.events ?? {};
    }

    /**
     * Ersetzt geordnete Platzhalter in einem HTML-String durch sanitisierte Werte.
     * 
     * @internal
     * @param {string} html - Der Ausgangs-HTML-String.
     * @param {Array<[string, string]>} sortedEntries - Sortierte Schlüssel-Platzhalter-Paare.
     * @param {Record<string, any>} values - Das Werte-Objekt für die Ersetzung.
     * @returns {string} Der verarbeitete HTML-String.
     */
    #replacePlaceholders(html, sortedEntries, values) {
        let result = html;
        for (const [key, placeholder] of sortedEntries) {
            const rawValue = values[key] ?? "";
            const cleanValue = this.#sanitizer(rawValue);
            result = result.replaceAll(placeholder, cleanValue);
        }
        return result;
    }

    /**
     * Ersetzt Slot-Platzhalter im erzeugten DOM-Baum durch die entsprechenden Payload-Inhalte.
     * 
     * @internal
     * @param {Element} rootElement - Das Wurzel-Element des kompilierten Templates.
     * @param {Record<string, string>} slotsMap - Das Mapping von Slot-Namen auf Platzhalter-Strings.
     * @param {SlotPayloadMap} payloadSlots - Die im Payload mitgegebenen Slot-Inhalte.
     * @returns {void}
     */
    #processSlots(rootElement, slotsMap, payloadSlots) {
        Object.entries(slotsMap).forEach(([key, placeholder]) => {
            const walker = document.createTreeWalker(rootElement, NodeFilter.SHOW_TEXT);
            let targetNode = null;
            let currentNode;

            while ((currentNode = walker.nextNode())) {
                if (currentNode.nodeValue.includes(placeholder)) {
                    targetNode = currentNode;
                    break;
                }
            }

            if (!targetNode) return;

            const parent = targetNode.parentNode;
            const slotContent = payloadSlots[key];

            if (!slotContent) {
                targetNode.remove();
                return;
            }

            if (Array.isArray(slotContent)) {
                slotContent.forEach(child => this.#appendSlotChild(parent, targetNode, child));
            } else {
                this.#appendSlotChild(parent, targetNode, slotContent);
            }

            targetNode.remove();
        });
    }

    /**
     * Fügt Slot-Inhalte vor einem Ziel-Textknoten ein.
     * 
     * @internal
     * @param {Node} parent - Das Vater-Element des Target-Nodes.
     * @param {Node} targetNode - Der zu ersetzende Text-Knoten mit dem Slot-Platzhalter.
     * @param {Node | string} content - Der einzufügende Knoten oder HTML/Text-String.
     * @returns {void}
     */
    #appendSlotChild(parent, targetNode, content) {
        if (content instanceof Node) {
            parent.insertBefore(content, targetNode);
        } else if (typeof content === "string") {
            const fragment = document.createRange().createContextualFragment(content);
            parent.insertBefore(fragment, targetNode);
        }
    }

    /**
     * Standard-Sanitizer zur Vorbeugung von XSS-Schwachstellen.
     * Nutzt `GuardDOM` falls vorhanden oder führt ein HTML-Entities-Escaping durch.
     * 
     * @internal
     * @param {any} val - Der zu sanitisierende Wert.
     * @returns {string} Der bereinigte String.
     */
    #defaultSanitizer(val) {
        if (typeof GuardDOM !== 'undefined') {
            if (typeof GuardDOM.clean === 'function') return GuardDOM.clean(val);
            if (typeof GuardDOM.purify === 'function') return GuardDOM.purify(val);
        }
        
        if (val === null || val === undefined) return '';
        return String(val)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /**
     * Lädt Manifest und Teildateien eines Templates per `fetch` vom Server.
     * 
     * @internal
     * @async
     * @param {string} name - Name des nachzuladenden Templates.
     * @returns {Promise<NormalizedTemplate>} Das geparste und normalisierte Template.
     * @throws {Error} Wenn das Manifest oder Teildateien nicht geladen werden können.
     */
    async #loadFromServer(name) {
        const url = `${this.#basePath}${name}/${name}.json`;
        
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Manifest für '${name}' nicht gefunden (Status ${response.status})`);
            const manifest = await response.json();

            let htmlString = "";
            if (manifest.files) {
                const fetchTasks = Object.entries(manifest.files).map(async ([, fileName]) => {
                    const htmlRes = await fetch(`${this.#basePath}${name}/${fileName}`);
                    if (!htmlRes.ok) throw new Error(`Teil-Datei '${fileName}' fehlt`);
                    return await htmlRes.text();
                });
                
                const htmlContents = await Promise.all(fetchTasks);
                htmlString = htmlContents.join("\n");
            } else if (manifest.html) {
                htmlString = manifest.html;
            }
            
            const templateData = this.#normalizeTemplate(name, manifest, htmlString);
            this.#cache.set(name, templateData);
            return templateData;
        } catch (error) {
            console.error(`Aspis [TemplateService]: Dynamischer Fetch für '${name}' fehlgeschlagen!`, error);
            throw error;
        }
    }

    /**
     * Normalisiert Rohteile eines Templates in ein einheitliches `NormalizedTemplate`-Objekt.
     * 
     * @internal
     * @param {string} id - Die ID / der Name des Templates.
     * @param {TemplateConfig} config - Die Manifest- / Template-Konfiguration.
     * @param {string} htmlString - Der ungefilterte HTML-String.
     * @returns {NormalizedTemplate} Das aufbereitete Template-Objekt.
     */
    #normalizeTemplate(id, config, htmlString) {
        const placeholders = config.placeholder || { ...config.slots, ...config.attributes } || {};
        const slots = {}, attributes = {}, data = {};

        Object.entries(placeholders).forEach(([key, value]) => {
            const isValuePlaceholder = String(value).startsWith('{{');
            const placeholder = isValuePlaceholder ? value : key;
            const cleanKey = placeholder.replace(/{{|}}/g, '');
            const type = isValuePlaceholder ? key : value;

            if (cleanKey.startsWith('slot') || ["temp", "temp-loop", "container"].includes(type)) {
                slots[cleanKey] = placeholder;
            } else if (cleanKey.startsWith('attr') || type === "attr") {
                attributes[cleanKey] = placeholder;
            } else {
                data[cleanKey] = placeholder;
            }
        });

        const sortByLengthDesc = (obj) => Object.entries(obj)
            .sort(([, a], [, b]) => b.length - a.length);

        const defaults = {
            id: id || config.name,
            role: config.partial ? 'partial' : 'container',
            isRoot: false,
            childSlot: null,
            allowedChildren: [],
            events: {},
            styles: {},
            targets: {},
            bindings: {}
        };

        return {
            ...defaults,
            ...config,
            html: htmlString.trim(),
            slots,
            attributes,
            data,
            sortedData: sortByLengthDesc(data),
            sortedAttributes: sortByLengthDesc(attributes),
            placeholder: placeholders,
            config
        };
    }
}