# Templates anlegen

Aspis rendert HTML aus Steinen und Blueprints. Diese Seite ist die Rezeptur. Die kurze Rule liegt unter [`.cursor/rules/templates.mdc`](../../.cursor/rules/templates.mdc).

## Laufzeit

| Stück | Rolle |
| --- | --- |
| [`templates-index-manifest.json`](../../src/manifests/templates/templates-index-manifest.json) | Name → `{ directory, file }` (`.html` Stein, `.json` Blueprint) |
| [`TemplateBrickHydrator`](../../src/hydrators/TemplateBrickHydrator.js) | Ein Hydrator zwischen HTML-Stein und Service: `data-config` parsen, Markup/`clean`/`attr` |
| [`BlueprintManifestHydrator`](../../src/hydrators/BlueprintManifestHydrator.js) | Ein Hydrator zwischen Blueprint-JSON und RenderService: Baum prüfen, Namen/Klassen/Maps |
| [`TemplateCatalog`](../../src/services/template/TemplateCatalog.js) | Index laden, Datei holen, an den passenden Hydrator geben |
| [`TemplateService`](../../src/services/TemplateService.js) | Cache, `resolve`, `get`, `compile` (ein Stein) |
| [`TemplateRenderService`](../../src/services/TemplateRenderService.js) | Blueprint laufen, `paste` / `append` / `loop` |

Kein Roh-`innerHTML` mit Nutzdaten. Sanitize liegt in den Hydratoren, nicht in den Services.

## Stein

1. Datei `src/templates/<ordner>/<name>.html` mit `<template id="…" data-config='{"name":"…","role":"root|container|leaf","slots":{…}}'>`.
2. Platzhalter `{{key}}` im Markup. Slots `{{slot…}}` als Textknoten.
3. Eintrag im Index auf die **HTML-Datei**. Der `name` im `data-config` ist der Katalog-Key des Steins (darf nicht derselbe Key wie ein Blueprint sein).

## Blueprint

1. Datei `src/manifests/templates/blueprints/<variante>.json` mit `"kind": "blueprint"`, `"root"`, optional `"branch"`, `"slots"`, `"classes"`, `"map"`.
2. Eintrag im Index auf die **JSON-Datei**. Der Katalog-Key ist der Host-Name (`data-manifest`).
3. `classes.root` / `branch` / `header` / `content` oder `classKey` am Slot. Parent-CSS: `{familie}Base` plus Variante.

## Aufruf

```js
await renderService.paste(host, "form-login", {
  action: "/anmelden",
  csrf: token,
  next: "/",
  submitLabel: "Anmelden"
});
```

`paste` ersetzt den Inhalt von `host`. Daten nur über dieses Objekt.
