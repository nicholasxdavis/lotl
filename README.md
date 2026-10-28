<table>
  <tr>
    <td width="100">
      <img src="https://raw.githubusercontent.com/nicholasxdavis/lotl/main/demo/icon.png" alt="Lotl logo" width="80" />
    </td>
    <td>
      <strong>Lotl</strong> (axolotl) is an all-in-one Harness, MCP server, and Roblox Studio plugin. It bridges agents like Cursor, Claude Code, Codex with a live Studio place, enabling development across files, configuration, UI, marketplace, billing, playtesting, and Open Cloud.
    </td>
  </tr>
</table>

<table>
  <tr>
    <td width="50%">
      <img src="https://raw.githubusercontent.com/nicholasxdavis/lotl/main/demo/screenshot-1.png" alt="Lotl screenshot 1" width="100%" />
    </td>
    <td width="50%">
      <img src="https://raw.githubusercontent.com/nicholasxdavis/lotl/main/demo/screenshot-2.png" alt="Lotl screenshot 2" width="100%" />
    </td>
  </tr>
  <tr>
    <td width="50%">
      <img src="https://raw.githubusercontent.com/nicholasxdavis/lotl/main/demo/screenshot-3.png" alt="Lotl screenshot 3" width="100%" />
    </td>
    <td width="50%">
      <img src="https://raw.githubusercontent.com/nicholasxdavis/lotl/main/demo/screenshot-4.png" alt="Lotl screenshot 4" width="100%" />
    </td>
  </tr>
</table>

The operator surface is the Studio pane. `npm run lotl` stays for one-time setup, plugin install, and MCP stdio. It is not a terminal you sit in.

It does not replace Studio's built-in MCP server. It wraps that server, then adds the pieces Roblox leaves to you.

## What it talks to

| Layer | Job | Source |
| --- | --- | --- |
| Disk | Two-way-friendly place on the filesystem | [Argon](https://github.com/argon-rbx/argon), Rojo-compatible `default.project.json` |
| Live Studio | Tree, playtest, screenshots, Creator Store insert | Official Studio MCP (`StudioMCP.exe`) |
| Extra Studio | Context, transform, create/destroy, camera, logs, undo, eval, notes | Lotl plugin (localhost long-poll) |
| Cloud | Universe, place, headless Luau | [rbxcloud](https://github.com/Sleitnick/rbxcloud), [rocale-cli](https://github.com/Roblox/rocale-cli) |
| Billing | Developer products and game passes | Open Cloud |
| Engine dump | Class and enum lookup | [Roblox-Client-Tracker](https://github.com/MaximumADHD/Roblox-Client-Tracker) |

## Setup

```bash
npm install
npm run lotl -- setup
```

That creates `place/` if needed, installs the Studio plugin, and writes MCP configs for every host:

| Host | Config |
| --- | --- |
| Cursor | `.cursor/mcp.json` |
| Claude Code | `.mcp.json` |
| Codex | `.codex/config.toml` (trust the project) |
| VS Code / Copilot | `.vscode/mcp.json` |

Then, in Studio:

1. Open Assistant.
2. Manage MCP Servers.
3. Turn on Enable Studio as MCP server.
4. Quick connect Cursor if you use Cursor.
5. Restart Studio so the Lotl plugin loads. The widget should read connected.

Reload MCP in your agent app. Confirm with `npm run lotl -- ready` (`pluginLive` true).

Optional, for cloud and billing:

```bash
setx ROBLOX_API_KEY "your-key"
```

Never pass the key as a CLI argument. Never commit it.

Agents read `AGENTS.md`. Claude Code also reads `CLAUDE.md`. Skills live in `skills/lotl`.

## Setup commands

These are for install and agents, not a daily terminal session. After setup, talk in the Lotl Studio pane.

```text
lotl ready               doctor plus live plugin health
lotl playbook            screenshot / ask / navigate / build policy
lotl doctor              environment report (JSON)
lotl setup               init + plugin + MCP for all hosts
lotl init [dir]          Argon/Rojo place template
lotl connect             write Cursor, Claude Code, Codex, VS Code MCP configs
lotl plugin install
lotl check               rojo/argon build, selene, stylua
lotl mcp                 MCP stdio + plugin bridge
lotl serve               plugin bridge only
lotl studio ping
lotl studio transform --path Workspace.Baseplate --position 0,5,0 --size 4,1,2
lotl engine class Part
lotl marketplace search "sword"
lotl cloud universe
lotl cloud luau --script task.luau
lotl billing list
lotl billing create product --name Coins --price 49
```

Every command prints JSON so an agent never has to parse prose.

## How an agent should work

1. `lotl_ready`, then `list_roblox_studios`, then `lotl_playbook`.
2. Disk owns `src/`. Do not `multi_edit` those scripts through Studio MCP.
3. Official `Roblox_Studio` MCP owns playtest, `screen_capture`, input, and `insert_asset`.
4. `lotl_studio` owns context, transform, create/destroy, camera, logs, undo. `lotl_note` writes into the Studio pane.
5. Screenshot after UI, transform, or playtest. Ask before publish, sale, or scripted toolbox inserts.
6. After a code change, `lotl check`.
7. Computer Use is last resort. Never for DataModel, files, or billing.

## Safety

Localhost only. No telemetry. Creator Store inserts should be previewed before parenting. Billing creates items off sale unless you pass `--for-sale`. Live publish is not a default.
