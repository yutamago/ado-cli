# Azure DevOps CLI for Agents

A minimal CLI to access information from Azure DevOps.
Optimized for agentic use cases, very similar commands to Github CLI and low token usage.

This CLI should enable a GitHub user to use Azure DevOps immediately.

This repository is a VERY EARLY WIP. Proposing sweeping changes that improve long-term maintainability is encouraged.

Update `CLAUDE.md` as the project evolves.

## Project Structure

```
src/
  index.ts               # CLI entry point, Commander root, DEP0169 suppression
  api/
    client.ts            # WebApi factory; credential priority: SYSTEM_ACCESSTOKEN > AZURE_DEVOPS_TOKEN > stored
    workItems.ts         # Work item CRUD, comments, branch linking
    pullRequests.ts      # PR listing, diff, review, threads
    builds.ts            # Pipeline run list/view/cancel/rerun/download/delete
    search.ts            # Code (Azure Search REST), commits, repos (client-side filter)
  auth/
    store.ts             # Keytar + ~/.azd/credentials.json fallback
    oauth.ts             # MSAL OAuth2 (browser + device-code flows)
  commands/
    auth/                # login, logout, status
    issue/               # list, view, create, edit, close, reopen, comment, status, develop
    pr/                  # list, view, comment, diff, create, review
    run/                 # list, view, watch, cancel, rerun, download, delete
    search/              # issues, code, commits, prs, repos, projects
    repo/                # list, clone
    completion.ts        # Shell completions (bash/zsh/fish/powershell)
  config/index.ts        # Config load: CLI > env > git remote > ~/.azd/config.json
  output/index.ts        # TTY/non-TTY formatting, table, detail, JSON
  errors/index.ts        # AzdError, AuthError, NotFoundError, ConfigError
```

## Authentication Architecture

Credential resolution order in `src/api/client.ts`:
1. `SYSTEM_ACCESSTOKEN` env var — Azure Pipelines built-in token
2. `AZURE_DEVOPS_TOKEN` env var — explicit PAT for scripts/CI
3. Stored credential (OAuth token or PAT) — persisted across sessions

OAuth uses MSAL `PublicClientApplication` with browser redirect (loopback), falling back to device-code for headless environments. Tokens are stored via keytar (native credential manager) with `~/.azd/credentials.json` as a file fallback.

Config location: `~/.azd/` (`config.json`, `credentials.json`, `oauth-cache.json`)

## Configuration Resolution Order

CLI flags → environment variables → git remote (auto-detect org/project) → `~/.azd/config.json`

Environment variables: `AZURE_DEVOPS_TOKEN`, `SYSTEM_ACCESSTOKEN`, `AZURE_DEVOPS_ORG`, `AZURE_DEVOPS_PROJECT`

Git remote formats supported:
- `https://dev.azure.com/{org}/{project}/_git/{repo}`
- `https://{org}.visualstudio.com/{project}/_git/{repo}`
- `git@ssh.dev.azure.com:v3/{org}/{project}/{repo}`

## Output & Agent Compatibility

- **TTY**: styled tables (cli-table3), colored state labels
- **non-TTY**: tab-separated plain text — machine-readable, agent-compatible
- `--json` flag available on most commands for structured output
- `--web` / `-w` flag available on most list/view commands to open in browser

## Task Tracking

- **Always check TODO.md** before starting work
- **Update TODO.md** as tasks are completed (`[x]`), started (`[~]`), or skipped (`[-]`)
- Keep TODO.md as the single source of truth for project status

## Keeping the Plugin Reference Up to Date

`plugins/azd/skills/azd-cli/reference.md` is the authoritative CLI reference used by the ado plugin skill.

**Update it whenever you:**
- Add, rename, or remove a command or subcommand
- Add, rename, remove, or change the default of any flag
- Change the short alias of a flag (e.g. `-s`, `-a`)
- Change flag behavior (e.g. making a flag repeatable, changing accepted values)
- Add or remove global flags

Keep the reference in sync with the source — it is generated from the actual `commander` registrations in `src/commands/**/*.ts`.

## Core Principles

- `azd` commands should work the same as their `gh` counterparts, unless the Azure DevOps API makes this impossible.
- If the user uses an unrecognized command, return a clear message explaining the wrong usage and how to properly use the command.
- The core target audience for this CLI is Agents (such as Claude and GitHub Copilot).

## Known Issues

- **DEP0169**: Upstream deprecation warning from `azure-devops-node-api` (uses `url.parse()`). Suppressed in `src/index.ts` by intercepting `process.emit('warning')`. Tracked at [azure-devops-node-api#664](https://github.com/microsoft/azure-devops-node-api/issues/664).

## References

- [GitHub CLI manual](https://cli.github.com/manual/)
- [Azure DevOps API TypeScript client library](https://github.com/microsoft/azure-devops-extension-api)
- [azure-devops-node-api](https://github.com/microsoft/azure-devops-node-api)
