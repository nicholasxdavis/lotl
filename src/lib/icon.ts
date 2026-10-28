import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { repoRoot } from "../paths.ts";

export function lotlIconPath(): string {
  const primary = path.join(repoRoot(), ".development", "icon.png");
  if (existsSync(primary)) return primary;
  return path.join(repoRoot(), "plugin", "icon.png");
}

export function lotlIconBuffer(): Buffer {
  const file = lotlIconPath();
  if (!existsSync(file)) {
    throw new Error("Lotl icon missing. Put icon.png in plugin/ or .development/");
  }
  return readFileSync(file);
}

export function lotlIconDataUri(): string {
  return `data:image/png;base64,${lotlIconBuffer().toString("base64")}`;
}

export function lotlMcpIcons(): { src: string; mimeType: string; sizes: string[] }[] {
  return [
    {
      src: lotlIconDataUri(),
      mimeType: "image/png",
      sizes: ["512x512"],
    },
  ];
}
