/** @typedef {import("../types/extensions.js").BaseExpansion} BaseExpansion */
/** @typedef {import("../types/extensions.js").ExtensionHost} ExtensionHost */
/** @typedef {import("../types/extensions.js").PipelineHandle} PipelineHandle */
function runtimeBag(host) {
  if (!host?.runtime || typeof host.runtime !== "object") {
    return null;
  }
  return host.runtime;
}
function hasHandle(value) {
  return Boolean(value) && typeof value === "object" && typeof value.handle === "function";
}
function hasInstall(value) {
  return Boolean(value) && typeof value === "object" && typeof value.install === "function";
}
function asRecord(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value;
  }
  return {};
}
class BaseExtension {
  /** Name des Pipeline-Arrays auf `host.runtime`. */
  static get pipelineKey() {
    return "pipeline";
  }
  /** Legt `runtime` und die Pipeline-Liste an, falls sie fehlen. */
  static prepare(host, seed = {}) {
    if (!host) return this;
    if (!host.runtime || typeof host.runtime !== "object") {
      host.runtime = {};
    }
    const runtime = runtimeBag(host);
    if (!runtime) return this;
    if (!Array.isArray(runtime[this.pipelineKey])) {
      runtime[this.pipelineKey] = [];
    }
    if (seed && typeof seed === "object") {
      Object.keys(seed).forEach((key) => {
        if (key === this.pipelineKey && Array.isArray(runtime[key])) return;
        runtime[key] = seed[key];
      });
    }
    if (host.extension == null) {
      host.extension = this;
    }
    return this;
  }
  /** Setzt das Manifest am Host. Kindklassen werten es aus. */
  static apply(host, manifest = {}) {
    if (!host) return this;
    if (!host.runtime) this.prepare(host);
    host.manifest = manifest || {};
    return this;
  }
  /** Flaches Manifest-Merge. Kindklassen überschreiben für strukturiertes Pfropfen. */
  static graft(host, extraManifest = {}) {
    if (!host) return this;
    host.manifest = { ...asRecord(host.manifest), ...asRecord(extraManifest) };
    return this;
  }
  /** Hängt Middleware oder ein Objekt mit `handle` an die Host-Pipeline. */
  static use(host, middleware) {
    if (!host) return this;
    if (!host.runtime) this.prepare(host);
    const runtime = runtimeBag(host);
    const pipe = runtime?.[this.pipelineKey];
    if (!Array.isArray(pipe)) return this;
    if (typeof middleware === "function") {
      pipe.push(middleware);
      return this;
    }
    if (hasHandle(middleware)) {
      pipe.push(middleware);
    }
    return this;
  }
  static steps(host) {
    const runtime = runtimeBag(host);
    const pipe = runtime?.[this.pipelineKey];
    return Array.isArray(pipe) ? pipe : [];
  }
  static install(host, plugin) {
    if (hasInstall(plugin)) {
      return Promise.resolve(plugin.install(host, this)).then(() => this);
    }
    if (typeof plugin === "function" || hasHandle(plugin)) {
      this.use(host, plugin);
    }
    return this;
  }
  static async load(host, loader) {
    if (typeof loader !== "function") return this;
    const plugin = await loader();
    const module = plugin && typeof plugin === "object" && "default" in plugin ? plugin.default : plugin;
    await this.install(host, module);
    return this;
  }
  /** Baut den Host weiter aus: Manifest pfropfen, Middleware, Plugin, dynamischer Load. */
  static expand(host, expansion = {}) {
    if (!host) return this;
    if (!host.runtime) this.prepare(host);
    if (expansion.manifest) {
      this.graft(host, expansion.manifest);
    }
    const middlewares = Array.isArray(expansion.middleware) ? expansion.middleware : expansion.middleware ? [expansion.middleware] : [];
    middlewares.forEach((middleware) => this.use(host, middleware));
    const steps = [];
    if (expansion.plugin) {
      const plugin = expansion.plugin;
      steps.push(() => this.install(host, plugin));
    }
    if (typeof expansion.load === "function") {
      const load = expansion.load;
      steps.push(() => this.load(host, load));
    }
    if (steps.length === 0) return this;
    return steps.reduce(
      (chain, step) => chain.then(step),
      Promise.resolve(this)
    ).then(() => this);
  }
}
export {
  BaseExtension
};
