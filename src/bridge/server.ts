import { existsSync, readFileSync } from "node:fs";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { findProjectDir, readConfig } from "../config.ts";
import { isLotlBridgeCommand, listeningPid, processCommandLine, stopPid } from "../lib/bridge-lock.ts";
import {
  appendOperatorMessage,
  chatSince,
  operatorPendingCount,
  peekOperatorMessages,
  drainOperatorMessages,
  waitForOperatorMessages,
  clearChatMemory,
  hydrateInboxFromDisk,
} from "../lib/chat.ts";
import { lotlIconPath } from "../lib/icon.ts";
import { repoRoot } from "../paths.ts";
import { LOTL_VERSION, DEFAULT_BRIDGE_PORT } from "../version.ts";
import { MAX_BRIDGE_BODY, MAX_BRIDGE_QUEUE, MAX_POLL_WAIT_MS } from "../protocol.ts";

export type HealthResult = {
  ok: boolean;
  lotl?: boolean;
  pluginConnected?: boolean;
  error?: string;
};

export function interpretHealth(
  status: number,
  body: { name?: string; pluginConnected?: boolean; error?: string },
): HealthResult {
  if (body.name === "lotl" && status >= 200 && status < 300) {
    return { ok: true, lotl: true, pluginConnected: Boolean(body.pluginConnected) };
  }
  if (status === 401 && (body.error === "bad token" || (body.error ?? "").includes("bridge token"))) {
    return { ok: true, lotl: true, pluginConnected: false, error: body.error };
  }
  if (status < 200 || status >= 300) {
    return { ok: false, error: `health ${status}` };
  }
  return { ok: true, lotl: body.name === "lotl", pluginConnected: Boolean(body.pluginConnected) };
}

export type BridgeCommand = {
  id: string;
  method: string;
  args: Record<string, unknown>;
};

