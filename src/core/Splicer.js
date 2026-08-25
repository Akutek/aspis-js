/** @typedef {import("../types/extensions.js").BaseExpansion} BaseExpansion */
/** @typedef {import("../types/managers.js").FactoryPrep} FactoryPrep */
import { SplicerExtension } from "../extensions/splicer/SplicerExtension.js";
class Splicer {
  extension;
  manifest;
  runtime;
  constructor() {
    this.extension = SplicerExtension;
    this.manifest = {};
    this.runtime = null;
    SplicerExtension.prepare(this);
  }
  splice(parts, history = {}) {
    return SplicerExtension.splice(this, parts, history);
  }
  expand(expansion = {}) {
    return SplicerExtension.expand(this, expansion);
  }
}
export {
  Splicer
};
