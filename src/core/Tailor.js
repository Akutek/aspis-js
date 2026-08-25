/** @typedef {import("../types/extensions.js").BaseExpansion} BaseExpansion */
/** @typedef {import("../types/factory.js").TailorContext} TailorContext */
import { TailorExtension } from "../extensions/tailor/TailorExtension.js";
class Tailor {
  extension;
  manifest;
  runtime;
  constructor() {
    this.extension = TailorExtension;
    this.manifest = {};
    this.runtime = null;
    TailorExtension.prepare(this);
  }
  strengthen(context) {
    return TailorExtension.strengthen(this, context);
  }
  expand(expansion = {}) {
    return TailorExtension.expand(this, expansion);
  }
}
export {
  Tailor
};