type Pending = BridgeCommand & {
  delivered: boolean;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

export type BridgeState = {
  port: number;
  token: "set" | "missing";
  pluginSeenAt: number | null;
  pluginConnected: boolean;
  pending: number;
  version: string;
  owned: boolean;
  presence: unknown;
  presenceAt: number | null;
  operatorPending: number;
};

let attachMode: "listen" | "reuse" = "listen";
let lastPresence: unknown = null;
let lastPresenceAt: number | null = null;

const waiters: Array<(cmd: BridgeCommand) => void> = [];
const queue: Pending[] = [];
let pluginSeenAt: number | null = null;
let httpServer: Server | null = null;
let port = DEFAULT_BRIDGE_PORT;
let token = "";

export function reloadBridgeToken(cwd?: string): string {
  const config = readConfig(cwd ?? projectDir());
  if (config?.token) token = config.token;
  return token;
}

function json(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json",
    "cache-control": "no-store",
    "content-length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

function clientHost(req: IncomingMessage): string {
  return (req.socket.remoteAddress ?? "").replace("::ffff:", "");
}

function isLocal(req: IncomingMessage): boolean {
  const host = clientHost(req);
  return host === "127.0.0.1" || host === "::1" || host === "localhost" || host === "";
}

function unauthorized(req: IncomingMessage, res: ServerResponse): boolean {
  if (!isLocal(req)) {
    json(res, 403, { ok: false, error: "localhost only" });
    return true;
  }
  if (!token) {
    json(res, 401, { ok: false, error: "bridge token missing. run lotl plugin install" });
    return true;
  }
  const header = req.headers["x-lotl-token"];
  const query = new URL(req.url ?? "/", "http://127.0.0.1").searchParams.get("token");
  const given = String(header ?? query ?? "");
  if (given !== token) {
    json(res, 401, { ok: false, error: "bad token" });
    return true;
  }
  return false;
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (c) => {
      size += (c as Buffer).length;
      if (size > MAX_BRIDGE_BODY) {
        reject(new Error("body too large"));
        req.destroy();
        return;
      }
      chunks.push(c as Buffer);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function nextUndelivered(): Pending | null {
  return queue.find((item) => !item.delivered) ?? null;
}

export function pluginConnected(): boolean {
  return pluginSeenAt !== null && Date.now() - pluginSeenAt < 20_000;
}

export function getBridgeState(): BridgeState {
  return {
    port,
    token: token ? "set" : "missing",
    pluginSeenAt,
    pluginConnected: pluginConnected(),
    pending: queue.length,
    version: LOTL_VERSION,
    owned: attachMode === "listen" && Boolean(httpServer),
    presence: lastPresence,
    presenceAt: lastPresenceAt,
    operatorPending: operatorPendingCount(),
  };
}

function projectDir(): string {
  const fromCwd = findProjectDir();
  if (readConfig(fromCwd)) return fromCwd;
  const fromRepo = findProjectDir(repoRoot());
  if (readConfig(fromRepo)) return fromRepo;
  return fromCwd;
}

function enqueueLocal(method: string, args: Record<string, unknown>, timeoutMs: number): Promise<unknown> {
  if (!httpServer) {
    return Promise.reject(new Error("Lotl bridge is not running. Cursor must have the lotl MCP server connected, or run lotl serve."));
  }
  if (queue.length >= MAX_BRIDGE_QUEUE) {
    return Promise.reject(new Error("Studio command queue is full. Wait for the plugin to catch up."));
  }
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID();
    const pending: Pending = {
      id,
      method,
      args,
      delivered: false,
      resolve,
      reject,
      timer: setTimeout(() => {
        const idx = queue.findIndex((item) => item.id === id);
        if (idx >= 0) queue.splice(idx, 1);
        reject(
          new Error(
            `Studio plugin did not answer '${method}' in time. Restart Studio after lotl plugin install, and keep the Lotl widget on connected.`,
          ),
        );
      }, timeoutMs),
    };
    queue.push(pending);
    const waiter = waiters.shift();
    if (waiter) waiter({ id, method, args });
  });
}

async function enqueueViaHttp(method: string, args: Record<string, unknown>, timeoutMs: number): Promise<unknown> {
  const res = await fetch(`http://127.0.0.1:${port}/enqueue`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-lotl-token": token,
    },
    body: JSON.stringify({ method, args, timeoutMs }),
    signal: AbortSignal.timeout(timeoutMs + 3000),
  });
  const body = (await res.json()) as { ok?: boolean; result?: unknown; error?: string };
  if (!res.ok || body.ok === false) {
    throw new Error(body.error || `bridge enqueue failed (${res.status})`);
  }
  return body.result;
}

