import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { enqueueStudio, getBridgeState, pluginConnected, reloadBridgeToken, startBridge } from "../bridge/server.ts";
import {
  createDeveloperProduct,
  createGamePass,
  getPlace,
  getUniverse,
  listDeveloperProducts,
  listGamePasses,
  runLuauTask,
} from "../cloud/client.ts";
import { apiKeyFromEnv, findProjectDir, readConfig } from "../config.ts";
import { lookupClass, lookupEnum } from "../engine/dump.ts";
import { runChecks } from "../lib/check.ts";
import { writeCursorMcp } from "../lib/connect.ts";
import { runDoctor } from "../lib/doctor.ts";
import { initProject } from "../lib/init-project.ts";
import { searchMarketplace } from "../lib/marketplace.ts";
import { installPlugin } from "../lib/plugin-install.ts";
import { runReady } from "../lib/ready.ts";
import { PLAYBOOK } from "../playbook.ts";
import { COMPANION_SKILLS, OFFICIAL_STUDIO_TOOLS, REQUIRED_OFFICIAL_TOOLS } from "../studio-catalog.ts";
import { isStudioMethod, MAX_EVAL_CHARS } from "../protocol.ts";
import {
  appendAgentMessage,
  drainOperatorMessages,
  peekOperatorMessages,
  waitForOperatorMessages,
} from "../lib/chat.ts";
import { lotlMcpIcons } from "../lib/icon.ts";
import { LOTL_VERSION } from "../version.ts";

function text(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function err(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: "text" as const, text: JSON.stringify({ ok: false, error: message }, null, 2) }],
    isError: true,
  };
}

async function wrap(fn: () => Promise<unknown> | unknown) {
  try {
    return text(await fn());
  } catch (error) {
    return err(error);
  }
}

