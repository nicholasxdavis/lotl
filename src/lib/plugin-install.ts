import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { emptyConfig, findProjectDir, readConfig, writeConfig } from "../config.ts";
import { lotlIconPath } from "./icon.ts";
import { pluginFolderDir, pluginRbxmxPath, pluginScriptPath, pluginsDir, repoRoot } from "../paths.ts";

export function installPlugin(cwd = findProjectDir()): { path: string; port: number; icon: string } {
  const config = readConfig(cwd) ?? emptyConfig(path.basename(cwd));
  if (!readConfig(cwd)) writeConfig(config, cwd);

  const sourcePath = path.join(repoRoot(), "plugin", "src", "Main.server.luau");
  const artPath = path.join(repoRoot(), ".cursor", "text.ini");
  const art = readFileSync(artPath, "utf8").replace(/\r\n/g, "\n").replace(/\s+$/g, "");
  if (art.includes("]=]")) {
    throw new Error("ASCII art cannot contain the Lua long-string closer");
  }
  let source = readFileSync(sourcePath, "utf8");
  source = source.replace("{{PORT}}", String(config.bridgePort));
  source = source.replace("{{TOKEN}}", config.token);
  source = source.replace("{{ART}}", art);

  mkdirSync(pluginsDir(), { recursive: true });
  const folder = pluginFolderDir();
  mkdirSync(folder, { recursive: true });
  writeFileSync(pluginScriptPath(), source, "utf8");

  const iconSrc = lotlIconPath();
  const iconDest = path.join(folder, "icon.png");
  copyFileSync(iconSrc, iconDest);

  if (existsSync(pluginRbxmxPath())) {
    rmSync(pluginRbxmxPath());
  }

  return { path: folder, port: config.bridgePort, icon: iconDest };
}
