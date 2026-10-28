import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Command } from "commander";
import { enqueueStudio, pluginConnected, startBridge } from "./bridge/server.ts";
import {
  createDeveloperProduct,
  createGamePass,
  getPlace,
  getUniverse,
  listDeveloperProducts,
  listGamePasses,
  runLuauTask,
} from "./cloud/client.ts";
import { readConfig, requireConfig, type SyncKind } from "./config.ts";
import { lookupClass, lookupEnum } from "./engine/dump.ts";
import { runChecks } from "./lib/check.ts";
import { writeCursorMcp } from "./lib/connect.ts";
import { runDoctor } from "./lib/doctor.ts";
import { runReady } from "./lib/ready.ts";
import { PLAYBOOK } from "./playbook.ts";
import { isStudioMethod } from "./protocol.ts";
import { initProject } from "./lib/init-project.ts";
import { searchMarketplace } from "./lib/marketplace.ts";
import { installPlugin } from "./lib/plugin-install.ts";
import { startMcp } from "./mcp/server.ts";
import { fail, ok } from "./output.ts";
import { repoRoot } from "./paths.ts";
import { LOTL_VERSION } from "./version.ts";

const program = new Command();
program
  .name("lotl")
  .description("Setup, MCP stdio, and plugin install. Operators work in the Studio pane.")
  .version(LOTL_VERSION);

function parseXyz(value?: string): { x: number; y: number; z: number } | undefined {
  if (!value) return undefined;
  const parts = value.split(",").map((part) => Number(part.trim()));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
    throw new Error("expected x,y,z");
  }
  return { x: parts[0], y: parts[1], z: parts[2] };
}

function catcher<Args extends unknown[]>(fn: (...args: Args) => Promise<void> | void) {
  return async (...args: Args) => {
    try {
      await fn(...args);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      fail(message);
    }
  };
}

program
  .command("doctor")
  .description("Check Studio, MCP, plugin, toolchain, and keys")
  .action(
    catcher(() => {
      const report = runDoctor();
      ok(report);
      if (!report.ok) process.exitCode = 1;
    }),
  );

program
  .command("init")
  .description("Create a place project on disk")
  .argument("[dir]", "project directory", "place")
  .option("-n, --name <name>", "place name")
  .option("-s, --sync <kind>", "argon | rojo | script-sync", "argon")
  .option("-f, --force", "overwrite existing files")
  .action(
    catcher(async (dir: string, opts: { name?: string; sync: string; force?: boolean }) => {
      const name = opts.name ?? path.basename(path.resolve(dir));
      const result = initProject({
        dir,
        name,
        sync: opts.sync as SyncKind,
        force: opts.force,
      });
      ok(result);
    }),
  );

program
  .command("connect")
  .description("Write Cursor, Claude Code, Codex, and VS Code MCP configs; strip user duplicates")
  .action(
    catcher(() => {
      ok(writeCursorMcp());
    }),
  );

const pluginCmd = program.command("plugin").description("Studio plugin");
pluginCmd
  .command("install")
  .description("Install the Lotl Studio plugin into the local Plugins folder")
  .action(
    catcher(() => {
      ok(installPlugin());
    }),
  );

program
  .command("check")
  .description("Build and lint the place without Studio")
  .action(
    catcher(() => {
      const report = runChecks();
      ok(report);
      if (!report.ok) process.exitCode = 1;
    }),
  );

program
  .command("ready")
  .description("Doctor plus live plugin bridge health")
  .action(
    catcher(async () => {
      const report = await runReady();
      ok(report);
      if (!report.ok) process.exitCode = 1;
    }),
  );

program
  .command("playbook")
  .description("Print screenshot, ask-operator, and Studio navigation policy")
  .action(
    catcher(() => {
      ok({ playbook: PLAYBOOK });
    }),
  );

program
  .command("setup")
  .description("Init (if needed), install plugin, and connect Cursor, Claude Code, Codex, and VS Code MCP")
  .option("-n, --name <name>", "place name", "place")
  .option("-s, --sync <kind>", "argon | rojo | script-sync", "argon")
  .action(
    catcher(async (opts: { name: string; sync: string }) => {
      const cwdIsTool = path.basename(repoRoot()) === path.basename(process.cwd());
      const target = readConfig() ? process.cwd() : cwdIsTool ? path.join(process.cwd(), "place") : process.cwd();
      const inited = readConfig(target) ? null : initProject({ dir: target, name: opts.name, sync: opts.sync as SyncKind });
      const plugin = installPlugin(target);
      const mcp = writeCursorMcp(process.cwd());
      const doctor = runDoctor(target);
      ok({ target, inited, plugin, mcp, doctor });
    }),
  );

program
  .command("serve")
  .description("Run the localhost plugin bridge without MCP")
  .action(
    catcher(async () => {
      const state = await startBridge();
      ok({ serving: true, ...state, pluginConnected: pluginConnected() });
      await new Promise(() => undefined);
    }),
  );

