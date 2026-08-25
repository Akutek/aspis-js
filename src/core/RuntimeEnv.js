class RuntimeEnv {
  static get window() {
    return typeof window !== "undefined" ? window : void 0;
  }
  static get document() {
    return typeof document !== "undefined" ? document : void 0;
  }
  static origin() {
    return this.window?.location?.origin || "";
  }
  static viewport() {
    const win = this.window;
    return {
      width: win?.innerWidth || 0,
      height: win?.innerHeight || 0
    };
  }
  static body() {
    return this.document?.body ?? null;
  }
  static documentElement() {
    const el = this.document?.documentElement;
    return el instanceof HTMLElement ? el : null;
  }
  static domPurify() {
    const win = this.window;
    const purify = /** @type {any} */ (win)?.DOMPurify;
    if (purify && typeof purify.sanitize === "function") {
      return purify;
    }
    return void 0;
  }
}
export {
  RuntimeEnv
};
