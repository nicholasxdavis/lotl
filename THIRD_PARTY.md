# Third-party sources Lotl takes from

Lotl is original glue. These projects are the public pieces it wraps or copies patterns from. They are not vendored into this repo.

| Project | License (as published) | What we take |
| --- | --- | --- |
| Roblox Studio built-in MCP | Roblox | Live Studio tool surface. We connect, we do not reimplement. |
| [Roblox/roblox-studio-agent-plugin](https://github.com/Roblox/roblox-studio-agent-plugin) | MIT | Setup walkthrough, one official MCP entry, skills-not-runtime |
| [Roblox/studio-rust-mcp-server](https://github.com/Roblox/studio-rust-mcp-server) | MIT, archived | Plugin long-polls localhost. Studio cannot accept inbound HTTP. |
| [argon-rbx/argon](https://github.com/argon-rbx/argon) | MPL-2.0 | Default filesystem sync. Two-way sync, Rojo-compatible projects. |
| [rojo-rbx/rojo](https://github.com/rojo-rbx/rojo) | MPL-2.0 | Fallback build/serve, `default.project.json` shape |
| [Sleitnick/rbxcloud](https://github.com/Sleitnick/rbxcloud) | MPL-2.0 | Open Cloud command surface: universe, place, luau execute, assets |
| [Roblox/rocale-cli](https://github.com/Roblox/rocale-cli) | Roblox | OCALE run loop: build/load place, execute script, poll logs |
| [MaximumADHD/Roblox-Client-Tracker](https://github.com/MaximumADHD/Roblox-Client-Tracker) | public data | `Mini-API-Dump.json` for class/enum lookup |
| [Chrrxs/robloxstudio-mcp](https://github.com/Chrrxs/robloxstudio-mcp) | MIT | Auto-install plugin, live eval, monetization, instance launch |
| [m4bwav/roblox-agent](https://github.com/m4bwav/roblox-agent) | MIT | One writer per script, JSON check reports, key never on argv |
| [swlittles/roblox-studio-mcp](https://github.com/swlittles/roblox-studio-mcp) | (see repo) | CLI parity with MCP tools |
| Roblox Open Cloud developer products / game passes | Roblox | Billing APIs |

| [EL4CTEO/roblox-skills](https://github.com/EL4CTEO/roblox-skills) | MIT | Companion agent skills (current APIs, security, studio-mcp) |
| [TabooHarmony/roblox-brain](https://github.com/TabooHarmony/roblox-brain) | MIT | Companion skills (gameplay, design, Open Cloud) |
| [afrxo/roblox-agent-skills](https://github.com/afrxo/roblox-agent-skills) | MIT | Strict Luau, Rojo/Wally/Pesde, Fusion UI |
| [dig1t/skills](https://github.com/dig1t/skills) | (see repo) | luau-type-expert, rojo-pro |

Install Argon, Rojo, Selene, StyLua, Lune, and rbxcloud through Rokit. Install companion skills with `npx skills add`. Do not vendor those repos into Lotl.
