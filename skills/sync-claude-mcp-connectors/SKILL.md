---
name: sync-claude-mcp-connectors
description: "Sync the user's claude.ai MCP connectors (for example EODHD, Notion, Microsoft 365) into OMP's ~/.omp/agent/mcp.json via omp-claude-bridge. Use when asked to sync, refresh or import Claude connectors into OMP."
---

# Sync claude.ai connectors into OMP

The script ships with this plugin. It replaces every `claude-ai-*` entry in `~/.omp/agent/mcp.json` with the account's current connectors and leaves all other entries alone. For each connector with server instructions it writes the full text to an on-demand skill `~/.omp/agent/skills/claude-ai-<name>/SKILL.md` and sets `instructions: false` on the entry (unless the entry already sets `instructions`).

1. Run, in `bash` (this skill's directory is `skill://sync-claude-mcp-connectors`; the script is two levels up):
   ```bash
   bun "$(realpath skill://sync-claude-mcp-connectors)/../../src/claude-mcp-sync.ts" sync
   ```
   It prints `add` / `keep` / `drop` / `skip` per connector and `skill` per instructions skill written or removed. A `skip` line names a connector the account cannot use, with the reason. A `warn` line means a connector's initialize failed; its existing skill was left as is.
2. Report the printed lines to the user and tell them to run `/mcp reload` in each open OMP session. New sessions pick up the entries and skills automatically.

## If it fails
- `no claude.ai login`: the user must run `claude auth login` (Claude Code), then sync again.
- HTTP 401 from `api.anthropic.com/v1/mcp_servers`: the token has expired and `claude mcp list` could not refresh it. Run `claude mcp list`, then sync again.
- A connector shows up in OMP but its calls fail: run the same script with `token >/dev/null && echo ok` instead of `sync` to check the token path. The proxy (`mcp-proxy.anthropic.com/v1/mcp/<id>`) needs the `X-Mcp-Client-Session-Id` header that the sync writes; do not remove it.

Do not refresh the Claude OAuth token directly with its refresh token. That rotates it and races Claude Code's own writes to `~/.claude/.credentials.json`. Do not hand-edit the generated `claude-ai-*` skills; the next sync overwrites them.
