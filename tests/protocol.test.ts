import assert from "node:assert/strict";
import { test } from "node:test";
import { isStudioMethod, STUDIO_METHODS } from "../src/protocol.ts";
import { PLAYBOOK } from "../src/playbook.ts";
import { COMPANION_SKILLS, OFFICIAL_STUDIO_TOOLS, REQUIRED_OFFICIAL_TOOLS } from "../src/studio-catalog.ts";

test("studio methods include create and screen-critical eval", () => {
  assert.equal(isStudioMethod("create"), true);
  assert.equal(isStudioMethod("set_properties"), true);
  assert.equal(isStudioMethod("transform"), true);
  assert.equal(isStudioMethod("context"), true);
  assert.equal(isStudioMethod("script_document"), true);
  assert.equal(isStudioMethod("syntax"), true);
  assert.equal(isStudioMethod("note"), true);
  assert.equal(isStudioMethod("tags"), true);
  assert.equal(isStudioMethod("add_tag"), true);
  assert.equal(isStudioMethod("class_icon"), true);
  assert.equal(isStudioMethod("write_document"), true);
  assert.equal(isStudioMethod("mouse"), true);
  assert.equal(isStudioMethod("union"), true);
  assert.equal(isStudioMethod("ribbon_tool"), true);
  assert.equal(isStudioMethod("nope"), false);
  assert.ok(STUDIO_METHODS.length >= 20);
});

test("playbook tells the agent when to screenshot and when to ask", () => {
  assert.ok(PLAYBOOK.screenshotWhen.length >= 5);
  assert.ok(PLAYBOOK.askOperatorWhen.length >= 5);
  assert.equal(PLAYBOOK.screenshotTool.includes("screen_capture"), true);
  assert.ok(PLAYBOOK.officialStudioTools.play.includes("screen_capture"));
  assert.ok(PLAYBOOK.navigate.order.length >= 4);
  assert.ok(PLAYBOOK.boot.some((step) => step.includes("context")));
  assert.ok(PLAYBOOK.oneToOne.do.length >= 4);
  assert.ok(PLAYBOOK.lotlTools.studio.includes("lotl_note"));
  assert.ok(PLAYBOOK.lotlTools.studio.includes("lotl_inbox"));
  assert.ok(PLAYBOOK.lotlTools.studio.includes("lotl_say"));
  assert.ok(PLAYBOOK.loop.some((step) => step.includes("lotl_inbox")));
  assert.match(PLAYBOOK.build.move, /transform/);
  assert.match(PLAYBOOK.build.size, /size/);
  assert.ok(PLAYBOOK.build.marketplace.some((step) => step.includes("insert_asset")));
  assert.match(PLAYBOOK.computerUse.when, /last resort|Only after/i);
  assert.match(PLAYBOOK.hosts.claudeCode, /mcp\.json/);
  assert.match(PLAYBOOK.hosts.codex, /config\.toml/);
});

test("official catalog covers the first-party tools from Cursor's MCP panel", () => {
  const names = OFFICIAL_STUDIO_TOOLS.map((t) => t.mcp);
  for (const tool of [
    "upload_image",
    "multi_edit",
    "start_stop_play",
    "get_console_output",
    "user_mouse_input",
    "character_navigation",
    "get_studio_state",
    "generate_procedural_model",
    "user_keyboard_input",
    "generate_mesh",
    "execute_luau",
    "generate_material",
    "search_asset",
    "screen_capture",
    "insert_asset",
    "generate_texture",
  ]) {
    assert.ok(names.includes(tool), `missing ${tool}`);
  }
  assert.ok(REQUIRED_OFFICIAL_TOOLS.includes("screen_capture"));
  assert.ok(COMPANION_SKILLS.some((pack) => pack.name.includes("blender-skills")));
  assert.ok(COMPANION_SKILLS.some((pack) => pack.name.includes("roblox-game-skill")));
});
