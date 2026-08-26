/** @typedef {import("../types/controllers.js").AccordionHost} AccordionHost */
/** @typedef {import("../types/controllers.js").ControllerOptions} ControllerOptions */
/** @typedef {import("../types/controllers.js").LoaderLike} LoaderLike */
/** @typedef {import("../types/schema.js").AccordionItemView} AccordionItemView */
/** @typedef {import("../types/schema.js").AccordionView} AccordionView */
import { SchemaService } from "../services/SchemaService.js";
import { ControllerModifierDOM } from "../utils/ControllerModifierDOM.js";
import { errorMessage, errorName } from "./BaseController.js";
/** @extends {AccordionHost} */
class ControllerAccordion {
  prepare(options = {}) {
    this._kind = "ControllerAccordion";
    if (!this._sliceKey) {
      this._sliceKey = typeof options.sliceKey === "string" ? options.sliceKey : "features.accordionFeature";
    }
    this._view = null;
    this._itemLoadState = /* @__PURE__ */ new Map();
  }
  async onReady() {
    if (!this._container) {
      return;
    }
    const url = this._container.dataset.url;
    if (url) {
      await this.loadData(url);
    } else {
      this.scanDomAndBuildView();
      this.syncAccordionUI();
    }
    if (this.signal.aborted) {
      return;
    }
    this.bindAccordionEvents();
  }
  onStateChange(slice) {
    if (slice?.view && this._view !== slice.view) {
      this._view = slice.view;
      void this.renderAccordion();
    }
  }
  async loadData(url) {
    const slice = this._store?.getSlice(this._sliceKey || "");
    const stateProxy = slice && typeof slice === "object" ? slice : null;
    const signal = this.getSignal("loadData");
    try {
      if (stateProxy) {
        this.setLoadingState(stateProxy, "Akkordeon-Inhalte werden geladen...");
      }
      const liveData = this.fetcher.get ? await this.fetcher.get(url, {}, { signal }) : null;
      if (signal.aborted) {
        return;
      }
      if (liveData && this._container) {
        const layout = this._container.dataset.layout || this._layout || "default";
        const singleOpen = this._container.dataset.singleOpen === "true";
        this._view = SchemaService.accordion(liveData, { layout, singleOpen });
        if (stateProxy) {
          stateProxy.view = this._view;
        }
        await this.renderAccordion();
      }
    } catch (error) {
      if (errorName(error) !== "AbortError" && !signal.aborted) {
        if (stateProxy) {
          stateProxy.error = errorMessage(error);
        }
        this._capture("loadData", error);
      }
    } finally {
      if (stateProxy && !signal.aborted) {
        stateProxy.isLoading = false;
      }
      this.clearTask("loadData");
    }
  }
  toggle(itemId) {
    if (!this._view || SchemaService.isLoader(this._view)) {
      return;
    }
    const toggledItem = SchemaService.toggleAccordionItem(this._view, itemId);
    if (!toggledItem) {
      return;
    }
    if (this._view.singleOpen) {
      this._view.items.forEach((item) => this.updateItemUI(item));
    } else {
      this.updateItemUI(toggledItem);
    }
    if (toggledItem.isOpen) {
      void this.ensureItemContent(toggledItem);
    }
    this._dispatcher?.emit?.("accordion:toggle", {
      id: toggledItem.id,
      isOpen: toggledItem.isOpen,
      item: toggledItem,
      container: this._container
    });
  }
  scanDomAndBuildView() {
    if (!this._container) {
      return;
    }
    const itemEls = this._container.querySelectorAll("[data-accordion-item]");
    const rawItems = [];
    itemEls.forEach((el) => {
      if (!(el instanceof HTMLElement)) {
        return;
      }
      const id = el.dataset.id || el.id;
      const triggerEl = el.querySelector('[data-target="trigger"]');
      const panelEl = el.querySelector('[data-target="panel"]');
      rawItems.push({
        id,
        title: triggerEl?.textContent?.trim() || "",
        content: panelEl ? panelEl.innerHTML : "",
        isOpen: el.classList.contains("is-open") || triggerEl?.getAttribute("aria-expanded") === "true",
        disabled: el.hasAttribute("data-disabled")
      });
    });
    const singleOpen = this._container.dataset.singleOpen === "true";
    const layout = this._container.dataset.layout || this._layout || "default";
    this._view = SchemaService.accordion(rawItems, { layout, singleOpen });
  }
  /** Setzt Panel-/Trigger-Zustand nach dem DOM-Scan (is-hidden, aria-expanded). */
  syncAccordionUI() {
    if (!this._view || SchemaService.isLoader(this._view) || !Array.isArray(this._view.items)) {
      return;
    }
    this._view.items.forEach((item) => this.updateItemUI(item));
  }
  bindAccordionEvents() {
    this.delegate("click", '[data-target="trigger"]', (_event, target) => {
      const itemEl = target.closest("[data-accordion-item]");
      const itemId = itemEl instanceof HTMLElement ? itemEl.dataset.id || itemEl.id : "";
      if (itemId) {
        this.toggle(itemId);
      }
    });
    this.delegate("keydown", '[data-target="trigger"]', (event) => {
      this.handleAccordionKeyDown(event);
    });
    this.delegate("click", '[data-target="retry"]', (event, target) => {
      event.preventDefault();
      const itemEl = target.closest("[data-accordion-item]");
      const itemId = itemEl instanceof HTMLElement ? itemEl.dataset.id || itemEl.id : "";
      const item = itemId && this._view ? SchemaService.accordionItem(this._view, itemId) : null;
      if (item) {
        this._itemLoadState?.delete(item.id);
        void this.ensureItemContent(item, true);
      }
    });
  }
  handleAccordionKeyDown(event) {
    if (!this._container) {
      return;
    }
    const triggers = Array.from(this._container.querySelectorAll('[data-target="trigger"]:not([disabled])')).filter((el) => el instanceof HTMLElement);
    if (triggers.length === 0) {
      return;
    }
    const current = document.activeElement;
    const currentIdx = current instanceof HTMLElement ? triggers.indexOf(current) : -1;
    if (currentIdx === -1) {
      return;
    }
    let nextIdx = currentIdx;
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        nextIdx = (currentIdx + 1) % triggers.length;
        triggers[nextIdx].focus();
        break;
      case "ArrowUp":
        event.preventDefault();
        nextIdx = (currentIdx - 1 + triggers.length) % triggers.length;
        triggers[nextIdx].focus();
        break;
      case "Home":
        event.preventDefault();
        triggers[0].focus();
        break;
      case "End":
        event.preventDefault();
        triggers[triggers.length - 1].focus();
        break;
      default:
        break;
    }
  }
  async ensureItemContent(item, force = false) {
    if (!item?.id || !this._container) {
      return;
    }
    const itemEl = this.itemElement(item.id);
    const url = itemEl instanceof HTMLElement ? itemEl.dataset.itemUrl : "";
    if (!url) {
      return;
    }
    const state = this._itemLoadState instanceof Map ? this._itemLoadState : new Map();
    this._itemLoadState = state;
    const current = state.get(item.id) || "idle";
    if (!force && (current === "loaded" || current === "loading")) {
      return;
    }
    const panelEl = itemEl?.querySelector('[data-target="panel"]');
    state.set(item.id, "loading");
    this.writePanel(panelEl, item, '<p class="accordion_loading">Wird geladen\u2026</p>');
    const signal = this.getSignal(`item:${item.id}`);
    try {
      const payload = this.fetcher.get ? await this.fetcher.get(url, {}, { signal }) : null;
      if (signal.aborted) {
        return;
      }
      const html = payload && typeof payload === "object" && typeof payload.html === "string"
        ? payload.html
        : "";
      if (!payload || payload.ok === false || html === "") {
        throw new Error("Nachladen lieferte keinen Inhalt.");
      }
      state.set(item.id, "loaded");
      this.writePanel(panelEl, item, html);
    } catch (error) {
      if (errorName(error) === "AbortError" || signal.aborted) {
        return;
      }
      state.set(item.id, "error");
      this.writePanel(
        panelEl,
        item,
        '<p class="accordion_load_error">Laden fehlgeschlagen.</p><button type="button" data-target="retry">Erneut versuchen</button>'
      );
      this._capture("ensureItemContent", error);
    } finally {
      this.clearTask(`item:${item.id}`);
    }
  }
  itemElement(itemId) {
    if (!this._container || !itemId) {
      return null;
    }
    return this._container.querySelector(`[data-accordion-item][data-id="${CSS.escape(itemId)}"]`)
      || this._container.querySelector(`#${CSS.escape(itemId)}`);
  }
  writePanel(panelEl, item, html) {
    item.content = html;
    if (panelEl instanceof HTMLElement) {
      panelEl.innerHTML = html;
    }
  }
  updateItemUI(item) {
    if (!this._container || !item?.id) {
      return;
    }
    const itemEl = this.itemElement(item.id);
    if (!itemEl) {
      return;
    }
    const triggerEl = itemEl.querySelector('[data-target="trigger"]');
    const panelEl = itemEl.querySelector('[data-target="panel"]');
    ControllerModifierDOM.toggleClass(itemEl, "is-open", Boolean(item.isOpen));
    if (triggerEl) {
      ControllerModifierDOM.attr(triggerEl, "aria-expanded", item.isOpen);
    }
    if (panelEl) {
      ControllerModifierDOM.toggleClass(panelEl, "is-hidden", !item.isOpen);
      ControllerModifierDOM.attr(panelEl, "aria-hidden", !item.isOpen);
    }
  }
  async renderAccordion() {
    if (!this._view || this.signal.aborted || !this._container) {
      return;
    }
    try {
      let templateName = this._container.dataset.template || "accordion";
      if (SchemaService.isLoader(this._view)) {
        templateName = this._container.dataset.loaderTemplate || "loader-spinner";
      }
      const renderService = this.renderService;
      if (renderService && typeof renderService.paste === "function") {
        await renderService.paste(this._container, templateName, SchemaService.toRenderData(this._view));
        if (!this.signal.aborted) {
          if (!SchemaService.isLoader(this._view)) {
            this.syncAccordionUI();
          }
          this._debugMsg("renderAccordion", `HTML f\xFCr '${this._sliceKey}' aktualisiert.`);
        }
      } else {
        this._warn("renderAccordion", "TemplateRenderService fehlt.");
      }
    } catch (error) {
      if (!this.signal.aborted) {
        this._capture("renderAccordion", error);
      }
    }
  }
}
export {
  ControllerAccordion
};