program
  .command("mcp")
  .description("Start the Lotl MCP server (stdio) and Studio plugin bridge")
  .action(async () => {
    await startMcp();
  });

program
  .command("studio")
  .description("Talk to the open Studio place through the Lotl plugin")
  .argument("<method>", "see lotl playbook")
  .option("--path <path>", "instance path")
  .option("--code <code>", "Luau to eval")
  .option("--file <file>", "Luau file to eval")
  .option("--class <name>", "className for create")
  .option("--parent <path>", "parent path")
  .option("--name <name>", "instance name")
  .option("--position <xyz>", "transform position as x,y,z")
  .option("--size <xyz>", "transform size as x,y,z")
  .option("--offset <xyz>", "transform offset as x,y,z")
  .option("--scale <n>", "model ScaleTo factor")
  .action(
    catcher(async (
      method: string,
      opts: {
        path?: string;
        code?: string;
        file?: string;
        class?: string;
        parent?: string;
        name?: string;
        position?: string;
        size?: string;
        offset?: string;
        scale?: string;
      },
    ) => {
      if (!isStudioMethod(method)) fail(`unknown studio method ${method}`);
      await startBridge();
      const code = opts.file ? readFileSync(opts.file, "utf8") : opts.code;
      const result = await enqueueStudio(method, {
        path: opts.path,
        code,
        className: opts.class,
        parent: opts.parent,
        name: opts.name,
        position: parseXyz(opts.position),
        size: parseXyz(opts.size),
        offset: parseXyz(opts.offset),
        scale: opts.scale ? Number(opts.scale) : undefined,
      });
      ok({ result });
    }),
  );

const engine = program.command("engine").description("Roblox Client Tracker API dump");
engine
  .command("class")
  .argument("<name>")
  .action(
    catcher(async (name: string) => {
      ok({ result: await lookupClass(name) });
    }),
  );
engine
  .command("enum")
  .argument("<name>")
  .action(
    catcher(async (name: string) => {
      ok({ result: await lookupEnum(name) });
    }),
  );

const marketplace = program.command("marketplace").description("Creator Store / catalog");
marketplace
  .command("search")
  .argument("<query>")
  .option("-l, --limit <n>", "limit", "12")
  .action(
    catcher(async (query: string, opts: { limit: string }) => {
      ok({ hits: await searchMarketplace(query, Number(opts.limit)) });
    }),
  );

const cloud = program.command("cloud").description("Open Cloud (rbxcloud / rocale-cli shaped)");
cloud
  .command("universe")
  .action(
    catcher(async () => {
      const config = requireConfig();
      if (!config.universeId) fail("lotl.json is missing universeId");
      const universe = await getUniverse(config.universeId);
      const place = config.placeId ? await getPlace(config.universeId, config.placeId) : null;
      ok({ universe, place });
    }),
  );
cloud
  .command("luau")
  .requiredOption("--script <file>", "Luau file")
  .action(
    catcher(async (opts: { script: string }) => {
      const config = requireConfig();
      if (!config.universeId || !config.placeId) fail("lotl.json needs universeId and placeId");
      const script = readFileSync(opts.script, "utf8");
      ok({ result: await runLuauTask({ universeId: config.universeId, placeId: config.placeId, script }) });
    }),
  );

const billing = program.command("billing").description("Developer products and game passes");
billing
  .command("list")
  .action(
    catcher(async () => {
      const config = requireConfig();
      if (!config.universeId) fail("lotl.json is missing universeId");
      ok({
        products: await listDeveloperProducts(config.universeId),
        passes: await listGamePasses(config.universeId),
      });
    }),
  );
billing
  .command("create")
  .argument("<kind>", "product | pass")
  .requiredOption("--name <name>")
  .option("--description <text>", "")
  .option("--price <n>", "0")
  .option("--for-sale", "put on sale")
  .action(
    catcher(async (kind: string, opts: { name: string; description?: string; price: string; forSale?: boolean }) => {
      const config = requireConfig();
      if (!config.universeId) fail("lotl.json is missing universeId");
      const created =
        kind === "pass"
          ? await createGamePass({
              universeId: config.universeId,
              name: opts.name,
              description: opts.description,
              price: Number(opts.price),
              isForSale: Boolean(opts.forSale),
            })
          : await createDeveloperProduct({
              universeId: config.universeId,
              name: opts.name,
              description: opts.description,
              price: Number(opts.price),
              isForSale: Boolean(opts.forSale),
            });
      const file = path.join(process.cwd(), "src", "shared", "Monetization.luau");
      try {
        mkdirSync(path.dirname(file), { recursive: true });
        writeFileSync(
          file,
          `--!strict
export type Product = { id: number, name: string, kind: "product" | "pass" }
local Monetization = { products = {} :: { [string]: Product }, passes = {} :: { [string]: Product } }
-- last create via lotl billing:
-- ${kind} ${opts.name} ${JSON.stringify(created)}
return Monetization
`,
          "utf8",
        );
      } catch {
        // place may not have been inited with src/shared
      }
      ok({ created });
    }),
  );

await program.parseAsync(process.argv);