export async function startMcp(): Promise<void> {
  try {
    await startBridge();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[lotl] bridge failed (${message}); MCP stdio still starting`);
  }
  const server = new McpServer({
    name: "lotl",
    title: "Lotl",
    version: LOTL_VERSION,
    description: "Agent bridge for Roblox Studio and Open Cloud",
    icons: lotlMcpIcons(),
  });

  server.tool(
    "lotl_ready",
    "First call in a Roblox session. Doctor plus whether the Studio plugin is actually polling. If pluginLive is false, tell the operator to restart Studio.",
    async () => {
      await startBridge();
      return wrap(runReady);
    },
  );

  server.tool(
    "lotl_playbook",
    "Operator policy: when to screenshot, when to ask the user, how to navigate Studio, and which MCP tools to use. Call this before driving Studio.",
    async () => text(PLAYBOOK),
  );

  server.tool(
    "lotl_studio_catalog",
    "Complete map of official Roblox_Studio first-party MCP tools (upload image, edit script, play, console, mouse, keyboard, nav, generate mesh/material/procedural/texture, execute Luau, search/insert asset, screen capture). Use this to pick the right official tool instead of reinventing it.",
    async () =>
      text({
        official: OFFICIAL_STUDIO_TOOLS,
        requiredEnabled: REQUIRED_OFFICIAL_TOOLS,
        companions: COMPANION_SKILLS,
        rule: "These run on Roblox_Studio MCP. Enable every required tool in Cursor. Lotl does not duplicate them.",
      }),
  );

  server.tool("lotl_doctor", "Check Studio, official MCP binary, Lotl plugin, Cursor MCP config, toolchain, and Open Cloud key.", async () =>
    wrap(() => runDoctor()),
  );

  server.tool(
    "lotl_init",
    "Create a Roblox place project on disk (Argon/Rojo layout, UI, monetization module, AGENTS.md).",
    {
      dir: z.string().optional().describe("Directory to create. Defaults to ./place"),
      name: z.string().optional(),
      sync: z.enum(["argon", "rojo", "script-sync"]).optional(),
    },
    async ({ dir, name, sync }) =>
      wrap(() => initProject({ dir: dir ?? "place", name: name ?? "place", sync: sync ?? "argon" })),
  );

  server.tool(
    "lotl_connect",
    "Write MCP configs for Cursor, Claude Code, Codex, and VS Code (lotl plus official Roblox_Studio). Strips those servers from user Cursor/Claude files so they are not started twice. Syncs skills into .cursor/skills and .agents/skills.",
    async () => wrap(() => writeCursorMcp()),
  );

  server.tool("lotl_plugin_install", "Install the Lotl Studio plugin into the local Plugins folder. Restart Studio after.", async () =>
    wrap(() => installPlugin()),
  );

  server.tool("lotl_check", "Build/lint/format the place on disk without Studio. Run after any Luau file change.", async () =>
    wrap(() => runChecks()),
  );

  server.tool(
    "lotl_bridge_status",
    "Localhost plugin bridge status plus the last Studio presence snapshot (selection, camera, open scripts, fingerprint). pluginConnected true means Studio is polling.",
    async () => text({ ...getBridgeState(), pluginConnected: pluginConnected() }),
  );

  server.tool(
    "lotl_studio",
    "Drive the open Studio place through the Lotl plugin (plugin security). Call method=context first so you match the operator's selection, camera, open script tabs, and lighting. Prefer official Roblox_Studio tools for playtest, screen_capture, and insert_asset. After visual changes, call Roblox_Studio screen_capture.",
    {
      method: z
        .string()
        .describe(
          "transform, write_document, mouse, union, separate, negate, intersect, ribbon_tool, note, context, script_document, syntax, tags, add_tag, remove_tag, class_icon, ping, place_info, eval, selection, inspect, children, select, get_properties, set_properties, create, destroy, rename, parent, undo, redo, logs, camera, set_camera, services, open_script, attributes, set_attribute, waypoint",
        ),
      path: z.string().optional().describe("Dot path, e.g. Workspace.Baseplate or game.StarterGui"),
      code: z.string().optional().describe("Luau for eval"),
      text: z.string().optional().describe("Working note for the Lotl pane"),
      className: z.string().optional(),
      parent: z.string().optional(),
      name: z.string().optional(),
      properties: z.record(z.string(), z.any()).optional(),
      names: z.array(z.string()).optional().describe("Property names for get_properties"),
      value: z.any().optional(),
      position: z.any().optional().describe("World position {x,y,z} for transform"),
      size: z.any().optional().describe("Part size {x,y,z} for transform"),
      scale: z.number().optional().describe("Model ScaleTo factor for transform"),
      offset: z.any().optional().describe("Relative move {x,y,z} for transform"),
      lookAt: z.any().optional(),
      cframe: z.any().optional().describe("Full CFrame for transform, including components[1..12]"),
      fov: z.number().optional(),
      paths: z.array(z.string()).optional().describe("Instance paths for union/separate/negate/intersect"),
    },
    async (input) =>
      wrap(async () => {
        if (!isStudioMethod(input.method)) {
          throw new Error(`unknown method ${input.method}`);
        }
        if (input.method === "eval" && (input.code?.length ?? 0) > MAX_EVAL_CHARS) {
          throw new Error("eval too large");
        }
        const { method, ...args } = input;
        const result = await enqueueStudio(method, args);
        return { ok: true, method, result, screenshotHint: visualMethod(method) };
      }),
  );

  server.tool(
    "lotl_note",
    "Write a working note into the Lotl Studio pane. Use this for plans, progress, and what you are about to do so the operator can watch without reading the chat.",
    {
      text: z.string().describe("Short note, one or two sentences"),
      kind: z.enum(["note", "status", "error", "warn", "ok", "milestone", "point"]).optional(),
    },
    async ({ text: noteText, kind }) =>
      wrap(async () => {
        const result = await enqueueStudio("note", { text: noteText, kind: kind ?? "note" }, 8_000);
        return { ok: true, result };
      }),
  );

  server.tool(
    "lotl_inbox",
    "Read messages the operator typed in the Lotl Studio pane. Call this every loop (and after lotl_ready) so Studio chat reaches Cursor, Claude Code, or Codex. MCP cannot push into the host chat; you must poll.",
    {
      waitMs: z.number().optional().describe("Long-poll up to 20s for a new pane message. Default drains immediately."),
      drain: z.boolean().optional().describe("Default true. Set false to peek without removing from the queue."),
    },
    async ({ waitMs, drain }) =>
      wrap(async () => {
        reloadBridgeToken();
        const timeout = Math.min(Math.max(waitMs ?? 0, 0), 20_000);
        const shouldDrain = drain !== false;
        const messages = shouldDrain
          ? timeout > 0
            ? await waitForOperatorMessages(timeout)
            : drainOperatorMessages()
          : peekOperatorMessages();
        return {
          ok: true,
          messages,
          drained: shouldDrain,
          replyWith: "lotl_say",
          hint: messages.length ? "Answer in the pane with lotl_say, then keep working." : "No new pane messages.",
        };
      }),
  );

  server.tool(
    "lotl_say",
    "Reply in the Lotl Studio pane so the operator sees your thinking without reading the host chat. Use for answers, plans, and progress. Pair with lotl_inbox for two-way Studio chat.",
    {
      text: z.string().describe("What the operator should read in Studio"),
      kind: z.enum(["agent", "status", "error"]).optional(),
    },
    async ({ text: sayText, kind }) =>
      wrap(async () => {
        const line = appendAgentMessage(sayText);
        const result = await enqueueStudio(
          "note",
          { text: sayText, kind: kind ?? "agent", chatId: line.id },
          12_000,
        );
        return { ok: true, result, line };
      }),
  );

  server.tool(
    "lotl_engine_class",
    "Look up a Roblox engine class from the Client Tracker Mini API dump before setting properties.",
    { name: z.string() },
    async ({ name }) => wrap(() => lookupClass(name)),
  );

  server.tool(
    "lotl_engine_enum",
    "Look up a Roblox engine enum from the Client Tracker Mini API dump.",
    { name: z.string() },
    async ({ name }) => wrap(() => lookupEnum(name)),
  );

  server.tool(
    "lotl_marketplace_search",
    "Search Creator Store models. If hasScripts is true, ask the operator before insert_asset. Insert with Roblox_Studio insert_asset using the id.",
    { query: z.string(), limit: z.number().optional() },
    async ({ query, limit }) => wrap(async () => ({ ok: true, hits: await searchMarketplace(query, limit) })),
  );

  server.tool(
    "lotl_cloud_universe",
    "Get Open Cloud universe (and optional place) info. Requires ROBLOX_API_KEY. Never print the key.",
    {
      universeId: z.string().optional(),
      placeId: z.string().optional(),
    },
    async ({ universeId, placeId }) =>
      wrap(async () => {
        const config = readConfig(findProjectDir());
        const universe = universeId || config?.universeId;
        const place = placeId || config?.placeId;
        if (!universe) throw new Error("universeId missing. Set lotl.json or pass universeId.");
        const data: Record<string, unknown> = { universe: await getUniverse(universe) };
        if (place) data.place = await getPlace(universe, place);
        return { ok: true, ...data, key: apiKeyFromEnv() ? "present" : "missing" };
      }),
  );

  server.tool(
    "lotl_cloud_luau",
    "Run Luau headlessly against a published place via Open Cloud. Ask the operator before SavePlaceAsync or live data writes.",
    {
      script: z.string(),
      universeId: z.string().optional(),
      placeId: z.string().optional(),
    },
    async ({ script, universeId, placeId }) =>
      wrap(async () => {
        const config = readConfig(findProjectDir());
        const universe = universeId || config?.universeId;
        const place = placeId || config?.placeId;
        if (!universe || !place) throw new Error("universeId and placeId required");
        return { ok: true, result: await runLuauTask({ universeId: universe, placeId: place, script }) };
      }),
  );

  server.tool(
    "lotl_billing_list",
    "List developer products and game passes. Ask before changing prices or putting items on sale.",
    { universeId: z.string().optional() },
    async ({ universeId }) =>
      wrap(async () => {
        const universe = universeId || readConfig(findProjectDir())?.universeId;
        if (!universe) throw new Error("universeId missing");
        return {
          ok: true,
          products: await listDeveloperProducts(universe),
          passes: await listGamePasses(universe),
        };
      }),
  );

  server.tool(
    "lotl_billing_create",
    "Create a developer product or game pass. Defaults to not for sale. Ask the operator before isForSale=true.",
    {
      kind: z.enum(["product", "pass"]),
      name: z.string(),
      description: z.string().optional(),
      price: z.number().optional(),
      isForSale: z.boolean().optional(),
      universeId: z.string().optional(),
    },
    async (input) =>
      wrap(async () => {
        if (input.isForSale) {
          throw new Error("Refusing to put an item on sale from the agent. Ask the operator to sell it from setup (`lotl billing create ... --for-sale`).");
        }
        const universe = input.universeId || readConfig(findProjectDir())?.universeId;
        if (!universe) throw new Error("universeId missing");
        const created =
          input.kind === "product"
            ? await createDeveloperProduct({ ...input, universeId: universe, isForSale: false })
            : await createGamePass({ ...input, universeId: universe, isForSale: false });
        return { ok: true, created, forSale: false };
      }),
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[lotl] MCP server on stdio");
}

function visualMethod(method: string): boolean {
  return ["create", "destroy", "set_properties", "transform", "set_camera", "parent", "eval", "union", "separate", "negate", "intersect"].includes(method);
}
