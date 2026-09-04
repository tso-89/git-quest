# MCP Server Configuration

> `.mcp.json` must be **strict JSON** — no comments. Copy a block from below into the
> `mcpServers` object rather than uncommenting inline.

Verify active servers with `claude mcp list`.

## Filesystem

Read/write access to specific directories.

```json
"filesystem": {
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-filesystem", "./src"]
}
```

## GitHub

Read repos, issues, and PRs. Requires a `GITHUB_TOKEN` environment variable.

```json
"github": {
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-github"],
  "env": { "GITHUB_TOKEN": "${GITHUB_TOKEN}" }
}
```

## PostgreSQL

Read-only database access for schema and query help.

```json
"postgres": {
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-postgres", "${DATABASE_URL}"]
}
```

## Per-Platform Locations

| Platform | Project-level MCP config |
|----------|--------------------------|
| Claude Code | `.mcp.json` |
| OpenCode | `mcp` key in `opencode.json` |
| Codex | `~/.codex/config.toml` (user-level only) |
| Antigravity | Configured through the IDE |

Never commit credentials. Reference environment variables with `${VAR}` and document them
in `.env.example`.
