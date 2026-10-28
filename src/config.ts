import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DEFAULT_BRIDGE_PORT } from "./version.ts";

export type SyncKind = "argon" | "rojo" | "script-sync";

export type LotlConfig = {
  name: string;
  sync: SyncKind;
  universeId: string;
  placeId: string;
  bridgePort: number;
  token: string;
};

export const CONFIG_NAME = "lotl.json";

export function emptyConfig(name = "place"): LotlConfig {
  return {
    name,
    sync: "argon",
    universeId: "",
    placeId: "",
    bridgePort: DEFAULT_BRIDGE_PORT,
    token: randomToken(),
  };
}

export function configPath(cwd = process.cwd()): string {
  return path.join(cwd, CONFIG_NAME);
}

export function readConfig(cwd = process.cwd()): LotlConfig | null {
  const file = configPath(cwd);
  if (!existsSync(file)) return null;
  const raw = JSON.parse(readFileSync(file, "utf8")) as Partial<LotlConfig>;
  return {
    ...emptyConfig(raw.name ?? path.basename(cwd)),
    ...raw,
    bridgePort: Number(raw.bridgePort ?? DEFAULT_BRIDGE_PORT),
  };
}

export function writeConfig(config: LotlConfig, cwd = process.cwd()): string {
  const file = configPath(cwd);
  const copy = { ...config };
  writeFileSync(file, `${JSON.stringify(copy, null, 2)}\n`, "utf8");
  return file;
}

export function findProjectDir(cwd = process.cwd()): string {
  if (existsSync(configPath(cwd))) return cwd;
  const nested = path.join(cwd, "place");
  if (existsSync(configPath(nested))) return nested;
  return cwd;
}

export function requireConfig(cwd = findProjectDir()): LotlConfig {
  const config = readConfig(cwd);
  if (!config) {
    throw new Error(`No ${CONFIG_NAME} here. Run lotl init or lotl setup first.`);
  }
  return config;
}

export function randomToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64url");
}

export function apiKeyFromEnv(): string | null {
  return (
    process.env.LOTL_API_KEY ||
    process.env.ROBLOX_API_KEY ||
    process.env.RBXCLOUD_API_KEY ||
    null
  );
}
