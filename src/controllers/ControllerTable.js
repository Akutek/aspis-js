/** @typedef {import("../types/controllers.js").ControllerOptions} ControllerOptions */
/** @typedef {import("../types/controllers.js").LoaderLike} LoaderLike */
/** @typedef {import("../types/controllers.js").TableHost} TableHost */
/** @typedef {import("../types/schema.js").TableView} TableView */
import { SchemaService } from "../services/SchemaService.js";
import { RuntimeEnv } from "../core/RuntimeEnv.js";
import { errorMessage, errorName } from "./BaseController.js";
/** @extends {TableHost} */
class ControllerTable {
  prepare(options = {}) {
    this._kind = "ControllerTable";
    if (!this._sliceKey) {
      this._sliceKey = options.sliceKey || "features.gildeTable";
    }
    this._view = null;
  }
  async onReady() {
    if (!this._container) {
      return;
    }
    this.delegate("click", "th[data-sort-key]", (_event, target) => {
      const sortKey = target.dataset.sortKey;
      const currentOrder = target.dataset.sortOrder || "asc";
      const nextOrder = currentOrder === "asc" ? "desc" : "asc";
      this.reload({ sort: sortKey, order: nextOrder });
    });
    this.delegate("click", "[data-action]", (_event, target) => {
      const action = target.dataset.action;
      const row = target.closest("[data-row-id]");
      const rowId = row instanceof HTMLElement ? row.dataset.rowId : void 0;
      if (action && rowId) {
        this._dispatcher?.emit?.(`table:${action}`, { id: rowId, action, target });
      }
    });
    this.delegate("click", "[data-page]", (_event, target) => {
      const page = target.dataset.page;
      if (page) {
        this.reload({ page });
      }
    });
    const url = this._container.dataset.url;
    if (!url) {
      throw new Error(`${this._tag("onReady")} data-url fehlt an <${this._container.tagName.toLowerCase()}>.`);
    }
    await this.loadData(url);
  }
  onStateChange(slice) {
    if (slice?.view && this._view !== slice.view) {
      this._view = slice.view;
      void this.renderTable();
    }
  }
  async loadData(url) {
    const slice = this._store?.getSlice(this._sliceKey || "");
    const stateProxy = slice && typeof slice === "object" ? slice : null;
    if (!stateProxy || !this.fetcher.get) {
      return;
    }
    const signal = this.getSignal("loadData");
    try {
      this.setLoadingState(stateProxy, "Tabelle wird geladen...");
      const liveData = await this.fetcher.get(url, {}, { signal });
      if (signal.aborted) {
        return;
      }
      if (liveData && this._container) {
        const layout = this._container.dataset.layout || this._layout || "default";
        stateProxy.view = SchemaService.table(liveData, { layout });
      }
    } catch (error) {
      if (errorName(error) !== "AbortError" && !signal.aborted) {
        stateProxy.error = errorMessage(error);
        this._capture("loadData", error);
      }
    } finally {
      if (stateProxy && !signal.aborted) {
        stateProxy.isLoading = false;
      }
      this.clearTask("loadData");
    }
  }
  reload(filterPayload = {}) {
    const baseUrl = this._container?.dataset?.url;
    if (!baseUrl) {
      return;
    }
    try {
      const urlObj = new URL(baseUrl, RuntimeEnv.origin());
      const keys = Object.keys(filterPayload);
      for (let i = 0; i < keys.length; i += 1) {
        const key = keys[i];
        const val = filterPayload[key];
        if (val !== void 0 && val !== null && val !== "") {
          urlObj.searchParams.set(key, String(val));
        }
      }
      void this.loadData(urlObj.toString());
    } catch (error) {
      this._capture("reload", error);
    }
  }
  async renderTable() {
    if (!this._view || this.signal.aborted || !this._container) {
      return;
    }
    try {
      if (SchemaService.isLoader(this._view)) {
        const templateName2 = this._container.dataset.loaderTemplate || "loader-spinner";
        const renderService2 = this.renderService;
        if (renderService2 && typeof renderService2.paste === "function") {
          await renderService2.paste(
            this._container,
            templateName2,
            SchemaService.toRenderData(this._view)
          );
        }
        return;
      }
      const templateName = this._container.dataset.template || "table";
      const renderService = this.renderService;
      const renderData = SchemaService.toRenderData(this._view);
      if (renderService && typeof renderService.paste === "function") {
        await renderService.paste(this._container, templateName, renderData);
        if (!this.signal.aborted) {
          this._debugMsg("renderTable", `HTML f\xFCr '${this._sliceKey}' eingef\xFCgt.`);
        }
        return;
      }
      const rows = Array.isArray(this._view.rows) ? this._view.rows : [];
      let body = this._container.querySelector("[data-target='table-body']");
      if (!body) {
        this._container.replaceChildren();
        const table = document.createElement("table");
        table.innerHTML = '<thead><tr><th data-sort-key="name">Name</th><th data-sort-key="status">Status</th></tr></thead><tbody data-target="table-body"></tbody>';
        this._container.appendChild(table);
        body = this._container.querySelector("[data-target='table-body']");
      }
      if (!body) {
        return;
      }
      const fragment = document.createDocumentFragment();
      for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i] || {};
        const tr = document.createElement("tr");
        if (row.id != null) {
          tr.dataset.rowId = String(row.id);
        }
        const tdName = document.createElement("td");
        tdName.textContent = row.name != null ? String(row.name) : "";
        const tdStatus = document.createElement("td");
        tdStatus.textContent = row.status != null ? String(row.status) : "";
        tr.append(tdName, tdStatus);
        fragment.appendChild(tr);
      }
      body.replaceChildren(fragment);
      if (!this.signal.aborted) {
        this._debugMsg("renderTable", `DOM-Fallback f\xFCr '${this._sliceKey}'.`);
      }
    } catch (error) {
      if (!this.signal.aborted) {
        this._capture("renderTable", error);
      }
    }
  }
}
export {
  ControllerTable
};
