import assert from "node:assert/strict";
import { test } from "node:test";
import { interpretHealth } from "../src/bridge/server.ts";

test("200 lotl health is a live Lotl bridge", () => {
  const health = interpretHealth(200, { name: "lotl", pluginConnected: true });
  assert.deepEqual(health, { ok: true, lotl: true, pluginConnected: true });
});

test("200 lotl without plugin is still ours to reuse", () => {
  const health = interpretHealth(200, { name: "lotl" });
  assert.equal(health.ok, true);
  assert.equal(health.lotl, true);
  assert.equal(health.pluginConnected, false);
});

test("401 bad token means another Lotl process owns the port, not a foreign server", () => {
  const health = interpretHealth(401, { error: "bad token" });
  assert.equal(health.ok, true);
  assert.equal(health.lotl, true);
  assert.equal(health.pluginConnected, false);
  assert.equal(health.error, "bad token");
});

test("401 missing-token wording is still Lotl", () => {
  const health = interpretHealth(401, { error: "bridge token missing. run lotl plugin install" });
  assert.equal(health.ok, true);
  assert.equal(health.lotl, true);
});

test("401 from some other local server is not Lotl", () => {
  const health = interpretHealth(401, { error: "unauthorized" });
  assert.equal(health.ok, false);
  assert.equal(health.lotl, undefined);
  assert.equal(health.error, "health 401");
});

test("404 leftover from a dead process is not a Lotl occupant we should reuse", () => {
  const health = interpretHealth(404, { error: "not found" });
  assert.equal(health.ok, false);
  assert.notEqual(health.lotl, true);
  assert.equal(health.error, "health 404");
});

test("200 from an unnamed occupant is not Lotl", () => {
  const health = interpretHealth(200, { pluginConnected: true });
  assert.equal(health.ok, true);
  assert.equal(health.lotl, false);
});

test("500 is a failed probe, never a reuse signal", () => {
  const health = interpretHealth(500, { error: "boom" });
  assert.equal(health.ok, false);
  assert.equal(health.error, "health 500");
});
