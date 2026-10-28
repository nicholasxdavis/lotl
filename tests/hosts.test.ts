import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { readFileSync as readRepo } from "node:fs";
import { fileURLToPath } from "node:url";
import { writeAgentHosts } from "../src/lib/connect.ts";
import { renderCodexToml, upsertCodexMcp, vscodeMcpFile } from "../src/lib/hosts.ts";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

test("Codex toml round-trips command, args, and cwd", () => {
  const toml = renderCodexToml({
    lotl: { command: "C:\\node.exe", args: ["a", "b", "mcp"], cwd: "C:\\proj" },
    Roblox_Studio: { command: "C:\\StudioMCP.exe", args: [] },
  });
  assert.match(toml, /\[mcp_servers\.lotl\]/);
  assert.match(toml, /\[mcp_servers\.Roblox_Studio\]/);
  assert.match(toml, /cli\.ts|mcp/);
  assert.match(toml, /StudioMCP\.exe/);
  const merged = upsertCodexMcp("# keep me\nmodel = \"gpt\"\n\n[mcp_servers.lotl]\ncommand = \"old\"\n", toml);
  assert.match(merged, /keep me/);
  assert.equal((merged.match(/\[mcp_servers\.lotl\]/g) ?? []).length, 1);
});

test("VS Code mcp.json uses stdio servers", () => {
  const file = vscodeMcpFile({
    lotl: { command: "node", args: ["mcp"], cwd: "/repo" },
  });
  assert.equal(file.servers.lotl.type, "stdio");
  assert.equal(file.servers.lotl.command, "node");
});

test("writeAgentHosts writes Cursor, Claude Code, Codex, and VS Code configs", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "lotl-hosts-"));
  const result = writeAgentHosts(dir);
  const ids = result.files.map((file) => file.id);
  assert.deepEqual(ids.sort(), ["claude-code", "codex", "cursor", "vscode"].sort());
  const cursor = JSON.parse(readFileSync(path.join(dir, ".cursor", "mcp.json"), "utf8"));
  const claude = JSON.parse(readFileSync(path.join(dir, ".mcp.json"), "utf8"));
  assert.ok(cursor.mcpServers.lotl);
  assert.ok(cursor.mcpServers.lotl.icon);
  assert.match(cursor.mcpServers.lotl.icon, /icon\.png$/);
  assert.ok(cursor.mcpServers.Roblox_Studio);
  assert.ok(claude.mcpServers.lotl);
  assert.ok(claude.mcpServers.Roblox_Studio);
  const vscode = JSON.parse(readFileSync(path.join(dir, ".vscode", "mcp.json"), "utf8"));
  assert.equal(vscode.servers.lotl.type, "stdio");
  const codex = readFileSync(path.join(dir, ".codex", "config.toml"), "utf8");
  assert.match(codex, /\[mcp_servers\.lotl\]/);
  assert.match(codex, /\[mcp_servers\.Roblox_Studio\]/);
});

test("AGENTS.md and SKILL.md teach setup, transform, marketplace, and Computer Use last", () => {
  const agents = readRepo(path.join(root, "AGENTS.md"), "utf8");
  const skill = readRepo(path.join(root, "skills", "lotl", "SKILL.md"), "utf8");
  for (const text of [agents, skill]) {
    assert.match(text, /lotl -- setup|lotl_ready/);
    assert.match(text, /Claude Code/);
    assert.match(text, /Codex/);
    assert.match(text, /transform/);
    assert.match(text, /insert_asset/);
    assert.match(text, /Computer Use/);
    assert.match(text, /last resort/i);
  }
});
