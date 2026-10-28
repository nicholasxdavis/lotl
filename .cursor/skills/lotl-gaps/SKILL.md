---
name: lotl-gaps
description: What Lotl still cannot do in Studio and the fallback. Use when a request hits Animation Editor, Texture Generator UI, publish, or a missing MCP tick.
---

# Gaps and fallbacks

Lotl plus official MCP cover almost all agent work. These still need the operator or a different tool.

| Gap | Fallback |
| --- | --- |
| `screen_capture` disabled in the MCP tool list | Ask the operator to enable it. Do not skip visual checks. |
| Animation Editor authoring | Ask. Open Cloud cannot upload new animations. |
| Texture Generator window if `generate_texture` is missing | Select mesh, ask operator, or use `generate_material` |
| Publish / uncopylock | Ask. Open Cloud place publish after they confirm. |
| Live DataStore wipe | Ask. Never. |
| Multiplayer playtest | Official MCP is solo. Say so. Use two Studio windows only if the operator opens them. |
| `execute_luau` cannot require modules | `lotl_studio` eval in plugin security |
| Script Sync vs Argon fighting MCP edits | Disk is source of truth. Stop `multi_edit` on synced scripts. |
| OS dialog or Studio chrome with no MCP tool | Computer Use last resort, after `screen_capture` failed twice. Never for DataModel or billing. |

If an official tool from `lotl_studio_catalog` is unchecked in Cursor, name it and ask the operator to tick it. Do not click through Studio's MCP settings yourself unless `user_mouse_input` plus `screen_capture` clearly show that panel.
