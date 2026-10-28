---
name: lotl
description: Drive Roblox Studio and build full games through Lotl. Use when the user wants Roblox, Luau, Studio, playtests, UI, world layout, marketplace inserts, game passes, Open Cloud, or to set up Cursor, Claude Code, or Codex with Lotl.
---

# Lotl

Lotl (axolotl) is the harness, MCP server, and Studio plugin beside official `Roblox_Studio`. The operator talks in the Studio pane. Call `lotl_playbook` if you need the full table. Two servers must be connected.

## Setup

```bash
npm install
npm run lotl -- setup
```

Writes `.cursor/mcp.json`, `.mcp.json` (Claude Code), `.codex/config.toml` (Codex, trust the project), `.vscode/mcp.json`. Installs the Studio plugin. Restart Studio. Reload MCP. `lotl_ready` until `pluginLive` is true.

## Boot

```
lotl_ready
list_roblox_studios   # pass studio_id on every official tool
lotl_studio method=context
lotl_inbox            # pane → agent (poll every loop)
lotl_say              # agent → pane
lotl_note             # short progress lines
```

## 1-1 build map

| Job | Tool |
| --- | --- |
| Commands / Luau | `execute_luau` (studio_id, Edit/Client/Server). Fallback `lotl_studio` `eval` |
| Move | `lotl_studio` `transform` position or offset |
| Size | `transform` size. Models: scale |
| Rotate | `transform` lookAt or cframe |
| Create | `lotl_studio` `create` then `transform` |
| CSG | `union` / `separate` / `negate` / `intersect` |
| Editor buffer | `script_document` / `write_document`. Disk owns `place/src` |
| Files | Disk tools on `place/src`. Never `multi_edit` synced scripts |
| Marketplace | `search_asset` or `lotl_marketplace_search` → ask if scripts → `insert_asset` → parent/transform → `screen_capture` |
| Play | `start_stop_play`, capture, `character_navigation`, `get_console_output` |
| UI | `src/ui` or create under StarterGui, then capture |

## Computer Use

Last resort. Do not use it to move parts, edit files, or playtest. Prefer APIs. Use it only for OS/Studio chrome that has no MCP tool after `screen_capture` failed twice.

## Ask first

Publish, on-sale products, DataStore wipes, scripted toolbox inserts, login, which place when several are open.

## Do not

- Invent a second Studio MCP
- `multi_edit` `place/src`
- Print `ROBLOX_API_KEY`
- Click account billing
- Put products on sale from MCP
