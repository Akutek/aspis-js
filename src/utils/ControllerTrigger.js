const ALIASES = Object.freeze({
  customdropdown: "dropdown",
  "custom-dropdown": "dropdown",
  formsimple: "form-simple"
});
class ControllerTrigger {
  static get keys() {
    return Object.freeze([
      "table",
      "form",
      "form-simple",
      "accordion",
      "dropdown",
      "modal"
    ]);
  }
  static normalize(value) {
    if (typeof value !== "string") {
      return "";
    }
    let token = value.trim().toLowerCase().replace(/[\s_]+/g, "-");
    if (!token) {
      return "";
    }
    if (token.startsWith("controller-")) {
      token = token.slice("controller-".length);
    } else if (token.startsWith("controller") && !token.includes("-")) {
      token = token.slice("controller".length);
    }
    if (!token) {
      return "";
    }
    if (ALIASES[token]) {
      return ALIASES[token];
    }
    const compact = token.replace(/-/g, "");
    if (ALIASES[compact]) {
      return ALIASES[compact];
    }
    return token;
  }
}
export {
  ControllerTrigger
};
