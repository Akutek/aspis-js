# Aspis JS

Manifestgetriebenes Vanilla-ESM-Frontend. Einmal Boot, danach `runCycle` in `src/aspis.js`:

Scan → Plan → Compare → Observer → Compose → Controller → Splice → Factory.

**Manager** dirigieren ein Pipeline-Kapitel (Routing, Schritte). **Extension** baut den bezogenen Host oder das Kapitel aus. **Hydrator** formt einen Manifest-Typ (Index, Normalisieren); `BaseHydrator` plus Sub-Hydratoren.

Kein TypeScript, kein Bundler, kein npm-Paket, kein Node. Der Browser lädt Module nativ (`<script type="module">`).

Ausführlich: [`docs/architecture/roadmap.md`](docs/architecture/roadmap.md).

## Start (Demo)

Lokal mit PHP (beliebiger HTTP-Server mit ESM- und JSON-MIME reicht):

```bash
php -S localhost:8080
```

Dann `http://localhost:8080/` — nicht `file://`, sonst schlägt `fetch` der Manifeste fehl.

**lima-city:** `index.html`, `src/` und `.htaccess` hochladen. Nicht hochladen: `.git`. Apache braucht `.js` als JavaScript und `.json` als JSON (steht in `.htaccess`).

Öffentliche Runtime: `start()`, `stop(registry?)`, `runCycle(registry)`. Manager, Extension, Tailor und Splicer bleiben intern. Die Demo ruft nur `start()`.

```js
import { start, stop, runCycle } from "./src/aspis.js";

const registry = await start();
```

Kein npm-Paket, kein Vite, kein Node. Einbindung: relatives `./src/aspis.js` derselben Origin.

## Typen (IDE)

Geteilte Formen liegen in `src/types/` als JSDoc-`@typedef`. Cursor prüft über `jsconfig.json` (`checkJs`, kein Emit, kein Node-`@types`). Der Browser sieht nur `.js`. Im Code die Form nicht wiederholen, nur verweisen:

```js
/** @param {import("./types/registry.js").Registry} registry */
```

Kein `types.d.ts`, kein `tsconfig.json`. Factory-Mixins (Table, Form, Modal, Accordion, Dropdown) sind in `jsconfig.json` ausgenommen: `ComposeMixinService` kopiert Methoden, `checkJs` folgt dem Mix nicht.

## Pfade

Manifest-, Import- und Fetch-Pfade über `AssetPath` (`src/core/AssetPath.js`):

- Root = `src/`, aus `import.meta.url` (Subpfad, CDN, lokaler Server)
- Katalog-Einträge relativ zu `src/` (`controllers/…`, `manifests/…`)
- Legacy `/src/…` wird normalisiert
- Optional: `app-config.json` → `publicPaths.base`

## Controller-Trigger (Kanon)

Kurze Keys in `data-controller` — `ControllerTrigger` / `plan-index-manifest.json`:

| DOM | Plan-Key |
|-----|----------|
| `accordion` | `accordion` |
| `dropdown` | `dropdown` |
| `form` | `form` |
| `form` + `data-layout="simple"` | `form.simple` |
| `form-simple` | `form-simple` |
| `table` | `table` |
| `modal` | `modal` |

Klassennamen (`ControllerAccordion`) und Alt-Keys (`custom-dropdown`) landen auf demselben Key.

## Schleife

`BootManager.boot()` einmal. Danach `runCycle(registry)` — in der Registry als `cycle` für den MutationWatcher. `stop()` hält Watcher, zerstört Controller, löst `cycle`. Compare: `add` / `keep` / `update` / `remove`. Am Knoten: `data-aspis-origin`, `data-aspis-controller`.
