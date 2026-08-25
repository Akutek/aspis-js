import { defineConfig } from "vite";

/**
 * Dev-Server für native ESM. Kein Bundle nötig — Vite liefert Module + JSON.
 * `base: "./"` erlaubt Subpath-Deployments und relative Asset-URLs.
 */
export default defineConfig({
    base: "./",
    root: ".",
    server: {
        port: 4173,
        open: "/index.html"
    },
    preview: {
        port: 4173
    },
    build: {
        outDir: "dist",
        emptyOutDir: true,
        rollupOptions: {
            input: {
                main: "index.html"
            }
        }
    }
});
