import { AssetPath } from "../core/AssetPath.js";
class ManifestLoaderService {
  /**
   * Lädt eine JSON-Ressource. Mit Channel: Text → `cmd:hydrate` (Worker/Loopback), dann Hydrator auf Main.
   * Ohne Channel: `response.json()` wie bisher.
   *
   * Wirft, wenn der Fetch fehlschlägt oder die Antwort nicht OK ist.
   */
  static async load(path, hydrator = null, channel = null) {
    const url = AssetPath.resolve(path);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Aspis [ManifestLoaderService]: Konnte '${url}' nicht laden (Status: ${response.status} ${response.statusText}).`);
    }
    const rawData = await this.#payload(response, url, channel);
    if (hydrator && typeof hydrator.hydrate === "function") {
      return hydrator.hydrate(rawData);
    }
    return rawData;
  }
  static async #payload(response, url, channel) {
    if (channel && typeof channel.request === "function") {
      const text = await response.text();
      return channel.request("cmd:hydrate", text);
    }
    return this.#json(response, url);
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
