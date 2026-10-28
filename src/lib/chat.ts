import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import path from "node:path";
import { findProjectDir } from "../config.ts";

export type ChatRole = "operator" | "agent";

export type ChatLine = {
  id: string;
  at: number;
  role: ChatRole;
  text: string;
};

const MAX_LINES = 200;
const MAX_TEXT = 4000;

const transcript: ChatLine[] = [];
const operatorQueue: ChatLine[] = [];
let operatorWaiters: Array<(lines: ChatLine[]) => void> = [];
let hydrated = false;

function trimText(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length > MAX_TEXT) {
    return trimmed.slice(0, MAX_TEXT);
  }
  return trimmed;
}

function inboxDir(): string {
  const dir = path.join(findProjectDir(), ".lotl");
  mkdirSync(dir, { recursive: true });
  return dir;
}

function inboxFile(): string {
  return path.join(inboxDir(), "operator-inbox.json");
}

function persistInbox(lines: ChatLine[]): void {
  try {
    writeFileSync(inboxFile(), `${JSON.stringify({ updatedAt: Date.now(), pending: lines }, null, 2)}\n`, "utf8");
  } catch {
    // best effort
  }
}

function readInboxFile(): ChatLine[] {
  try {
    if (!existsSync(inboxFile())) return [];
    const raw = JSON.parse(readFileSync(inboxFile(), "utf8")) as { pending?: ChatLine[] };
    return Array.isArray(raw.pending) ? raw.pending.filter((line) => line?.text && line.role === "operator") : [];
  } catch {
    return [];
  }
}

export function hydrateInboxFromDisk(): void {
  const disk = readInboxFile();
  const have = new Set(operatorQueue.map((line) => line.id));
  for (const line of disk) {
    if (!line.id || have.has(line.id)) continue;
    operatorQueue.push(line);
    have.add(line.id);
    if (!transcript.some((entry) => entry.id === line.id)) {
      transcript.push(line);
    }
  }
  hydrated = true;
}

function ensureHydrated(): void {
  if (!hydrated) hydrateInboxFromDisk();
}

function pushLine(role: ChatRole, text: string): ChatLine {
  const line: ChatLine = {
    id: crypto.randomUUID(),
    at: Date.now(),
    role,
    text: trimText(text),
  };
  transcript.push(line);
  while (transcript.length > MAX_LINES) {
    transcript.shift();
  }
  return line;
}

function notifyOperatorWaiters(lines: ChatLine[]): void {
  const waiters = operatorWaiters;
  operatorWaiters = [];
  for (const wake of waiters) {
    wake(lines);
  }
}

function appendInboxLog(line: ChatLine): void {
  try {
    const file = path.join(inboxDir(), "operator-chat.log");
    appendFileSync(file, `${new Date(line.at).toISOString()} ${line.text}\n`, "utf8");
  } catch {
    // best effort
  }
}

export function appendOperatorMessage(text: string): ChatLine {
  ensureHydrated();
  const trimmed = trimText(text);
  const last = operatorQueue.at(-1);
  if (last && last.text === trimmed && Date.now() - last.at < 2000) {
    return last;
  }
  const line = pushLine("operator", trimmed);
  operatorQueue.push(line);
  while (operatorQueue.length > MAX_LINES) {
    operatorQueue.shift();
  }
  persistInbox(operatorQueue);
  appendInboxLog(line);
  notifyOperatorWaiters([...operatorQueue]);
  return line;
}

export function appendAgentMessage(text: string): ChatLine {
  return pushLine("agent", text);
}

export function drainOperatorMessages(): ChatLine[] {
  hydrateInboxFromDisk();
  const drained = operatorQueue.splice(0, operatorQueue.length);
  persistInbox(operatorQueue);
  return drained;
}

export function peekOperatorMessages(): ChatLine[] {
  hydrateInboxFromDisk();
  return [...operatorQueue];
}

export function operatorPendingCount(): number {
  hydrateInboxFromDisk();
  return operatorQueue.length;
}

export function chatSince(sinceMs: number): ChatLine[] {
  return transcript.filter((line) => line.at > sinceMs);
}

export function lastChatLine(): ChatLine | undefined {
  return transcript.at(-1);
}

export function resetChat(): void {
  transcript.length = 0;
  operatorQueue.length = 0;
  operatorWaiters = [];
  hydrated = true;
  persistInbox([]);
}

export function clearChatMemory(): void {
  transcript.length = 0;
  operatorQueue.length = 0;
  operatorWaiters = [];
  hydrated = false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function waitForOperatorMessages(timeoutMs: number): Promise<ChatLine[]> {
  const pending = drainOperatorMessages();
  if (pending.length > 0) {
    return Promise.resolve(pending);
  }
  if (timeoutMs <= 0) {
    return Promise.resolve([]);
  }
  return new Promise((resolve) => {
    let settled = false;
    const finish = (lines: ChatLine[]) => {
      if (settled) return;
      settled = true;
      resolve(lines);
    };
    const timer = setTimeout(() => {
      const idx = operatorWaiters.indexOf(onWake);
      if (idx >= 0) operatorWaiters.splice(idx, 1);
      finish(drainOperatorMessages());
    }, timeoutMs);
    const onWake = () => {
      clearTimeout(timer);
      finish(drainOperatorMessages());
    };
    operatorWaiters.push(onWake);
    void (async () => {
      const deadline = Date.now() + timeoutMs;
      while (!settled && Date.now() < deadline) {
        await sleep(250);
        hydrateInboxFromDisk();
        if (operatorQueue.length > 0) {
          clearTimeout(timer);
          const idx = operatorWaiters.indexOf(onWake);
          if (idx >= 0) operatorWaiters.splice(idx, 1);
          finish(drainOperatorMessages());
          return;
        }
      }
    })();
  });
}
