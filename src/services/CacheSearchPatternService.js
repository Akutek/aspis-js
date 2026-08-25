class CacheSearchPatternService {
  /** Erstellt ein strukturiertes Suchmuster für komplexe Abfragen. */
  static createPattern(criteriaMap = {}) {
    if (!criteriaMap || typeof criteriaMap !== "object") {
      return {};
    }
    return { ...criteriaMap };
  }
  /** Prüft iterativ, ob ein gespeichertes Zielobjekt dem definierten Suchmuster entspricht. */
  static matches(storedObject, pattern) {
    if (!storedObject || typeof storedObject !== "object") return false;
    if (!pattern || typeof pattern !== "object") return false;
    const stack = [{ obj: storedObject, crit: pattern }];
    while (stack.length > 0) {
      const frame = stack.pop();
      if (!frame) {
        continue;
      }
      const { obj, crit } = frame;
      for (const [criteriaKey, criteriaValue] of Object.entries(crit)) {
        const actualValue = obj[criteriaKey];
        if (actualValue === void 0) return false;
        if (Array.isArray(criteriaValue)) {
          if (!criteriaValue.includes(actualValue)) return false;
        } else if (criteriaValue !== null && typeof criteriaValue === "object") {
          if (actualValue === null || typeof actualValue !== "object") return false;
          stack.push({ obj: actualValue, crit: criteriaValue });
        } else {
          if (actualValue !== criteriaValue) return false;
        }
      }
    }
    return true;
  }
  /** Schüttelt ein Suchmuster auf und gibt eine flache Liste aller Suchpfade und Bedingungen zurück. */
  static parsePattern(pattern, prefix = "") {
    let result = {};
    if (!pattern || typeof pattern !== "object") return result;
    for (const [key, value] of Object.entries(pattern)) {
      const currentPath = prefix ? `${prefix}.${key}` : key;
      if (value !== null && typeof value === "object" && !Array.isArray(value)) {
        Object.assign(result, this.parsePattern(value, currentPath));
      } else {
        result[currentPath] = value;
      }
    }
    return result;
  }
}
export {
  CacheSearchPatternService
};
