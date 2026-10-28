import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { cacheDir } from "../paths.ts";
import { ENGINE_DUMP_URL } from "../version.ts";

type DumpClass = {
  Name: string;
  Superclass?: string;
  MemoryCategory?: string;
  Members?: Array<{
    MemberType: string;
    Name: string;
    ValueType?: { Name?: string };
    ReturnType?: { Name?: string };
    Parameters?: Array<{ Name: string; Type?: { Name?: string } }>;
    Tags?: string[];
    Security?: string | { Read?: string; Write?: string };
  }>;
  Tags?: string[];
};

type MiniDump = {
  Classes?: DumpClass[];
  Enums?: Array<{ Name: string; Items?: Array<{ Name: string; Value?: number }> }>;
};

let memory: MiniDump | null = null;

export async function loadDump(force = false): Promise<MiniDump> {
  if (memory && !force) return memory;
  const dir = cacheDir();
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "Mini-API-Dump.json");
  const stale = !existsSync(file) || Date.now() - statSync(file).mtimeMs > 24 * 60 * 60 * 1000;

  if (force || stale) {
    const res = await fetch(ENGINE_DUMP_URL);
    if (!res.ok) throw new Error(`Failed to fetch engine dump (${res.status})`);
    writeFileSync(file, await res.text(), "utf8");
  }

  memory = JSON.parse(readFileSync(file, "utf8")) as MiniDump;
  return memory;
}

export async function lookupClass(name: string): Promise<unknown> {
  const dump = await loadDump();
  const needle = name.toLowerCase();
  const match = dump.Classes?.find((c) => c.Name.toLowerCase() === needle);
  if (!match) {
    const suggestions =
      dump.Classes?.filter((c) => c.Name.toLowerCase().includes(needle)).slice(0, 12).map((c) => c.Name) ?? [];
    return { found: false, query: name, suggestions };
  }

  const members = (match.Members ?? []).map((m) => ({
    kind: m.MemberType,
    name: m.Name,
    type: m.ValueType?.Name ?? m.ReturnType?.Name ?? null,
    parameters: m.Parameters?.map((p) => `${p.Name}: ${p.Type?.Name ?? "?"}`) ?? [],
    tags: m.Tags ?? [],
    security: m.Security ?? null,
  }));

  return {
    found: true,
    className: match.Name,
    superclass: match.Superclass ?? null,
    tags: match.Tags ?? [],
    members,
    source: ENGINE_DUMP_URL,
  };
}

export async function lookupEnum(name: string): Promise<unknown> {
  const dump = await loadDump();
  const needle = name.toLowerCase();
  const match = dump.Enums?.find((e) => e.Name.toLowerCase() === needle);
  if (!match) {
    const suggestions =
      dump.Enums?.filter((e) => e.Name.toLowerCase().includes(needle)).slice(0, 12).map((e) => e.Name) ?? [];
    return { found: false, query: name, suggestions };
  }
  return {
    found: true,
    enumName: match.Name,
    items: match.Items ?? [],
    source: ENGINE_DUMP_URL,
  };
}
