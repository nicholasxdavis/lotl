import { readFileSync } from "node:fs";
import path from "node:path";

function inboxContext() {
  try {
    const file = path.join(process.cwd(), "place", ".lotl", "operator-inbox.json");
    const raw = JSON.parse(readFileSync(file, "utf8"));
    const pending = Array.isArray(raw.pending) ? raw.pending : [];
    const texts = pending.map((line) => String(line?.text ?? "").trim()).filter(Boolean);
    if (!texts.length) return "";
    return `Lotl Studio pane inbox (operator typed these in the plugin, not Cursor chat):\n${texts.map((text) => `- ${text}`).join("\n")}\nReply in the pane with lotl_say.`;
  } catch {
    return "";
  }
}

let sent = false;
function reply() {
  if (sent) return;
  sent = true;
  const extra = inboxContext();
  process.stdout.write(`${JSON.stringify(extra ? { additional_context: extra } : {})}\n`);
}

const chunks = [];
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => chunks.push(chunk));
process.stdin.on("end", reply);
setTimeout(reply, 1500);
