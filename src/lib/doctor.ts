import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { apiKeyFromEnv, findProjectDir, readConfig } from "../config.ts";
import { cursorMcpPath, userCursorMcpPath, userMcpDuplicateNames } from "./connect.ts";
import {
  findStudioExe,
  findStudioMcpExe,
  officialStudioMcpCommand,
  pluginInstallPath,
  studioMcpBat,
  studioMcpMac,
  which,
} from "../paths.ts";
import { LOTL_VERSION } from "../version.ts";

export type Check = {
  id: string;
  ok: boolean;
  required: boolean;
  detail: string;
  path?: string | null;
};

function readMcpServers(file: string, label = "project .cursor/mcp.json"): { ok: boolean; detail: string } {
  if (!existsSync(file)) {
    return { ok: false, detail: `Run lotl connect (${label})` };
  }
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as {
      mcpServers?: Record<string, unknown>;
    };
    const servers = parsed.mcpServers ?? {};
    const hasLotl = Boolean(servers.lotl);
    const hasStudio = Boolean(servers.Roblox_Studio);
    if (hasLotl && hasStudio) {
      return { ok: true, detail: `${label} has lotl and Roblox_Studio` };
    }
    return {
      ok: false,
      detail: `missing ${[!hasLotl && "lotl", !hasStudio && "Roblox_Studio"].filter(Boolean).join(", ")}`,
    };
  } catch {
    return { ok: false, detail: `${label} is invalid JSON` };
  }
}

export function runDoctor(cwd = findProjectDir()): {
  ok: boolean;
  version: string;
  next: string[];
  checks: Check[];
} {
  const checks: Check[] = [];
  const add = (check: Check) => checks.push(check);

  add({
    id: "node",
    ok: true,
    required: true,
    detail: process.version,
  });

  const studio = findStudioExe();
  add({
    id: "studio",
    ok: Boolean(studio),
    required: true,
    detail: studio ? "Roblox Studio found" : "Install Roblox Studio and sign in",
    path: studio,
  });

  const mcpExe = findStudioMcpExe();
  const mcpFallback =
    process.platform === "win32" ? studioMcpBat() : studioMcpMac().find((p) => existsSync(p)) ?? studioMcpMac()[0];
  const mcpPath = mcpExe ?? mcpFallback;
  add({
    id: "studio-mcp-binary",
    ok: Boolean(mcpPath && existsSync(mcpPath)),
    required: true,
    detail: mcpExe
      ? "Official Studio MCP executable is installed"
      : existsSync(mcpFallback)
        ? "Official Studio MCP launcher is installed"
        : "Update Studio. The built-in MCP server ships as StudioMCP.exe / mcp.bat",
    path: mcpPath,
  });

  add({
    id: "studio-mcp-toggle",
    ok: true,
    required: false,
    detail:
      "Manual: Studio Assistant, then Manage MCP Servers, then Enable Studio as MCP server. Lotl cannot flip this switch.",
  });

  const plugin = pluginInstallPath();
  const pluginOk = existsSync(plugin);
  const pluginIcon = pluginOk && existsSync(path.join(plugin, "icon.png"));
  add({
    id: "lotl-plugin",
    ok: pluginOk,
    required: true,
    detail: pluginOk
      ? pluginIcon
        ? "Lotl folder plugin with axolotl icon"
        : "Lotl Studio plugin is installed"
      : "Run lotl plugin install",
    path: plugin,
  });

  const config = readConfig(cwd);
  add({
    id: "lotl-config",
    ok: Boolean(config),
    required: true,
    detail: config ? `sync=${config.sync} name=${config.name}` : "Run lotl init",
  });

  for (const tool of ["argon", "rojo", "selene", "stylua", "lune", "rbxcloud"] as const) {
    const found = which(tool);
    add({
      id: `tool-${tool}`,
      ok: Boolean(found),
      required: tool === "argon" || tool === "rojo" ? false : false,
      detail: found ? "on PATH" : `optional. Install with rokit add or from GitHub (${tool})`,
      path: found,
    });
  }

  const key = apiKeyFromEnv();
  add({
    id: "open-cloud-key",
    ok: Boolean(key),
    required: false,
    detail: key
      ? "API key present in the environment (value hidden)"
      : "Set ROBLOX_API_KEY for cloud, billing, and headless Luau",
  });

  const mcpFile = cursorMcpPath(process.cwd());
  const cursorHosts = readMcpServers(mcpFile);
  const mcpOk = cursorHosts.ok;
  add({
    id: "cursor-mcp",
    ok: mcpOk,
    required: true,
    detail: cursorHosts.detail,
    path: mcpFile,
  });

  const claudeFile = path.join(process.cwd(), ".mcp.json");
  const claudeHosts = readMcpServers(claudeFile, "project .mcp.json");
  add({
    id: "claude-mcp",
    ok: claudeHosts.ok,
    required: false,
    detail: claudeHosts.ok ? "Claude Code .mcp.json has lotl and Roblox_Studio" : "Run lotl connect for Claude Code",
    path: claudeFile,
  });

  const codexFile = path.join(process.cwd(), ".codex", "config.toml");
  const codexOk =
    existsSync(codexFile) &&
    /\[mcp_servers\.lotl\]/.test(readFileSync(codexFile, "utf8")) &&
    /\[mcp_servers\.Roblox_Studio\]/.test(readFileSync(codexFile, "utf8"));
  add({
    id: "codex-mcp",
    ok: codexOk,
    required: false,
    detail: codexOk ? "project .codex/config.toml has lotl and Roblox_Studio" : "Run lotl connect for Codex",
    path: codexFile,
  });

  const userMcp = userCursorMcpPath();
  const userDupes = userMcpDuplicateNames(userMcp);
  add({
    id: "user-cursor-mcp",
    ok: userDupes.length === 0,
    required: true,
    detail:
      userDupes.length > 0
        ? `Cursor is starting ${userDupes.join(" and ")} twice. Run lotl connect to remove them from ~/.cursor/mcp.json`
        : "user MCP file does not duplicate project lotl or Roblox_Studio",
    path: userMcp,
  });

  if (config) {
    add({
      id: "universe",
      ok: Boolean(config.universeId && config.placeId),
      required: false,
      detail:
        config.universeId && config.placeId
          ? `universe ${config.universeId} place ${config.placeId}`
          : "Fill universeId and placeId in lotl.json after you publish or open a place",
    });
  }

  const next: string[] = [];
  if (!studio) next.push("Install Roblox Studio from create.roblox.com");
  if (!existsSync(mcpPath)) next.push("Update Roblox Studio so the built-in MCP server is present");
  if (!existsSync(plugin)) next.push("Run: npm run lotl -- plugin install");
  if (!config) next.push("Run: npm run lotl -- init");
  if (!mcpOk) next.push("Run: npm run lotl -- connect");
  next.push("In Studio: Assistant → ... → Manage MCP Servers → Enable Studio as MCP server");
  next.push("In Studio: Quick connect Cursor (or run lotl connect)");
  if (!key) next.push("Create an Open Cloud API key and set ROBLOX_API_KEY");

  const requiredFailed = checks.some((c) => c.required && !c.ok && c.id !== "studio-mcp-toggle");
  return {
    ok: !requiredFailed,
    version: LOTL_VERSION,
    next,
    checks: [
      ...checks,
      {
        id: "official-mcp-command",
        ok: true,
        required: false,
        detail: JSON.stringify(officialStudioMcpCommand()),
      },
    ],
  };
}
