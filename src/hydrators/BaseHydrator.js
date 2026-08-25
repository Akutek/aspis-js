import { assertManifestVersion } from "./helpers/assertManifestVersion.js";
class BaseHydrator {
  /** Objektpflicht, Versionsvertrag, dann Kind-`transform`. */
  static hydrate(rawData) {
    if (!rawData || typeof rawData !== "object" || Array.isArray(rawData)) {
      throw new Error(`Aspis [${this.name}]: Keine Rohdaten zum Hydratisieren \xFCbergeben.`);
    }
    const raw = rawData;
    assertManifestVersion(raw, this.name);
    return this.transform(raw);
  }
  /** Kindklassen überschreiben diese Transformation. */
  static transform(_rawData) {
    throw new Error(`Aspis [${this.name}]: Die Methode 'transform()' muss implementiert werden.`);
  }
}
export {
  BaseHydrator
};
