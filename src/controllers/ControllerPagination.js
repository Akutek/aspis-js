/** @typedef {import("../types/controllers.js").PaginationChunk} PaginationChunk */
import { RuntimeEnv } from "../core/RuntimeEnv.js";
import { errorMessage, errorName } from "./BaseController.js";

/**
 * Statische Chunk-/Seiten-Helfer plus Mixin: `[data-page]` lädt JSON-HTML
 * in `[data-target="page"]`. Cache liegt nach dem Mix auf der Instanz.
 */
class ControllerPagination {
  /**
   * @param {unknown} value
   * @returns {number}
   */
  static normalizePage(value) {
    const page = Number.parseInt(String(value ?? "1"), 10);
    return Number.isFinite(page) && page > 0 ? page : 1;
  }

  /**
   * @param {string} baseUrl
   * @param {Record<string, string | number | boolean | null | undefined>} params
   * @returns {string}
   */
  static withQuery(baseUrl, params = {}) {
    const urlObj = new URL(baseUrl, RuntimeEnv.origin());
    const keys = Object.keys(params);
    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i];
      const val = params[key];
      if (val === void 0 || val === null || val === "") {
        continue;
      }
      urlObj.searchParams.set(key, String(val));
    }
    return urlObj.toString();
  }

  /**
   * @param {unknown} payload
   * @returns {PaginationChunk | null}
   */
  static parseChunk(payload) {
    if (!payload || typeof payload !== "object") {
      return null;
    }
    const rec = /** @type {Record<string, unknown>} */ (payload);
    if (rec.ok === false) {
      return null;
    }
    const html = typeof rec.html === "string" ? rec.html : "";
    return {
      ok: rec.ok !== false,
      html,
      page: ControllerPagination.normalizePage(rec.page),
      total: Number(rec.total) || 0,
      totalPages: Number(rec.totalPages) || 1,
      perPage: Number(rec.perPage) || 0
    };
  }

  prepare() {
    if (!this._kind || this._kind === "BaseController") {
      this._kind = "ControllerPagination";
    }
    if (!this._pageChunks) {
      this._pageChunks = Object.create(null);
    }
  }

  async onReady() {
    if (!this._container) {
      return;
    }
    this.bindPager();
    if ((this._container.dataset.controller || "") === "table") {
      return;
    }
    const url = this._container.dataset.url;
    if (!url) {
      throw new Error(`${this._tag("onReady")} data-url fehlt an <${this._container.tagName.toLowerCase()}>.`);
    }
  }

  bindPager() {
    if (this._pagerBound) {
      return;
    }
    this._pagerBound = true;
    this.delegate("click", "[data-page]", (event, target) => {
      const page = target.dataset.page;
      if (!page) {
        return;
      }
      event.preventDefault();
      if ((this._container?.dataset?.controller || "") === "table" && typeof this.reload === "function") {
        this.reload({ page });
        return;
      }
      void this.goToPage(page);
    });
  }

  /**
   * @param {string | number} page
   * @returns {Promise<void>}
   */
  async goToPage(page) {
    const baseUrl = this._container?.dataset?.url;
    if (!baseUrl) {
      return;
    }
    const Mixed = this.constructor;
    const withQuery = typeof Mixed.withQuery === "function"
      ? Mixed.withQuery.bind(Mixed)
      : ControllerPagination.withQuery;
    const normalize = typeof Mixed.normalizePage === "function"
      ? Mixed.normalizePage.bind(Mixed)
      : ControllerPagination.normalizePage;
    const url = withQuery(baseUrl, { page: normalize(page) });
    await this.loadChunk(url);
  }

  /**
   * @param {string} url
   * @returns {Promise<void>}
   */
  async loadChunk(url) {
    if (!this._container) {
      return;
    }
    if (!this._pageChunks) {
      this._pageChunks = Object.create(null);
    }
    const cached = this._pageChunks[url];
    if (cached && typeof cached.html === "string") {
      this._pasteHtml(cached.html);
      return;
    }
    const signal = this.getSignal("loadChunk");
    try {
      const liveData = this.fetcher.get
        ? await this.fetcher.get(url, {}, {
          signal,
          headers: { Accept: "application/json" }
        })
        : null;
      if (signal.aborted) {
        return;
      }
      const chunk = ControllerPagination.parseChunk(liveData);
      if (!chunk || chunk.html === "") {
        throw new Error("Seite lieferte keinen Inhalt.");
      }
      this._pageChunks[url] = chunk;
      this._pasteHtml(chunk.html);
    } catch (error) {
      if (errorName(error) !== "AbortError" && !signal.aborted) {
        this._capture("loadChunk", error);
        this._warn("loadChunk", errorMessage(error) || "Chunk laden fehlgeschlagen.");
      }
    } finally {
      this.clearTask("loadChunk");
    }
  }

  onDestroy() {
    this._pageChunks = null;
    this._pagerBound = false;
  }

  /**
   * @param {string} html
   */
  _pasteHtml(html) {
    if (!this._container) {
      return;
    }
    const target = this._container.querySelector("[data-target='page']");
    const mount = target instanceof HTMLElement ? target : this._container;
    mount.innerHTML = html;
  }
}

export { ControllerPagination };
