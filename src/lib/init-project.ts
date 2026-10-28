import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { emptyConfig, writeConfig, type SyncKind } from "../config.ts";

const PROJECT_JSON = `{
  "name": "{{NAME}}",
  "tree": {
    "$className": "DataModel",
    "ReplicatedStorage": {
      "$className": "ReplicatedStorage",
      "Shared": { "$path": "src/shared" }
    },
    "ServerScriptService": {
      "$className": "ServerScriptService",
      "Server": { "$path": "src/server" }
    },
    "StarterPlayer": {
      "$className": "StarterPlayer",
      "StarterPlayerScripts": {
        "$className": "StarterPlayerScripts",
        "Client": { "$path": "src/client" }
      }
    },
    "StarterGui": {
      "$className": "StarterGui",
      "$path": "src/ui"
    }
  }
}
`;

const SERVER = `--!strict
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("Hello"))

print("[lotl] server started", Shared.hello())
`;

const CLIENT = `--!strict
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("Hello"))

print("[lotl] client started", Shared.hello())
`;

const HELLO = `--!strict
local Hello = {}

function Hello.hello(): string
	return "lotl"
end

return Hello
`;

const MONETIZATION = `--!strict
-- IDs are filled by \`lotl billing\`. Keep this module as the single source of product IDs.
export type Product = {
	id: number,
	name: string,
	kind: "product" | "pass",
}

local Monetization = {
	products = {} :: { [string]: Product },
	passes = {} :: { [string]: Product },
}

return Monetization
`;

const HUD = `--!strict
local Players = game:GetService("Players")

local player = Players.LocalPlayer
local gui = Instance.new("ScreenGui")
gui.Name = "LotlHud"
gui.ResetOnSpawn = false
gui.IgnoreGuiInset = true
gui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling

local pad = Instance.new("TextLabel")
pad.Name = "Status"
pad.BackgroundTransparency = 1
pad.Size = UDim2.fromOffset(280, 24)
pad.Position = UDim2.new(0, 16, 1, -40)
pad.Font = Enum.Font.Gotham
pad.TextSize = 16
pad.TextXAlignment = Enum.TextXAlignment.Left
pad.TextColor3 = Color3.fromRGB(239, 206, 250)
pad.Text = "lotl"
pad.Parent = gui

gui.Parent = player:WaitForChild("PlayerGui")
`;

const ROKIT = `[tools]
argon = "argon-rbx/argon@2.0.25"
rojo = "rojo-rbx/rojo@7.5.1"
selene = "Kampfkarren/selene@0.29.0"
stylua = "JohnnyMorganz/stylua@2.1.0"
lune = "lune-org/lune@0.10.4"
rbxcloud = "Sleitnick/rbxcloud@0.17.0"
`;

const SELENE = `std = "roblox"
`;

const GITIGNORE = `/sourcemap.json
/*.rbxl
/*.rbxlx
/Packages
/DevPackages
/.lotl-cache
`;

const AGENTS = `# AGENTS

This is a Lotl Roblox place. Disk is the source of truth for scripts. Studio is the runtime.

1. \`lotl_ready\` then official \`list_roblox_studios\` then \`lotl_studio\` method \`context\`
2. Edit Luau under \`src/\`. Do not \`multi_edit\` those scripts.
3. Official MCP for tree, playtest, screen_capture, insert_asset
4. \`lotl_studio\` for transform, create/destroy, camera, logs, notes
5. Marketplace: search, ask if scripts, insert, parent/transform, capture
6. Screenshot after UI, transform, or playtest. Ask before publish, sale, or scripted toolbox inserts.
7. \`lotl check\` after code changes
8. Computer Use is last resort, never for DataModel or files

## Layout

- \`src/server\` ServerScriptService
- \`src/client\` StarterPlayerScripts
- \`src/shared\` ReplicatedStorage
- \`src/ui\` StarterGui
- \`src/shared/Monetization.luau\` pass and product IDs
`;

function write(root: string, rel: string, contents: string): void {
  const full = path.join(root, rel);
  mkdirSync(path.dirname(full), { recursive: true });
  writeFileSync(full, contents, "utf8");
}

export function initProject(input: {
  dir: string;
  name: string;
  sync: SyncKind;
  force?: boolean;
}): { dir: string; created: string[] } {
  const root = path.resolve(input.dir);
  mkdirSync(root, { recursive: true });
  const created: string[] = [];

  const put = (rel: string, contents: string) => {
    const full = path.join(root, rel);
    if (existsSync(full) && !input.force) return;
    write(root, rel, contents);
    created.push(rel);
  };

  const config = emptyConfig(input.name);
  config.sync = input.sync;
  writeConfig(config, root);
  created.push("lotl.json");

  put("default.project.json", PROJECT_JSON.replaceAll("{{NAME}}", input.name));
  put("src/server/init.server.luau", SERVER);
  put("src/client/init.client.luau", CLIENT);
  put("src/shared/Hello.luau", HELLO);
  put("src/shared/Monetization.luau", MONETIZATION);
  put("src/client/Hud.client.luau", HUD);
  put(
    "src/ui/init.meta.json",
    `{
  "className": "Folder"
}
`,
  );
  put("rokit.toml", ROKIT);
  put("selene.toml", SELENE);
  put(".gitignore", GITIGNORE);
  put("AGENTS.md", AGENTS);

  return { dir: root, created };
}
