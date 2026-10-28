import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { findProjectDir, readConfig } from "../src/config.ts";
import { lotlMcpEntry } from "../src/lib/connect.ts";
import { runDoctor } from "../src/lib/doctor.ts";
import { officialStudioMcpCommand } from "../src/paths.ts";

test("finds the place project from the repo root", () => {
  const dir = findProjectDir();
  const config = readConfig(dir);
  assert.ok(config, "lotl.json should exist under place/");
  assert.equal(config?.sync, "argon");
  assert.ok(config?.token);
});

test("doctor reports required local pieces", () => {
  const report = runDoctor();
  const ids = report.checks.map((c) => c.id);
  for (const id of ["node", "studio", "studio-mcp-binary", "lotl-plugin", "cursor-mcp"]) {
    assert.ok(ids.includes(id), `missing check ${id}`);
  }
  const plugin = report.checks.find((c) => c.id === "lotl-plugin");
  assert.equal(plugin?.ok, true);
});

test("lotl MCP entry uses node plus tsx with absolute paths", () => {
  const entry = lotlMcpEntry();
  assert.notEqual(path.basename(entry.command).toLowerCase(), "npm");
  assert.equal(entry.args.at(-1), "mcp");
  assert.ok(entry.args.slice(0, -1).every((arg) => path.isAbsolute(arg)));
});

test("official Studio MCP launches the exe, not cmd /c mcp.bat", () => {
  const cmd = officialStudioMcpCommand();
  assert.notEqual(path.basename(cmd.command).toLowerCase(), "cmd.exe");
  assert.equal(cmd.args.length, 0);
});
