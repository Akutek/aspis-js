#!/usr/bin/env node

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const templateRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "template");

/** Kopiert das Vite-Template und setzt den Paketnamen. */
class CreateAspisApp {
    static main(argv) {
        const requested = argv[0] && argv[0].trim() ? argv[0].trim() : "aspis-app";
        if (requested === "--help" || requested === "-h") {
            process.stdout.write("Nutzung: create-aspis-app [verzeichnis]\n");
            return 0;
        }

        const target = resolve(process.cwd(), requested);
        const name = this.#packageName(requested, target);
        if (!name) {
            process.stderr.write("create-aspis-app: ungültiger Verzeichnisname.\n");
            return 1;
        }

        if (existsSync(target) && !this.#isEmpty(target)) {
            process.stderr.write(`create-aspis-app: '${target}' existiert und ist nicht leer.\n`);
            return 1;
        }

        mkdirSync(target, { recursive: true });
        cpSync(templateRoot, target, { recursive: true });
        this.#applyName(target, name);
        this.#renameGitignore(target);

        process.stdout.write(`Aspis-App in ${target} angelegt.\n`);
        process.stdout.write("Weiter: cd in das Verzeichnis, npm install, npm run dev.\n");
        return 0;
    }

    static #packageName(requested, target) {
        const raw = requested === "." || requested === "./" ? basename(target) : basename(requested);
        const slug = raw
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9._-]+/g, "-")
            .replace(/^[-.]+|[-.]+$/g, "");
        return slug || "";
    }

    static #isEmpty(dir) {
        return readdirSync(dir).length === 0;
    }

    static #applyName(target, name) {
        const pkgPath = join(target, "package.json");
        const raw = readFileSync(pkgPath, "utf8");
        writeFileSync(pkgPath, raw.replaceAll("__APP_NAME__", name), "utf8");
    }

    static #renameGitignore(target) {
        const from = join(target, "gitignore");
        const to = join(target, ".gitignore");
        if (existsSync(from)) {
            renameSync(from, to);
        }
    }
}

process.exitCode = CreateAspisApp.main(process.argv.slice(2));
