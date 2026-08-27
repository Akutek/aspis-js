/** Pure JSON-/Listenarbeit für Channel-Loopback und den Pipeline-Worker. Kein DOM, keine Registry. */
class PipelineWork {
  /**
   * @param {string} type
   * @param {unknown} payload
   * @returns {unknown}
   */
  static handle(type, payload) {
    if (type === "cmd:hydrate") {
      return this.hydrate(payload);
    }
    if (type === "cmd:plan-prep") {
      return this.sortItems(payload);
    }
    if (type === "cmd:compare-prep") {
      return this.comparePrep(payload);
    }
    return payload;
  }
  /**
   * @param {string} type
   * @returns {string}
   */
  static responseType(type) {
    if (type === "cmd:hydrate") {
      return "res:hydrate";
    }
    if (type === "cmd:plan-prep") {
      return "res:plan-prep";
    }
    if (type === "cmd:compare-prep") {
      return "res:compare-prep";
    }
    if (typeof type === "string" && type.startsWith("cmd:")) {
      return `res:${type.slice(4)}`;
    }
    return type;
  }
  /**
   * @param {unknown} payload
   * @returns {unknown}
   */
  static hydrate(payload) {
    if (typeof payload === "string") {
      const text = payload.trim();
      if (!text) {
        return {};
      }
      return this.sortValue(JSON.parse(text));
    }
    if (payload && typeof payload === "object") {
      return this.sortValue(payload);
    }
    return payload;
  }
  /**
   * @param {unknown} payload
   * @returns {unknown}
   */
  static sortItems(payload) {
    if (Array.isArray(payload)) {
      return payload.slice().sort((left, right) => this.#compareItem(left, right));
    }
    if (!payload || typeof payload !== "object") {
      return payload;
    }
    const bag = /** @type {{ items?: unknown }} */ (payload);
    if (!Array.isArray(bag.items)) {
      return payload;
    }
    return {
      ...bag,
      items: bag.items.slice().sort((left, right) => this.#compareItem(left, right))
    };
  }
  /**
   * Compare-Diff braucht Live-DOM (`element`) und bleibt auf Main.
   * Worker-Cmd ist No-Op: Payload unverändert durchreichen.
   * @param {unknown} payload
   * @returns {unknown}
   */
  static comparePrep(payload) {
    return payload;
  }
  /**
   * @param {unknown} value
   * @returns {unknown}
   */
  static sortValue(value) {
    if (Array.isArray(value)) {
      return value.map((item) => this.sortValue(item));
    }
    if (!value || typeof value !== "object") {
      return value;
    }
    const keys = Object.keys(value).sort();
    const out = {};
    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i];
      out[key] = this.sortValue(value[key]);
    }
    return out;
  }
  static #compareItem(left, right) {
    const typeA = left && typeof left.type === "string" ? left.type : "";
    const typeB = right && typeof right.type === "string" ? right.type : "";
    if (typeA !== typeB) {
      return typeA < typeB ? -1 : 1;
    }
    const idA = left && left.id != null ? String(left.id) : "";
    const idB = right && right.id != null ? String(right.id) : "";
    if (idA === idB) {
      return 0;
    }
    return idA < idB ? -1 : 1;
  }
}
export {
  PipelineWork
};
