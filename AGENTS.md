# AGENTS

Lotl (axolotl) is an all-in-one harness, MCP server, and Roblox Studio plugin. It bridges Cursor, Claude Code, Codex, and any MCP client to a live Studio place: files, configuration, UI, marketplace, billing, playtesting, and Open Cloud. Two servers must be connected: `lotl` and `Roblox_Studio`. Do not invent a third Studio MCP. The operator works in the Studio pane, not a terminal TUI.

Call `lotl_playbook` when you need the full routing table. Follow this file on every session.

## Setup (once)

```bash
npm install
npm run lotl -- setup
```

That inits `place/` if needed, installs the Lotl Studio plugin, and writes MCP configs for every host:

| Host | File |
| --- | --- |
| Cursor | `.cursor/mcp.json` |
| Claude Code | `.mcp.json` |
| Codex | `.codex/config.toml` (trust the project) |
| VS Code / Copilot | `.vscode/mcp.json` |

Then:

1. Roblox Studio: Assistant, Manage MCP Servers, Enable Studio as MCP server, Quick connect if you use Cursor.
2. Restart Studio so the Lotl widget loads. Keep it on connected.
3. Reload MCP in your agent app.
4. Optional cloud: `ROBLOX_API_KEY` in the environment. Never print it.

`lotl ready` must show `pluginLive: true` before you build.

## Boot (every session)

1. `lotl_ready`
2. Official `list_roblox_studios`. Pass `studio_id` on every `Roblox_Studio` tool.
3. `lotl_studio` method `context` (selection, camera, open scripts, lighting, fingerprint)
4. If more than one Studio window is open, ask which place.
5. `lotl_inbox` then `lotl_say` so Studio pane chat reaches you; `lotl_note` for short progress lines.

## Build a full game

You already have end to end coverage. Use the API. Do not click Explorer to move a part.

| Job | How |
| --- | --- |
| Run Luau | `execute_luau` with `studio_id` and Edit/Client/Server. If `require` fails, `lotl_studio` method `eval` |
| Move in world | `lotl_studio` method `transform` `position` or `offset` |
| Size | `transform` `size={x,y,z}`. Models: `scale` |
| Rotate | `transform` `lookAt` or `cframe` |
| Create instances | `lotl_studio` method `create`, then `transform`. Bulk: `execute_luau` in chunks with `task.wait` |
| CSG | `union` / `separate` / `negate` / `intersect` on the selection or `paths` |
| Unsaved script buffer | `script_document` to read, `write_document` to patch via ScriptEditorService. Disk still owns `place/src` |
| Parent / rename / delete | `parent`, `rename`, `destroy` |
| Files and folders | Normal file tools under `place/src`. Argon/Rojo/Script Sync own them |
| Marketplace | `search_asset` or `lotl_marketplace_search`, ask if `hasScripts`, `insert_asset`, then `inspect` / `parent` / `transform`, then `screen_capture` |
| UI | Disk `place/src/ui` or `create` under StarterGui. Capture after every visual change |
| Generate mesh/material | Official `generate_*`, `wait_job_finished`, capture, `transform` into the place |
| Playtest | `start_stop_play`, `screen_capture`, `character_navigation`, `get_console_output` |
| Passes / products | `lotl_billing_create` off sale. IDs in `place/src/shared/Monetization.luau` |

## Writers

One writer per script.

- Disk owns `place/src`. Do not `multi_edit` those files.
- Official MCP owns playtest, `screen_capture`, input, `insert_asset`, generate, inspect.
- `lotl_studio` owns context, transform, create/destroy, camera, logs, undo, notes, tags, unsaved `script_document`.
- Cloud owns published places and billing. Ask before live writes.

## Screenshot

`Roblox_Studio` `screen_capture` after UI, inserts, generation, play, transform that changes the view, and before clicking Studio chrome. If capture fails twice, ask the operator to bring Studio to the front.

## Computer Use

Last resort only. The Cursor Computer Use tool is already enabled. Do not use it for DataModel edits, file moves, playtest movement, login, or billing. Prefer `execute_luau`, `lotl_studio transform`, and official `user_mouse_input` inside Studio. Use Computer Use only when a Studio or OS dialog has no MCP tool and capture cannot get you there.

## Ask

Publish, sale prices, live DataStore, scripted marketplace inserts, login/payment, multiple places, unreadable viewport.

## Studio pane chat

The operator can type in the Lotl widget. MCP cannot push into Cursor chat; you poll `lotl_inbox` (optionally `waitMs`). If that tool is missing, read `place/.lotl/operator-inbox.json`. Reply with `lotl_say` so answers show in Studio.

After a **new Studio window** opens, if `list_roblox_studios` is empty, toggle **Roblox_Studio** MCP off and on in the host (Cursor cannot be restarted from Lotl). If the pane says **token mismatch**, reload the **lotl** MCP and run `lotl plugin install` once.

## After code

`lotl_check`, then playtest if gameplay changed. Read `skills/lotl-luau` before writing Luau on disk.
