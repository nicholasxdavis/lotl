import { apiKeyFromEnv } from "../config.ts";

const APIS = "https://apis.roblox.com";

export class CloudError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
  ) {
    super(message);
  }
}

export function requireApiKey(): string {
  const key = apiKeyFromEnv();
  if (!key) {
    throw new Error(
      "No Open Cloud key. Set ROBLOX_API_KEY (or LOTL_API_KEY / RBXCLOUD_API_KEY) in the environment. Never pass the key as a CLI argument.",
    );
  }
  return key;
}

export async function cloudJson(
  method: string,
  pathname: string,
  options: {
    body?: unknown;
    form?: Record<string, string>;
    key?: string;
    query?: Record<string, string | undefined>;
  } = {},
): Promise<unknown> {
  const key = options.key ?? requireApiKey();
  const url = new URL(pathname.startsWith("http") ? pathname : `${APIS}${pathname}`);
  for (const [k, v] of Object.entries(options.query ?? {})) {
    if (v) url.searchParams.set(k, v);
  }

  const headers: Record<string, string> = { "x-api-key": key };
  let body: BodyInit | undefined;
  if (options.form) {
    const form = new FormData();
    for (const [k, v] of Object.entries(options.form)) form.append(k, v);
    body = form;
  } else if (options.body !== undefined) {
    headers["content-type"] = "application/json";
    body = JSON.stringify(options.body);
  }

  const res = await fetch(url, { method, headers, body });
  const text = await res.text();
  let parsed: unknown = text;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  if (!res.ok) {
    throw new CloudError(`Open Cloud ${method} ${url.pathname} failed (${res.status})`, res.status, parsed);
  }
  return parsed;
}

export async function getUniverse(universeId: string): Promise<unknown> {
  return cloudJson("GET", `/cloud/v2/universes/${universeId}`);
}

export async function getPlace(universeId: string, placeId: string): Promise<unknown> {
  return cloudJson("GET", `/cloud/v2/universes/${universeId}/places/${placeId}`);
}

export async function listDeveloperProducts(universeId: string): Promise<unknown> {
  return cloudJson(
    "GET",
    `/developer-products/v2/universes/${universeId}/developer-products/creator`,
    { query: { pageSize: "50" } },
  );
}

export async function createDeveloperProduct(input: {
  universeId: string;
  name: string;
  description?: string;
  price?: number;
  isForSale?: boolean;
}): Promise<unknown> {
  return cloudJson("POST", `/developer-products/v2/universes/${input.universeId}/developer-products`, {
    form: {
      name: input.name,
      description: input.description ?? "",
      price: String(input.price ?? 0),
      isForSale: String(input.isForSale ?? false),
    },
  });
}

export async function listGamePasses(universeId: string): Promise<unknown> {
  return cloudJson("GET", `/game-passes/v1/universes/${universeId}/game-passes/creator`, {
    query: { pageSize: "50" },
  });
}

export async function createGamePass(input: {
  universeId: string;
  name: string;
  description?: string;
  price?: number;
  isForSale?: boolean;
}): Promise<unknown> {
  return cloudJson("POST", `/game-passes/v1/universes/${input.universeId}/game-passes`, {
    form: {
      name: input.name,
      description: input.description ?? "",
      price: String(input.price ?? 0),
      isForSale: String(input.isForSale ?? false),
    },
  });
}

export async function runLuauTask(input: {
  universeId: string;
  placeId: string;
  script: string;
  versionId?: string;
  timeoutMs?: number;
}): Promise<unknown> {
  const base = input.versionId
    ? `/cloud/v2/universes/${input.universeId}/places/${input.placeId}/versions/${input.versionId}/luau-execution-session-tasks`
    : `/cloud/v2/universes/${input.universeId}/places/${input.placeId}/luau-execution-session-tasks`;

  const created = (await cloudJson("POST", base, {
    body: { script: input.script },
  })) as { path?: string; state?: string };

  const resourcePath = created.path;
  if (!resourcePath) return created;

  const deadline = Date.now() + (input.timeoutMs ?? 300_000);
  let task = created;
  while (Date.now() < deadline) {
    const state = String(task.state ?? "");
    if (state === "COMPLETE" || state === "FAILED" || state === "CANCELLED") break;
    await sleep(3000);
    task = (await cloudJson("GET", `/cloud/v2/${resourcePath}`, {
      query: { view: "FULL" },
    })) as { path?: string; state?: string };
  }

  let logs: unknown = null;
  try {
    logs = await cloudJson("GET", `/cloud/v2/${resourcePath}/logs`, {
      query: { view: "FLAT" },
    });
  } catch {
    logs = null;
  }

  return { task, logs };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
