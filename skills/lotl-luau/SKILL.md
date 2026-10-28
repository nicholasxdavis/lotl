---
name: lotl-luau
description: Write Roblox Luau that matches luau.org style and performance, not generic AI slop. Use when authoring or reviewing place/src scripts.
---

# Luau that ships

Lotl checks disk with `lotl_check` when selene/stylua/rojo exist. Follow this even when they do not.

## File header

Every module under `place/src`:

```luau
--!strict
```

Use `--!native` only when you measured a hot path and know why.

## Structure

- One responsibility per module. `shared` for types and constants, `server` for authority, `client` for input and UI.
- No `_G` game state. No `require` from random descendants; use explicit paths and `WaitForChild` at boot boundaries only.
- Prefer `task.wait` / `task.defer` over `wait()`. Never busy-loop without `task.wait()`.

## Types

- Export tables as modules with typed fields. Use `export type` for shared shapes.
- Annotate function returns on public APIs. Let locals infer when obvious.
- Use `Enum` and `typeof()` instead of magic strings for instance classes when it helps.

## Performance (from luau.org)

- Hoist constants out of loops. Cache `game:GetService` in locals at module top.
- Prefer numeric `for i = 1, n` over `for _, v in list` on hot paths.
- Reuse tables; avoid allocating every heartbeat.
- Do not string-concat in tight loops; use `table.create` + `table.concat` when building big text.

## Roblox idioms

- Server owns data and validation. Client asks with remotes; never trust the client for currency or hits.
- Disconnect connections in `Destroying` or when a UI closes.
- Use `CollectionService` tags for gameplay markers instead of hunting by name in Workspace.

## AI slop to reject

- Giant single Script with nested anonymous functions and no modules.
- `wait(1)` polling for game state instead of events or `:GetPropertyChangedSignal`.
- `Instance.new` spam every frame.
- Comments that restate the code line by line.
- `print` debugging left in shipping code; use structured logging or remove.

## Before playtest

`lotl_studio method=syntax` on new snippets, then `lotl check` on disk files.
