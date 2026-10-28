import assert from "node:assert/strict";
import { test } from "node:test";
import {
  appendAgentMessage,
  appendOperatorMessage,
  chatSince,
  drainOperatorMessages,
  lastChatLine,
  peekOperatorMessages,
  resetChat,
  waitForOperatorMessages,
} from "../src/lib/chat.ts";

test("operator messages drain into agent inbox", () => {
  resetChat();
  appendOperatorMessage("build an obby");
  assert.equal(peekOperatorMessages().length, 1);
  const drained = drainOperatorMessages();
  assert.equal(drained.length, 1);
  assert.equal(drained[0].text, "build an obby");
  assert.equal(drainOperatorMessages().length, 0);
});

test("agent lines land in transcript for pane poll", () => {
  resetChat();
  const line = appendAgentMessage("on it");
  const since = line.at - 1;
  const feed = chatSince(since);
  assert.equal(feed.length, 1);
  assert.equal(feed[0].role, "agent");
});

test("lastChatLine tracks the transcript tail", () => {
  resetChat();
  appendOperatorMessage("one");
  assert.equal(lastChatLine()?.text, "one");
});

test("duplicate operator lines within 2s collapse", () => {
  resetChat();
  const first = appendOperatorMessage("same");
  const second = appendOperatorMessage("same");
  assert.equal(first.id, second.id);
  assert.equal(peekOperatorMessages().length, 1);
});

test("waitForOperatorMessages resolves when a pane message arrives", async () => {
  resetChat();
  setTimeout(() => appendOperatorMessage("hello from studio"), 40);
  const messages = await waitForOperatorMessages(2000);
  assert.equal(messages.length, 1);
  assert.match(messages[0].text, /studio/);
});
