import { asRecord } from "./asRecord.js";
function normalizePipelines(raw) {
  if (Array.isArray(raw)) {
    return raw.map((entry) => asRecord(entry));
  }
  if (raw && typeof raw === "object") {
    return Object.entries(asRecord(raw)).map(([id, route]) => ({
      id,
      ...asRecord(route)
    }));
  }
  return [];
}
export {
  normalizePipelines
};