export function enqueueStudio(method: string, args: Record<string, unknown> = {}, timeoutMs = 25_000): Promise<unknown> {
  reloadBridgeToken();
  if (attachMode === "reuse") return enqueueViaHttp(method, args, timeoutMs);
  return enqueueLocal(method, args, timeoutMs);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createBridgeServer(): Server {
  return createServer(async (req, res) => {
    try {
      if (!isLocal(req)) {
        json(res, 403, { ok: false, error: "localhost only" });
        return;
      }
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      if ((url.pathname === "/health" || url.pathname === "/status") && req.method === "GET") {
        json(res, 200, {
          ok: true,
          name: "lotl",
          version: LOTL_VERSION,
          pluginConnected: pluginConnected(),
          pending: queue.length,
        });
        return;
      }
      if ((url.pathname === "/icon" || url.pathname === "/icon.png") && req.method === "GET") {
        const file = lotlIconPath();
        if (!existsSync(file)) {
          json(res, 404, { ok: false, error: "icon missing" });
          return;
        }
        const body = readFileSync(file);
        res.writeHead(200, {
          "content-type": "image/png",
          "cache-control": "no-store",
          "content-length": body.length,
        });
        res.end(body);
        return;
      }
      if (unauthorized(req, res)) return;

      if (url.pathname === "/poll" && req.method === "GET") {
        pluginSeenAt = Date.now();
        let operatorAck: ReturnType<typeof appendOperatorMessage> | null = null;
        const headerOperator = String(req.headers["x-lotl-operator"] ?? "").trim();
        const operatorSubmit = headerOperator || url.searchParams.get("operator") || "";
        if (operatorSubmit) {
          try {
            const text = decodeURIComponent(operatorSubmit).trim();
            if (text) operatorAck = appendOperatorMessage(text);
          } catch {
            // ignore bad encoding
          }
        }
        const existing = nextUndelivered();
        const since = Number(url.searchParams.get("chatSince") ?? "0");
        if (existing) {
          existing.delivered = true;
          json(res, 200, {
            id: existing.id,
            method: existing.method,
            args: existing.args,
            operatorAck,
            chat: chatSince(since),
          });
          return;
        }
        if (operatorAck) {
          json(res, 200, {
            timeout: true,
            chat: chatSince(since),
            operatorPending: operatorPendingCount(),
            operatorAck,
          });
          return;
        }
        const waitMs = Math.min(Math.max(Number(url.searchParams.get("wait") ?? "15000"), 250), MAX_POLL_WAIT_MS);
        const command = await new Promise<BridgeCommand | null>((resolve) => {
          const timer = setTimeout(() => {
            const idx = waiters.indexOf(onCmd);
            if (idx >= 0) waiters.splice(idx, 1);
            resolve(null);
          }, waitMs);
          const onCmd = (cmd: BridgeCommand) => {
            clearTimeout(timer);
            const item = queue.find((entry) => entry.id === cmd.id);
            if (item) item.delivered = true;
            resolve(cmd);
          };
          waiters.push(onCmd);
        });
        const payload =
          command ??
          ({
            timeout: true,
            chat: chatSince(since),
            operatorPending: operatorPendingCount(),
            operatorAck,
          } as const);
        json(res, 200, payload);
        return;
      }

      if (url.pathname === "/chat/inbox" && req.method === "GET") {
        hydrateInboxFromDisk();
        const drain = url.searchParams.get("drain") !== "0";
        const waitMs = Math.min(Math.max(Number(url.searchParams.get("wait") ?? "0"), 0), 20_000);
        const messages = drain
          ? waitMs > 0
            ? await waitForOperatorMessages(waitMs)
            : drainOperatorMessages()
          : peekOperatorMessages();
        json(res, 200, { ok: true, messages, drained: drain });
        return;
      }

      if (url.pathname === "/chat/operator" && req.method === "POST") {
        if (unauthorized(req, res)) return;
        pluginSeenAt = Date.now();
        const body = JSON.parse((await readBody(req)) || "{}") as { text?: string };
        const text = String(body.text ?? "").trim();
        if (!text) {
          json(res, 400, { ok: false, error: "text required" });
          return;
        }
        const line = appendOperatorMessage(text);
        json(res, 200, { ok: true, line });
        return;
      }

      if (url.pathname === "/presence" && req.method === "POST") {
        pluginSeenAt = Date.now();
        lastPresenceAt = Date.now();
        lastPresence = JSON.parse((await readBody(req)) || "{}");
        json(res, 200, { ok: true });
        return;
      }

      if (url.pathname === "/presence" && req.method === "GET") {
        json(res, 200, { ok: true, presence: lastPresence, presenceAt: lastPresenceAt });
        return;
      }

      if (url.pathname === "/enqueue" && req.method === "POST") {
        const body = JSON.parse((await readBody(req)) || "{}") as {
          method?: string;
          args?: Record<string, unknown>;
          timeoutMs?: number;
        };
        if (!body.method) {
          json(res, 400, { ok: false, error: "method required" });
          return;
        }
        try {
          const result = await enqueueLocal(body.method, body.args ?? {}, body.timeoutMs ?? 25_000);
          json(res, 200, { ok: true, result });
        } catch (error) {
          json(res, 504, { ok: false, error: error instanceof Error ? error.message : String(error) });
        }
        return;
      }

      if (url.pathname === "/reply" && req.method === "POST") {
        pluginSeenAt = Date.now();
        const body = JSON.parse((await readBody(req)) || "{}") as {
          id?: string;
          ok?: boolean;
          result?: unknown;
          error?: string;
        };
        const idx = queue.findIndex((item) => item.id === body.id);
        if (idx < 0) {
          json(res, 404, { ok: false, error: "unknown id" });
          return;
        }
        const pending = queue.splice(idx, 1)[0];
        clearTimeout(pending.timer);
        if (body.ok === false) pending.reject(new Error(body.error || "plugin error"));
        else pending.resolve(body.result ?? null);
        json(res, 200, { ok: true });
        return;
      }

      json(res, 404, { ok: false, error: "not found" });
    } catch (error) {
      json(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  });
}

function closeServer(server: Server | null): Promise<void> {
  if (!server) return Promise.resolve();
  return new Promise((resolve) => {
    server.close(() => resolve());
  });
}

function tryListen(server: Server): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const onError = (error: NodeJS.ErrnoException) => {
      if (error.code === "EADDRINUSE") resolve(false);
      else reject(error);
    };
    server.once("error", onError);
    server.listen(port, "127.0.0.1", () => {
      server.off("error", onError);
      const addr = server.address();
      if (addr && typeof addr === "object") port = addr.port;
      resolve(true);
    });
  });
}

