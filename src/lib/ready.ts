import { DEFAULT_BRIDGE_PORT } from "../version.ts";
import { probeHealth } from "../bridge/server.ts";
import { readConfig, findProjectDir } from "../config.ts";
import { runDoctor } from "./doctor.ts";

export async function runReady(cwd = findProjectDir()) {
  const doctor = runDoctor(cwd);
  const config = readConfig(cwd);
  const health = await probeHealth(config?.bridgePort ?? DEFAULT_BRIDGE_PORT);
  const pluginLive = Boolean(health.pluginConnected);
  const next = [...doctor.next];
  if (!health.ok) {
    next.unshift("Cursor must be running the lotl MCP server (reload MCP), or run npm run lotl -- serve");
  } else if (!pluginLive) {
    next.unshift("Restart Roblox Studio so the Lotl plugin polls the bridge. Widget should say connected.");
  }
  const ok = doctor.ok && health.ok && pluginLive;
  const successNext = [
    "Use Roblox_Studio list_roblox_studios, then lotl_playbook, then work.",
    "If list_roblox_studios is empty right after opening Studio, toggle Roblox_Studio MCP off and on in Cursor (Lotl cannot reload that server for you).",
    "Poll lotl_inbox when the operator uses the Studio pane; reply with lotl_say.",
  ];
  if (health.error === "bad token") {
    next.unshift("Reload the lotl MCP in Cursor so it picks up the bridge token from lotl.json, then run lotl plugin install if Studio still shows token mismatch.");
  }
  return {
    ok,
    doctor,
    bridge: health,
    pluginLive,
    next: ok ? successNext : next,
  };
}
