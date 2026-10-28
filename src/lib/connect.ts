import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { lotlIconPath } from "./icon.ts";
import { officialStudioMcpCommand, repoRoot } from "../paths.ts";
import { renderCodexToml, upsertCodexMcp, vscodeMcpFile } from "./hosts.ts";

export type McpServerEntry = {
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  icon?: string;
};

export type McpFile = {
  mcpServers?: Record<string, McpServerEntry>;
};

export type HostWrite = {
  id: string;
  path: string;
  ok: boolean;
};

const USER_DUPLICATE_KEYS = ["lotl", "Roblox_Studio"] as const;

export function cursorMcpPath(cwd = process.cwd()): string {
  return path.join(cwd, ".cursor", "mcp.json");
}

export function userCursorMcpPath(): string {
  return path.join(os.homedir(), ".cursor", "mcp.json");
}

export function userClaudeMcpPath(): string {
  return path.join(os.homedir(), ".claude.json");
}

export function lotlMcpEntry(): {
  command: string;
  args: string[];
  cwd: string;
} {
  const root = repoRoot();
  return {
    command: process.execPath,
    args: [path.join(root, "node_modules", "tsx", "dist", "cli.mjs"), path.join(root, "src", "cli.ts"), "mcp"],
    cwd: root,
  };
}

export function mcpStdioServers(): Record<"lotl" | "Roblox_Studio", McpServerEntry> {
  const lotl = lotlMcpEntry();
  const studio = officialStudioMcpCommand();
  return {
    lotl: { command: lotl.command, args: lotl.args, cwd: lotl.cwd, icon: lotlIconPath() },
    Roblox_Studio: { command: studio.command, args: studio.args },
  };
}

function readMcp(file: string): McpFile {
  if (!existsSync(file)) return {};
  try {
    return JSON.parse(readFileSync(file, "utf8")) as McpFile;
  } catch {
    return {};
  }
}

export function writeMcp(file: string, data: McpFile): void {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function mergeProjectMcp(file: string, servers = mcpStdioServers()): string[] {
  const current = readMcp(file);
  current.mcpServers ??= {};
  for (const [name, entry] of Object.entries(servers)) {
    current.mcpServers[name] = entry;
  }
  writeMcp(file, current);
  return Object.keys(current.mcpServers);
}

export function userMcpDuplicateNames(file = userCursorMcpPath()): string[] {
  const servers = readMcp(file).mcpServers ?? {};
  return USER_DUPLICATE_KEYS.filter((key) => Boolean(servers[key]));
}

export function stripUserDuplicates(file: string): string[] {
  if (!existsSync(file)) return [];
  const current = readMcp(file);
  if (!current.mcpServers) return [];
  const removed = userMcpDuplicateNames(file);
  for (const key of removed) {
    delete current.mcpServers[key];
  }
  writeMcp(file, current);
  return removed;
}

export function syncAgentSkills(cwd = repoRoot()): string[] {
  const src = path.join(repoRoot(), "skills");
  if (!existsSync(src)) return [];
  const dests = [path.join(cwd, ".cursor", "skills"), path.join(cwd, ".agents", "skills")];
  const copied: string[] = [];
  for (const dest of dests) {
    mkdirSync(dest, { recursive: true });
    for (const name of readdirSync(src)) {
      const from = path.join(src, name, "SKILL.md");
      if (!existsSync(from)) continue;
      const toDir = path.join(dest, name);
      mkdirSync(toDir, { recursive: true });
      cpSync(from, path.join(toDir, "SKILL.md"));
      copied.push(path.relative(cwd, path.join(toDir, "SKILL.md")));
    }
  }
  return copied;
}

export function writeAgentHosts(cwd = process.cwd()): {
  path: string;
  userPath: string;
  servers: string[];
  removedUserServers: string[];
  files: HostWrite[];
  skills: string[];
} {
  const servers = mcpStdioServers();
  const files: HostWrite[] = [];

  const cursorFile = cursorMcpPath(cwd);
  mergeProjectMcp(cursorFile, servers);
  files.push({ id: "cursor", path: cursorFile, ok: true });

  const claudeFile = path.join(cwd, ".mcp.json");
  mergeProjectMcp(claudeFile, servers);
  files.push({ id: "claude-code", path: claudeFile, ok: true });

  const vscodeFilePath = path.join(cwd, ".vscode", "mcp.json");
  mkdirSync(path.dirname(vscodeFilePath), { recursive: true });
  let vscodeCurrent = vscodeMcpFile({});
  if (existsSync(vscodeFilePath)) {
    try {
      vscodeCurrent = JSON.parse(readFileSync(vscodeFilePath, "utf8")) as ReturnType<typeof vscodeMcpFile>;
      vscodeCurrent.servers ??= {};
    } catch {
      vscodeCurrent = vscodeMcpFile({});
    }
  }
  const vscodeNext = vscodeMcpFile(servers);
  vscodeCurrent.servers = { ...vscodeCurrent.servers, ...vscodeNext.servers };
  writeFileSync(vscodeFilePath, `${JSON.stringify(vscodeCurrent, null, 2)}\n`, "utf8");
  files.push({ id: "vscode", path: vscodeFilePath, ok: true });

  const codexFile = path.join(cwd, ".codex", "config.toml");
  mkdirSync(path.dirname(codexFile), { recursive: true });
  const previous = existsSync(codexFile) ? readFileSync(codexFile, "utf8") : "";
  writeFileSync(codexFile, upsertCodexMcp(previous, renderCodexToml(servers)), "utf8");
  files.push({ id: "codex", path: codexFile, ok: true });

  const removedUserServers = [
    ...stripUserDuplicates(userCursorMcpPath()),
    ...stripUserDuplicates(userClaudeMcpPath()),
  ];

  return {
    path: cursorFile,
    userPath: userCursorMcpPath(),
    servers: Object.keys(servers),
    removedUserServers: [...new Set(removedUserServers)],
    files,
    skills: syncAgentSkills(repoRoot()),
  };
}

export function writeCursorMcp(cwd = process.cwd()) {
  return writeAgentHosts(cwd);
}
