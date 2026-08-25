function accordionMarkup(id = "a1") {
  return `
        <div data-controller="accordion" data-slice-key="features.accordionFeature" data-single-open="true">
            <div data-accordion-item data-id="${id}">
                <button type="button" data-target="trigger">Abschnitt</button>
                <div data-target="panel">Inhalt</div>
            </div>
        </div>
    `;
}
function accordionForest(count) {
  const chunks = [];
  for (let i = 0; i < count; i += 1) {
    chunks.push(accordionMarkup(`n${i}`));
  }
  return chunks.join("");
}
function extraAccordion(id = "extra") {
  const element = document.createElement("div");
  element.dataset.controller = "accordion";
  element.dataset.sliceKey = "features.accordionFeature";
  element.innerHTML = `
        <div data-accordion-item data-id="${id}">
            <button type="button" data-target="trigger">Extra</button>
            <div data-target="panel">Neu</div>
        </div>
    `;
  return element;
}
function controllerElement() {
  const element = document.querySelector("[data-controller='accordion']");
  if (!(element instanceof HTMLElement)) {
    throw new Error("Accordion-Fixture fehlt.");
  }
  return element;
}
export {
  accordionForest,
  accordionMarkup,
  controllerElement,
  extraAccordion
};
