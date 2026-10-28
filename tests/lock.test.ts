import assert from "node:assert/strict";
import { test } from "node:test";
import { isLotlBridgeCommand, listeningPid, processCommandLine } from "../src/lib/bridge-lock.ts";

test("only Lotl mcp/serve command lines are treated as our bridge", () => {
  assert.equal(
    isLotlBridgeCommand(`node C:/Users/me/Lotl for Roblox/node_modules/tsx/dist/cli.mjs C:/Users/me/Lotl for Roblox/src/cli.ts mcp`),
    true,
  );
  assert.equal(isLotlBridgeCommand("C:\\Users\\me\\Lotl for Roblox\\bin\\lotl.mjs serve"), true);
  assert.equal(isLotlBridgeCommand("tsx src/cli.ts mcp"), true);
  assert.equal(isLotlBridgeCommand("tsx src/cli.ts serve"), true);
});

test("other local listeners are left alone", () => {
  assert.equal(isLotlBridgeCommand(""), false);
  assert.equal(isLotlBridgeCommand("node server.js"), false);
  assert.equal(isLotlBridgeCommand("tsx src/cli.ts doctor"), false);
  assert.equal(isLotlBridgeCommand("StudioMCP.exe"), false);
  assert.equal(isLotlBridgeCommand("node C:/app/src/cli.ts"), false);
  assert.equal(isLotlBridgeCommand("npm run mcp"), false);
});

test("listeningPid on a closed high port is null", async () => {
  const pid = await listeningPid(59999);
  assert.equal(pid, null);
});

test("processCommandLine can read this node process", async () => {
  const command = await processCommandLine(process.pid);
  assert.ok(command.length > 0, "expected a command line");
  assert.match(command.toLowerCase(), /node/);
});
