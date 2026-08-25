/** @typedef {import("../types/controllers.js").FormHost} FormHost */
/** @extends {FormHost} */
class ControllerFormDropdownSync {
  bindFormDropdownSync() {
    if (!this._dispatcher || typeof this._dispatcher.on !== "function") {
      return;
    }
    this._dispatcher.on("dropdown:change", (data) => {
      const payload = data && typeof data === "object" ? data : {};
      if (payload.name && this._container && payload.container && this._container.contains(payload.container)) {
        this.updateField?.(payload.name, payload.value, true);
      }
    });
  }
}
export {
  ControllerFormDropdownSync
};
