import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
const cli = join(dirname(fileURLToPath(import.meta.url)), "..", "packages", "create-aspis-app", "bin", "create-aspis-app.js");
describe("create-aspis-app", () => {
  it("legt Vite-Template mit Paketnamen an", () => {
    const root = mkdtempSync(join(tmpdir(), "aspis-create-"));
    const target = join(root, "My App");
    const out = execFileSync(process.execPath, [cli, target], { encoding: "utf8" });
    expect(out).toContain("Aspis-App");
    const pkg = JSON.parse(readFileSync(join(target, "package.json"), "utf8"));
    expect(pkg.name).toBe("my-app");
    expect(pkg.dependencies["aspis-js"]).toBe("^1.0.0");
    expect(existsSync(join(target, "index.html"))).toBe(true);
    expect(existsSync(join(target, "src", "main.js"))).toBe(true);
    expect(existsSync(join(target, "vite.config.js"))).toBe(true);
    expect(existsSync(join(target, ".gitignore"))).toBe(true);
    expect(readFileSync(join(target, "src", "main.js"), "utf8")).toContain('from "aspis-js"');
  });
  it("bricht ab, wenn das Ziel nicht leer ist", () => {
    const root = mkdtempSync(join(tmpdir(), "aspis-create-"));
    const target = join(root, "busy");
    mkdirSync(target);
    writeFileSync(join(target, "keep.txt"), "x", "utf8");
    expect(() => {
      execFileSync(process.execPath, [cli, target], { encoding: "utf8" });
    }).toThrow();
  });
});
