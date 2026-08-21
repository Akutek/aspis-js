/**
 * @file ManifestLoaderService.js
 * @description Zentraler Service zum Laden und Parsen von JSON-Dateien und Manifesten.
 */

/**
 * Service für das asynchrone Laden von Ressourcen per Fetch.
 * Bleibt absichtlich dumm (keine Geschäftslogik) und liefert reine Rohdaten.
 * 
 * @public
 */
export class ManifestLoaderService {
    /**
     * Lädt eine JSON-Ressource von einem angegebenen Pfad und gibt das geparste Objekt zurück.
     * 
     * @public
     * @static
     * @async
     * @param {string} path - Der relative oder absolute Dateipfad zur JSON-Ressource.
     * @returns {Promise<Object>} Das erfolgreich geparste JSON-Objekt.
     * @throws {Error} Wirft einen Fehler, wenn der Fetch fehlschlägt oder die Antwort nicht OK ist.
     */
    static async load(path) {
        const response = await fetch(path);
        
        if (!response.ok) {
            throw new Error(`Aspis [ManifestLoaderService]: Konnte '${path}' nicht laden (Status: ${response.status} ${response.statusText}).`);
        }

        return await response.json();
    }
}