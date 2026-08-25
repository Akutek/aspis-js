function normalizeStringList(raw) {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter((item) => typeof item === "string" && item.trim() !== "").map((item) => item.trim());
}
export {
  normalizeStringList
};
