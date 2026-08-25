import { PLAN_NEEDS } from "../../types/managers.js";
const allowed = new Set(PLAN_NEEDS);
function assertPlanNeeds(needs, hydratorName) {
  const normalized = [];
  for (let i = 0; i < needs.length; i += 1) {
    const raw = needs[i];
    const tag = typeof raw === "string" ? raw.trim().toLowerCase() : "";
    if (!tag) {
      throw new Error(`Aspis [${hydratorName}]: leeres need.`);
    }
    if (!allowed.has(tag)) {
      throw new Error(
        `Aspis [${hydratorName}]: unbekanntes need '${raw}'. Erlaubt: ${PLAN_NEEDS.join(", ")}.`
      );
    }
    normalized.push(tag);
  }
  return normalized;
}
export {
  assertPlanNeeds
};
