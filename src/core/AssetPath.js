let configuredRoot = null;
class AssetPath {
  static get root() {
    if (configuredRoot) {
      return configuredRoot;
    }
    const href = new URL("../", import.meta.url).href;
    return href.endsWith("/") ? href : `${href}/`;
  }
  /** Setzt den Asset-Root (z. B. CDN oder Subpath aus app-config). */
  static configure(baseUrl) {
    if (baseUrl == null || baseUrl === "") {
      configuredRoot = null;
      return;
    }
    const href = String(baseUrl).trim();
    configuredRoot = new URL(href.endsWith("/") ? href : `${href}/`).href;
  }
  static resolve(path) {
    if (path == null || path === "") {
      return this.root;
    }
    const raw = String(path).trim();
    if (/^[a-zA-Z][a-zA-Z+\-.]*:/.test(raw)) {
      return raw;
    }
    let rel = raw.replace(/\\/g, "/");
    while (rel.startsWith("/")) {
      rel = rel.slice(1);
    }
    if (rel.startsWith("src/")) {
      rel = rel.slice(4);
    }
    return new URL(rel, this.root).href;
  }
  static join(directory, file) {
    const dir = String(directory || "").trim().replace(/\/+$/, "");
    const name = String(file || "").trim().replace(/^\/+/, "");
    if (!dir && !name) {
      return "";
    }
    if (!dir) {
      return this.resolve(name);
    }
    if (!name) {
      return this.resolve(dir);
    }
    if (/^[a-zA-Z][a-zA-Z+\-.]*:/.test(dir)) {
      const base = dir.endsWith("/") ? dir : `${dir}/`;
      return new URL(name, base).href;
    }
    return this.resolve(`${dir}/${name}`);
  }
}
export {
  AssetPath
};
