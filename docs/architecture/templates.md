# Templates anlegen

Aspis rendert HTML aus Katalog-Templates, nicht aus Strings im Controller. Diese Seite ist die Rezeptur für Menschen und Agenten. Die kurze Rule liegt unter [`.cursor/rules/templates.mdc`](../../.cursor/rules/templates.mdc).

## Laufzeit

| Stück | Rolle |
| --- | --- |
| [`templates-index-manifest.json`](../../src/manifests/templates/templates-index-manifest.json) | Name → `{ directory, file }` |
| [`TemplateCatalog`](../../src/services/template/TemplateCatalog.js) | Index und HTML-Teile laden |
| [`TemplateService`](../../src/services/TemplateService.js) | Cache, `get`, `compile` |
| [`TemplateRenderService`](../../src/services/TemplateRenderService.js) | `paste` (ersetzen), `append` (anhängen), `loop` (Liste) |

Platzhalterwerte gehen durch den Sanitizer. Roh-`innerHTML` mit Nutzdaten gehört nicht hierher.

## Rezept

1. Ordner `src/templates/<name>/`.
2. Datei `<name>.json` mit `"name"` und `"files"`.
3. HTML-Teile neben dem JSON. Ein Stück: `"markup"`. Mehrere Stücke: `"layout"` plus Teile (`item`, `field`, …).
4. Platzhalter `{{key}}` im HTML. Schleifen im JSON unter `"loops"`; im Layout denselben Placeholder (zum Beispiel `{{item-loop}}`). `from` muss ein **Array** in den Compile-Daten sein (Objekte als Map werden nicht iteriert).
5. Eintrag im Index:

```json
"form-login": {
    "directory": "templates/form-login",
    "file": "form-login.json"
}
```

6. Controller setzen `data-template="<name>"` oder nutzen den Default der Klasse (`ControllerFormRender` → `form-component`, `ControllerModal` → `modal`, Modal-Inhalt `form` → `form-component` oder `data-form-template`).

## Zwei Muster

**Ein Stück** — siehe `loader-spinner`: JSON mit `files.markup` und `placeholder`, eine HTML-Datei.

**Layout plus Loop** — siehe `accordion`: `files.layout` + `files.item`, `loops.item` mit `placeholder`, `from: "items"`, `part: "item"`. Compile-Daten brauchen `items: [ { id, title, content }, … ]`.

Formulare: `form-component` ist das generische Layout (`{{field-loop}}`). Fachformulare (`form-login`, `form-character`, …) sind eigene Markup-Templates mit festen Feldern.

## Aufruf

```js
await renderService.paste(host, "form-login", {
  action: "/anmelden",
  csrf: token,
  next: "/",
  submitLabel: "Anmelden"
});
```

`paste` ersetzt den Inhalt von `host`. `append` hängt an (Modal an `document.body`). Daten nur über dieses Objekt, nicht per String-Konkatenation ins Markup.