async function occupantHasInbox(bridgePort: number, auth: string): Promise<boolean> {
  try {
    const res = await fetch(`http://127.0.0.1:${bridgePort}/chat/inbox?drain=0`, {
      headers: { "x-lotl-token": auth },
      signal: AbortSignal.timeout(1500),
    });
    return res.status === 200;
  } catch {
    return false;
  }
}

export async function startBridge(options?: { port?: number; token?: string }): Promise<BridgeState> {
  if (httpServer) return getBridgeState();
  const config = readConfig(projectDir());
  port = options?.port ?? config?.bridgePort ?? DEFAULT_BRIDGE_PORT;
  token = options?.token ?? config?.token ?? "";
  if (!token) {
    throw new Error("lotl.json has no token. Run lotl setup or lotl plugin install.");
  }
  hydrateInboxFromDisk();

  for (let attempt = 0; attempt < 8; attempt++) {
    const server = createBridgeServer();
    const bound = await tryListen(server);
    if (bound) {
      httpServer = server;
      attachMode = "listen";
      console.error(`[lotl] studio bridge on 127.0.0.1:${port}`);
      return getBridgeState();
    }
    await closeServer(server);

    const health = await probeHealth(port);
    const inboxReady = health.ok && health.lotl ? await occupantHasInbox(port, token) : false;
    if (health.ok && health.lotl && inboxReady) {
      attachMode = "reuse";
      if (health.pluginConnected) pluginSeenAt = Date.now();
      console.error(`[lotl] reusing studio bridge on 127.0.0.1:${port}`);
      return getBridgeState();
    }

    if (health.ok && health.lotl && !inboxReady) {
      const pid = await listeningPid(port);
      if (pid) {
        console.error(`[lotl] occupant on ${port} has no pane inbox; taking over pid ${pid}`);
        await stopPid(pid);
        await sleep(350);
        attachMode = "listen";
        continue;
      }
    }

    const pid = await listeningPid(port);
    if (pid) {
      const command = await processCommandLine(pid);
      if (isLotlBridgeCommand(command)) {
        console.error(`[lotl] stopping stale bridge pid ${pid}`);
        await stopPid(pid);
        await sleep(350);
        continue;
      }
    }

    await sleep(200 * (attempt + 1));
  }

  attachMode = "reuse";
  console.error(`[lotl] bridge port ${port} still busy; MCP stdio is up, plugin commands may wait`);
  return getBridgeState();
}

export async function stopBridge(): Promise<void> {
  await closeServer(httpServer);
  httpServer = null;
  attachMode = "listen";
  lastPresence = null;
  lastPresenceAt = null;
  pluginSeenAt = null;
  queue.length = 0;
  waiters.length = 0;
  clearChatMemory();
}

export async function probeHealth(bridgePort = port): Promise<HealthResult> {
  try {
    const headers: Record<string, string> = {};
    const auth = token || readConfig(projectDir())?.token || "";
    if (auth) headers["x-lotl-token"] = auth;
    const res = await fetch(`http://127.0.0.1:${bridgePort}/health`, {
      headers,
      signal: AbortSignal.timeout(1500),
    });
    const body = (await res.json().catch(() => ({}))) as { name?: string; pluginConnected?: boolean; error?: string };
    return interpretHealth(res.status, body);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
