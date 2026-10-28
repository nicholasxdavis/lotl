---
name: lotl-companions
description: Which extra Roblox agent skill packs to load with Lotl. Use when you need Luau idioms, security, UI, Knit/Rojo layout, or current API replacements.
---

# Companion skills

Lotl owns the bridge (Studio pane, MCP routing, checks, cloud, billing). Domain knowledge should load from these packs, not be reinvented. The `lotl` binary is setup and MCP stdio, not a terminal you sit in.

Install beside Lotl (Cursor `-a cursor`, Claude Code `-a claude` when the CLI supports it). Codex reads `AGENTS.md` and `skills/` in this repo.

```bash
npx skills add EL4CTEO/roblox-skills -a cursor -y
npx skills add TabooHarmony/roblox-brain -a cursor -y
npx skills add afrxo/roblox-agent-skills -a cursor -y
```

| Pack | Load when |
| --- | --- |
| EL4CTEO/roblox-skills | Current APIs, security, networking, UI, testing, studio-mcp |
| TabooHarmony/roblox-brain | Gameplay systems, design, Open Cloud, publishing |
| afrxo/roblox-agent-skills | Strict Luau, Rojo/Wally/Pesde, Fusion UI |
| dig1t/skills | Types, optimizer, Rojo pro |
| m4bwav/roblox-agent | Verification ladder and CI checks |

Do not copy those repos into Lotl. Call `lotl_playbook` for the bridge, then the matching companion skill for Luau/design.

Do not vendor leaked Roblox client or Studio source (for example Artifaqt/ROBLOX2016). It is stale, unsafe, and unrelated to modern Luau and Studio MCP. Lotl uses Creator Hub docs, the official Studio MCP, Client Tracker Mini API dump, and [luau.org](https://luau.org/) only. For disk Luau style, load `skills/lotl-luau`.
