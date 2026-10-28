import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function listeningPid(port: number): Promise<number | null> {
  try {
    if (process.platform === "win32") {
      const { stdout } = await execFileAsync("netstat", ["-ano", "-p", "tcp"], { windowsHide: true });
      for (const line of stdout.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed.includes("LISTENING")) continue;
        if (!trimmed.includes(`127.0.0.1:${port}`) && !trimmed.includes(`[::1]:${port}`)) continue;
        const pid = Number(trimmed.split(/\s+/).pop());
        if (Number.isInteger(pid) && pid > 0 && pid !== process.pid) return pid;
      }
      return null;
    }
    const { stdout } = await execFileAsync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"]);
    const pid = Number(stdout.trim().split(/\s+/)[0]);
    if (Number.isInteger(pid) && pid > 0 && pid !== process.pid) return pid;
  } catch {
    return null;
  }
  return null;
}

export async function processCommandLine(pid: number): Promise<string> {
  try {
    if (process.platform === "win32") {
      const { stdout } = await execFileAsync(
        "powershell.exe",
        ["-NoProfile", "-Command", `(Get-CimInstance Win32_Process -Filter 'ProcessId=${pid}').CommandLine`],
        { windowsHide: true },
      );
      return stdout.trim();
    }
    const { stdout } = await execFileAsync("ps", ["-p", String(pid), "-o", "args="]);
    return stdout.trim();
  } catch {
    return "";
  }
}

export function isLotlBridgeCommand(command: string): boolean {
  const n = command.toLowerCase().replace(/\\/g, "/");
  if (!n) return false;
  const isCli = n.includes("src/cli.ts") || n.includes("bin/lotl");
  const isMode = n.includes(" mcp") || n.endsWith("mcp") || n.includes(" serve") || n.endsWith("serve");
  return isCli && isMode;
}

export async function stopPid(pid: number): Promise<void> {
  if (!pid || pid === process.pid) return;
  try {
    process.kill(pid);
  } catch {
    return;
  }
  await sleep(400);
  try {
    process.kill(pid, 0);
  } catch {
    return;
  }
  try {
    process.kill(pid);
  } catch {
    return;
  }
  await sleep(300);
}

export async function stopStaleLotl(port: number): Promise<number | null> {
  const pid = await listeningPid(port);
  if (!pid) return null;
  const command = await processCommandLine(pid);
  if (!isLotlBridgeCommand(command)) return null;
  await stopPid(pid);
  return pid;
}
