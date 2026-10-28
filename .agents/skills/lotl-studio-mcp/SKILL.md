---
name: lotl-studio-mcp
description: Route every Roblox Studio first-party MCP tool (upload image, edit script, play, console, mouse, keyboard, character nav, generate mesh/material/procedural, execute Luau, search asset, screen capture). Use whenever driving live Studio.
---

# Official Studio MCP

These tools live on the `Roblox_Studio` server. Lotl does not reimplement them. Enable all of them in the MCP tool list. Always pass `studio_id` from `list_roblox_studios`.

## Screenshot after

`generate_mesh`, `generate_material`, `generate_procedural_model`, `generate_texture`, `segment_mesh`, `insert_asset`, `start_stop_play`, `character_navigation`, `user_mouse_input`, `user_keyboard_input` (when visual).

Tool: `screen_capture`. Enable it. If it is missing from the tool list, tell the operator to tick Screen Capture.

## Ask first

`insert_asset` when the model has scripts. Never `multi_edit` files under `place/src`.

## Generation loop

1. `store_image` if you have a local reference
2. `generate_procedural_model` or `generate_mesh` / `generate_material`
3. `wait_job_finished` for procedural
4. `screen_capture`

## Play loop

1. `get_studio_state`
2. `start_stop_play` start
3. `screen_capture`
4. `character_navigation` / keyboard / mouse
5. `get_console_output`
6. Stop play

## Script loop

Disk for `place/src`. `script_read` / `multi_edit` only for unsynced Studio scripts.

## Computer Use

Do not use Computer Use to click the viewport into moving parts. `execute_luau` and `lotl_studio transform` own the DataModel. Official `user_mouse_input` owns Studio chrome. Computer Use is last resort outside that.
