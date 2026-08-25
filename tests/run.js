import { lifecycle, pressure } from "./suite.js";

const stage = document.getElementById("stage");
const log = document.getElementById("log");
const pressureBtn = document.getElementById("pressure-1000");

/**
 * @param {string} title
 * @param {"ok"|"fail"|"info"} tone
 * @param {string} [detail]
 */
function row(title, tone, detail) {
  const li = document.createElement("li");
  li.dataset.tone = tone;
  li.textContent = detail ? `${title} — ${detail}` : title;
  log.append(li);
}

/**
 * @param {HTMLElement} root
 */
async function run(root) {
  log.replaceChildren();
  try {
    const steps = await lifecycle(root);
    row("Lifecycle", "ok", `${steps.length} Schritte`);
    for (let i = 0; i < steps.length; i += 1) {
      row(steps[i].name, "ok", steps[i].detail);
    }
  } catch (error) {
    row("Lifecycle", "fail", error instanceof Error ? error.message : String(error));
    return;
  }
  const sizes = [10, 100];
  for (let i = 0; i < sizes.length; i += 1) {
    const n = sizes[i];
    try {
      const r = await pressure(root, n);
      row(
        `Druck n=${r.n}`,
        "ok",
        `start ${r.startup}ms (add ${r.first.add}) · keep ${r.keep}ms (keep ${r.afterKeep.keep}) · +1 ${r.add1}ms · churn +10 ${r.churnAdd}ms / −10 ${r.churnRemove}ms`
      );
    } catch (error) {
      row(`Druck n=${n}`, "fail", error instanceof Error ? error.message : String(error));
    }
  }
}

if (stage instanceof HTMLElement && log) {
  void run(stage);
  pressureBtn?.addEventListener("click", () => {
    void (async () => {
      try {
        const r = await pressure(stage, 1000);
        row(
          `Druck n=${r.n}`,
          "ok",
          `start ${r.startup}ms (add ${r.first.add}) · keep ${r.keep}ms (keep ${r.afterKeep.keep}) · +1 ${r.add1}ms · churn +10 ${r.churnAdd}ms / −10 ${r.churnRemove}ms`
        );
      } catch (error) {
        row("Druck n=1000", "fail", error instanceof Error ? error.message : String(error));
      }
    })();
  });
}
