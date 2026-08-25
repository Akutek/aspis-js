import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { AssetPath } from "../../src/core/AssetPath.js";

/** Testharnisch: Importer lädt Dateien per file:-URL, nicht über den Vite-HTTP-Origin. */
function useFileAssetRoot() {
    AssetPath.configure(`${pathToFileURL(join(process.cwd(), "src")).href}/`);
}

export { useFileAssetRoot };
