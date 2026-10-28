import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const plugin = readFileSync(path.join(root, "plugin", "src", "Main.server.luau"), "utf8");
const art = readFileSync(path.join(root, ".cursor", "text.ini"), "utf8");
const icon = readFileSync(path.join(root, "plugin", "icon.png"));

test("version lives on its own line, not inside the axolotl", () => {
  const lines = art.replace(/\r\n/g, "\n").trimEnd().split("\n");
  assert.match(lines.at(-1) ?? "", /^Version\s+[\d.]+$/);
  assert.equal(lines.filter((line) => /Version\s+[\d.]+/.test(line)).length, 1);
  assert.ok(art.includes("\u2800") || /[\u2800-\u28FF]/.test(art));
});

test("the pane paints braille as frames, then fades on Heartbeat", () => {
  assert.match(plugin, /utf8\.codes/);
  assert.match(plugin, /0x2800/);
  assert.match(plugin, /DOT_MAP/);
  assert.match(plugin, /t \* t \* \(3 - 2 \* t\)/);
  assert.match(plugin, /connectedAt/);
  assert.match(plugin, /os\.clock\(\) - connectedAt >= 3/);
  assert.match(plugin, /duration = 3\.8/);
  assert.match(plugin, /pendingOperatorSend/);
  assert.match(plugin, /FocusLost/);
  assert.match(plugin, /wait=750/);
  assert.match(plugin, /X-Lotl-Operator/);
  assert.match(plugin, /message the agent/);
  assert.equal(plugin.includes("Wordmark"), false);
  assert.equal(plugin.includes('header.Text = "lotl"'), false);
  assert.equal(plugin.includes('studio ↔ agent'), false);
  assert.match(plugin, /ORCHID = Color3\.fromRGB\(239, 206, 250\)/);
  assert.match(plugin, /DUSK = Color3\.fromRGB\(93, 78, 96\)/);
  assert.match(plugin, /SNOW = Color3\.fromRGB\(244, 244, 246\)/);
});

test("recordings keep the id and never cancel the empty bucket", () => {
  assert.match(plugin, /openRecording/);
  assert.match(plugin, /FinishRecording\(\s*\n?\s*id,/);
  assert.equal(plugin.includes('FinishRecording("",'), false);
  assert.equal(plugin.includes("FinishRecording('',"), false);
});

test("presence and notes stay quiet until the pane is actually linked", () => {
  assert.match(plugin, /if linked then/);
  assert.match(plugin, /QUIET/);
  assert.match(plugin, /ping = true/);
  assert.match(plugin, /context = true/);
  assert.match(plugin, /tag name required/);
  assert.match(plugin, /GetEditorSource/);
  assert.match(plugin, /TryBeginRecording/);
  assert.match(plugin, /method == "transform"/);
  assert.match(plugin, /asVector3/);
  assert.match(plugin, /PivotTo/);
  assert.match(plugin, /ScaleTo/);
  assert.match(plugin, /CFrame\.new\(table\.unpack/);
  assert.match(plugin, /ICON = "icon\.png"/);
  assert.match(plugin, /CreateDockWidgetPluginGuiAsync/);
  assert.match(plugin, /UpdateSourceAsync/);
  assert.match(plugin, /CreatePluginAction/);
  assert.match(plugin, /plugin:Union/);
  assert.match(plugin, /message the agent/);
  assert.match(plugin, /operator=/);
  assert.match(plugin, /chatSince/);
});

test("the axolotl icon is a real PNG", () => {
  assert.equal(icon.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.ok(icon.length > 1000);
});
