import { defineConfig } from "vite";

/**
 * aspis-js liefert ESM-JavaScript und lädt Klassen faul.
 * Vite darf das Paket nicht vorab bündeln — sonst brechen Import und AssetPath.
 */
export default defineConfig({
    optimizeDeps: {
        exclude: ["aspis-js"]
    }
});
