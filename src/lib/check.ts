import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { findProjectDir } from "../config.ts";
import { which } from "../paths.ts";

export type CheckResult = {
  id: string;
  ok: boolean;
  skipped?: boolean;
  detail: string;
};

function run(bin: string, args: string[], cwd: string): CheckResult {
  const found = which(bin);
  if (!found) {
    return { id: bin, ok: true, skipped: true, detail: `${bin} not on PATH` };
  }
  const result = spawnSync(found, args, { cwd, encoding: "utf8" });
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim();
  const ok = result.status === 0;
  return {
    id: bin,
    ok,
    detail: output.slice(0, 4000) || (ok ? "passed" : `exit ${result.status}`),
  };
}

export function runChecks(cwd = findProjectDir()): { ok: boolean; checks: CheckResult[] } {
  const checks: CheckResult[] = [];
  const project = path.join(cwd, "default.project.json");
  if (!existsSync(project)) {
    return { ok: false, checks: [{ id: "project", ok: false, detail: "No default.project.json" }] };
  }

  mkdirSync(path.join(cwd, ".lotl-cache"), { recursive: true });
  if (which("argon")) {
    checks.push(run("argon", ["build", "--output", path.join(cwd, ".lotl-cache", "build.rbxl")], cwd));
  } else {
    checks.push(run("rojo", ["build", "-o", path.join(cwd, ".lotl-cache", "build.rbxl")], cwd));
  }
  checks.push(run("selene", ["src"], cwd));
  checks.push(run("stylua", ["--check", "src"], cwd));

  const ok = checks.every((c) => c.ok);
  return { ok, checks };
}
