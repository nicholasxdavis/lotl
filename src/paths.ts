import { existsSync, readdirSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function repoRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
}

export function homeDir(): string {
  return os.homedir();
}

export function localAppData(): string {
  return process.env.LOCALAPPDATA || path.join(homeDir(), "AppData", "Local");
}

export function studioMcpBat(): string {
  return path.join(localAppData(), "Roblox", "mcp.bat");
}

export function studioMcpMac(): string[] {
  return [
    "/Applications/RobloxStudio.app/Contents/MacOS/StudioMCP",
    path.join(homeDir(), "Applications", "RobloxStudio.app", "Contents", "MacOS", "StudioMCP"),
  ];
}

export function pluginsDir(): string {
  if (process.platform === "darwin") {
    return path.join(homeDir(), "Documents", "Roblox", "Plugins");
  }
  return path.join(localAppData(), "Roblox", "Plugins");
}

export function pluginFolderDir(): string {
  return path.join(pluginsDir(), "Lotl");
}

export function pluginScriptPath(): string {
  return path.join(pluginFolderDir(), "Lotl.server.lua");
}

export function pluginRbxmxPath(): string {
  return path.join(pluginsDir(), "Lotl.rbxmx");
}

export function pluginInstallPath(): string {
  if (existsSync(pluginScriptPath())) return pluginFolderDir();
  return pluginRbxmxPath();
}

export function findStudioExe(): string | null {
  if (process.platform === "darwin") {
    for (const candidate of [
      "/Applications/RobloxStudio.app/Contents/MacOS/RobloxStudio",
      path.join(homeDir(), "Applications", "RobloxStudio.app", "Contents", "MacOS", "RobloxStudio"),
    ]) {
      if (existsSync(candidate)) return candidate;
    }
    return null;
  }

  const versions = path.join(localAppData(), "Roblox", "Versions");
  if (!existsSync(versions)) return null;
  const names = readdirSync(versions);
  let newest: { mtime: number; file: string } | null = null;
  for (const name of names) {
    const exe = path.join(versions, name, "RobloxStudioBeta.exe");
    if (!existsSync(exe)) continue;
    const mtime = statSync(exe).mtimeMs;
    if (!newest || mtime > newest.mtime) newest = { mtime, file: exe };
  }
  return newest?.file ?? null;
}

export function findStudioMcpExe(): string | null {
  if (process.platform === "darwin") {
    return studioMcpMac().find((p) => existsSync(p)) ?? null;
  }
  const studio = findStudioExe();
  if (!studio) return null;
  const exe = path.join(path.dirname(studio), "StudioMCP.exe");
  return existsSync(exe) ? exe : null;
}

export function officialStudioMcpCommand(): { command: string; args: string[] } {
  const exe = findStudioMcpExe();
  if (exe) return { command: exe, args: [] };
  if (process.platform === "win32") {
    return { command: studioMcpBat(), args: [] };
  }
  return {
    command: "/Applications/RobloxStudio.app/Contents/MacOS/StudioMCP",
    args: [],
  };
}

export function which(bin: string): string | null {
  const pathEnv = process.env.PATH ?? "";
  const ext = process.platform === "win32" ? [".exe", ".cmd", ".bat", ""] : [""];
  for (const dir of pathEnv.split(path.delimiter)) {
    for (const suffix of ext) {
      const candidate = path.join(dir, bin + suffix);
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
}

export function cacheDir(): string {
  return path.join(homeDir(), ".lotl");
}
