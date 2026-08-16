/**
 * Konfigurations- oder Bezeichnerwert für das Layout eines Hauptmodells.
 * @typedef {string | Record<string, any>} LayoutConfig
 */
/**
 * Beliebiger JSON-Datensatz aus der Eingabe-Liste.
 * @typedef {Record<string, any>} JsonDataItem
 */
/**
 * Möglicher Eingabetyp für das JSON-Datenargument (Array oder beliebiger Wert).
 * @typedef {Array<JsonDataItem> | unknown} JsonDataInput
 */
/**
 * Schnittstelle für Instanzen von untergeordneten Modellen (Child-Instanzen).
 * @typedef {Record<string, any>} ChildModelInstance
 */
/**
 * Schnittstelle für das Hauptmodell mit optionaler Zeilen-Hinzufügen-Methode.
 * @typedef {Object} MainModelInstance
 * @property {function(ChildModelInstance): void} [appendRow] - Fügt eine erzeugte Kind-Instanz an das Hauptmodell an.
 */
/**
 * Statische Predicate-Funktion einer Kind-Klasse zur Ermittlung der Zuständigkeit für ein Daten-Item.
 * @callback CanHandlePredicate
 * @param {JsonDataItem} itemData - Der zu prüfende Einzel-Datensatz.
 * @returns {boolean} `true`, wenn die Klasse den Datensatz verarbeiten kann.
 */
/**
 * Konstruktor-Signatur zur Instanziierung einer Kind-Klasse.
 * @template {ChildModelInstance} [C=ChildModelInstance]
 * @typedef {new (itemData: JsonDataItem) => C} ChildClassConstructorFn
 */
/**
 * Statische Schnittstelle einer Kind-Klasse (Konstruktor + optionale `canHandle`-Methode).
 * @template {ChildModelInstance} [C=ChildModelInstance]
 * @typedef {ChildClassConstructorFn<C> & { canHandle?: CanHandlePredicate }} ChildClassConstructor
 */
/**
 * Gültiger Eingabetyp für das `ChildClasses`-Argument (Einzelklasse oder Array von Klassen).
 * @template {ChildModelInstance} [C=ChildModelInstance]
 * @typedef {ChildClassConstructor<C> | Array<ChildClassConstructor<C>>} ChildClassesInput
 */
/**
 * Konstruktor-Signatur für das Hauptmodell.
 * @template {MainModelInstance} [M=MainModelInstance]
 * @typedef {new (layout?: LayoutConfig) => M} MainClassConstructor
 */

/**
 * Zentrale Factory-Klasse des Aspis-Frameworks zur dynamischen Instanziierung
 * von Hauptmodellen und deren zugewiesenen Kind-Modellen anhand von strukturierten JSON-Daten.
 * 
 * @public
 */
export class Factory {
    /**
     * Erzeugt eine Instanz des Hauptmodells (`MainClass`) und ordnet diesem dynamisch
     * erzeugte Kind-Instanzen (`ChildClasses`) basierend auf den übergebenen JSON-Daten zu.
     * 
     * @public
     * @static
     * @template {MainModelInstance} M
     * @template {ChildModelInstance} C
     * @param {MainClassConstructor<M>} MainClass - Die Konstruktor-Klasse des Hauptmodells.
     * @param {ChildClassesInput<C>} ChildClasses - Eine einzelne Kind-Modell-Klasse oder ein Array von Kind-Modell-Klassen.
     * @param {LayoutConfig} layout - Das zu verwendende Layout oder die Konfiguration für das Hauptmodell.
     * @param {JsonDataInput} jsonData - Array von Datenobjekten zur Erzeugung und Zuordnung der Kind-Instanzen.
     * @returns {M} Die erzeugte und gegebenenfalls mit Kind-Instanzen befüllte Hauptmodell-Instanz.
     */
    static create(MainClass, ChildClasses, layout, jsonData) {
        const mainInstance = new MainClass(layout);

        if (!Array.isArray(jsonData)) {
            return mainInstance;
        }

        const childBlueprints = Array.isArray(ChildClasses) ? ChildClasses : [ChildClasses];

        jsonData.forEach(itemData => {
            let matchedRowInstance = null;

            for (const ChildClass of childBlueprints) {
                if (typeof ChildClass.canHandle !== 'function' || ChildClass.canHandle(itemData)) {
                    matchedRowInstance = new ChildClass(itemData);
                    break;
                }
            }

            if (matchedRowInstance) {
                if (typeof mainInstance.appendRow === 'function') {
                    mainInstance.appendRow(matchedRowInstance);
                } else {
                    LoggerService.warn("[Factory.create()] Factory: Das Hauptmodell besitzt keine 'appendRow'-Schnittstelle.");
                }
            } else {
                LoggerService.warn("[Factory.create()] Factory: Kein passender Klassen-Blueprint für diesen Datensatz gefunden:", itemData);
            }
        });

        return mainInstance;
    }
}