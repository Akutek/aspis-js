import { AssetPath } from "../core/AssetPath.js";
class ManifestLoaderService {
  /**
   * Lädt eine JSON-Ressource und gibt das geparste Objekt zurück.
   * Optional einen Hydrator (`hydrate`). Ohne Hydrator bleibt das JSON roh.
   *
   * Wirft, wenn der Fetch fehlschlägt oder die Antwort nicht OK ist.
   */
  static async load(path, hydrator = null) {
    const url = AssetPath.resolve(path);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Aspis [ManifestLoaderService]: Konnte '${url}' nicht laden (Status: ${response.status} ${response.statusText}).`);
    }
    const rawData = await this.#json(response, url);
    if (hydrator && typeof hydrator.hydrate === "function") {
      return hydrator.hydrate(rawData);
    }
    return rawData;
  }
  static async #json(response, url) {
    try {
      return await response.json();
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`Aspis [ManifestLoaderService]: '${url}' ist kein JSON (${reason}).`);
    }
  }
}
export {
  ManifestLoaderService
};
