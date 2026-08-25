import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = dirname(fileURLToPath(import.meta.url));

/** Testharnisch. Die Demo läuft ohne Vite (php -S / lima-city). */
export default defineConfig({
    root,
    test: {
        root,
        environment: "jsdom",
        include: ["tests/**/*.test.js"],
        benchmark: {
            include: ["tests/**/*.bench.js"]
        },
        restoreMocks: true,
        fileParallelism: false,
        pool: "forks",
        environmentOptions: {
            jsdom: {
                url: "http://localhost:3000/"
            }
        }
    }
});
