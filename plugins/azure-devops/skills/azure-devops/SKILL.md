---
name: azure-devops
description: >
  Use this skill when the user asks to interact with Azure DevOps via the ado CLI.
  Triggers on tasks like: "list issues", "list work items", "create a work item",
  "view a work item", "create a bug", "edit an issue", "close an issue",
  "view a pull request", "create a PR", "approve a PR", "reject a PR",
  "list pipeline runs", "watch a build", "cancel a run", "rerun a pipeline",
  "download artifacts", "search code", "search commits", "search repos",
  "clone a repo", "list repositories", "auth login", "auth status",
  or any direct ado command invocation (ado issue, ado pr, ado run, ado search,
  ado repo, ado auth, ado completion).
---

# ado CLI Skill

`azd` is an Azure DevOps CLI optimized for agentic use. It mirrors GitHub CLI (`gh`) conventions so commands map predictably. All commands are non-interactive by default; TTY output is styled tables, non-TTY output is tab-separated plain text (pipeline-safe). Use `--json` for structured JSON.

## Availability Check

Before running any `azd` command, verify the tool is available:

```bash
ado --version
```

If the command is not found, do NOT attempt to install it. Instead, use AskUserQuestion (if available) to ask the user to install it, or inform them with a clear message:

> `azd` is not installed. Install it with: `npm install -g azd-cli`

## Authentication

Credential resolution order (highest to lowest priority):

1. `SYSTEM_ACCESSTOKEN` env var — Azure Pipelines built-in token (CI)
2. `AZURE_DEVOPS_TOKEN` env var — explicit PAT for scripts/CI
3. Stored credential from `ado auth login` (OAuth token or PAT)

### Login

```bash
ado auth login                          # OAuth browser flow (default)
ado auth login --with-token             # PAT via stdin: echo $PAT | ado auth login --with-token
ado auth login --token <pat>            # PAT inline
ado auth login --org <url>             # Specify org URL at login time
```

After login, select a default project interactively, or set env vars:

```bash
export AZURE_DEVOPS_ORG=https://dev.azure.com/myorg
export AZURE_DEVOPS_PROJECT=my-project
```

Check current auth state:

```bash
ado auth status --json
```

## Configuration Resolution Order

CLI flags → environment variables → git remote (auto-detect) → `~/.azd/config.json`

Git remote formats supported: `https://dev.azure.com/{org}/{project}/_git/{repo}`, `https://{org}.visualstudio.com/{project}/_git/{repo}`, `git@ssh.dev.azure.com:v3/{org}/{project}/{repo}`

## Global Flags

Available on every command:

| Flag | Description |
|------|-------------|
| `--org <url>` | Override organization URL |
| `-p, --project <name>` | Override project |
| `--json [fields]` | Output as JSON; optionally filter fields: `--json id,title,state` |
| `-w, --web` | Open result in browser (avoid in headless/CI) |

## Issues (Work Items)

| Command | Description |
|---------|-------------|
| `ado issue list` | List work items (`-s`, `-a`, `-l`, `-t`, `--limit`) |
| `ado issue view <id>` | Work item details (`--comments`) |
| `ado issue create` | Create work item (`-t` required, `--type`, `-b`, `-a`, `-l`) |
| `ado issue edit <id>` | Update fields (`-t`, `-b`, `-s`, `-a`, `-l`) |
| `ado issue close <id>` | Set state to Closed/Resolved |
| `ado issue reopen <id>` | Set state back to Active |
| `ado issue comment <id>` | Add comment (`-b` or `--editor`) |
| `ado issue status` | Work items assigned to / created by you |
| `ado issue develop <id>` | Create branch linked to work item |

### Common patterns

```bash
# List open bugs assigned to yourself
ado issue list --state open --type Bug --assignee @me

# Create a bug
ado issue create --title "Login fails on Safari" --type Bug --assignee user@org.com

# Link a work item to a branch and start development
ado issue develop 42
git checkout workitem/42-login-fails-on-safari

# Close after resolution
ado issue close 42
```

## Pull Requests

| Command | Description |
|---------|-------------|
| `ado pr list` | List PRs (`-s`, `-a`, `-r`, `--limit`, `--draft`) |
| `ado pr view <id>` | PR details (`--comments`) |
| `ado pr comment <id>` | Add comment (`-b` or `--editor`) |
| `ado pr diff <id>` | Unified diff (`--name-only`, `--exclude`, `--color`) |
| `ado pr create` | Create PR (`-t`, `-b`, `-B`, `-H`, `-d`, `-a`) |
| `ado pr review <id>` | Approve/reject/request changes |

### Common patterns

```bash
# Create a PR from current branch
ado pr create --title "Fix Safari login" --body "Closes #42" --reviewer alice@org.com

# Review diff before approving
ado pr diff 17 --name-only
ado pr diff 17

# Approve
ado pr review 17 --approve

# Request changes
ado pr review 17 --request-changes --body "Needs a unit test"
```

## Pipeline Runs

| Command | Description |
|---------|-------------|
| `ado run list` | List recent runs (`--status`, `--branch`, `--limit`) |
| `ado run view <id>` | Run details |
| `ado run watch <id>` | Stream live status until completion |
| `ado run cancel <id>` | Cancel an in-progress run |
| `ado run rerun <id>` | Re-queue a completed/failed run |
| `ado run download <id>` | Download build artifacts (`-n`, `-D`) |
| `ado run delete <id>` | Delete pipeline run record (`--yes`) |

### Common patterns

```bash
# Monitor a run in progress
ado run watch 9801

# Download artifacts from a completed run
ado run download 9801 --dir ./artifacts

# Retry a failed run
ado run rerun 9801
```

## Search

| Command | Description |
|---------|-------------|
| `ado search issues <query>` | Search work items via WIQL |
| `ado search code <query>` | Search code via Azure Search REST API |
| `ado search commits <query>` | Search commits (client-side filter) |
| `ado search prs <query>` | Search PRs (client-side filter) |
| `ado search repos <query>` | List/filter repositories |
| `ado search projects <query>` | List/filter Azure DevOps projects |

```bash
ado search issues "memory leak" --state open
ado search code "AuthController" --repo backend-api --limit 10
ado search prs "hotfix"
```

## Repositories

```bash
ado repo list
ado repo clone my-repo
ado repo clone my-repo ./local-dir
```

## Output & Agent Compatibility

- Non-TTY (piped) context: output is tab-separated — safe to parse with `awk`/`cut`.
- `--json` for structured data. Fields filterable: `--json id,title,state`.
- `--web` opens the item in the Azure DevOps browser UI — avoid in headless/CI.
- Exit code is non-zero on all errors. Stderr receives error messages; stdout is clean output only.

## Error Types

| Error | Cause | Resolution |
|-------|-------|------------|
| `ConfigError` | No org/project configured | Run `ado auth login` or set env vars |
| `AuthError` | Token invalid/expired | Re-run `ado auth login` |
| `NotFoundError` | Item ID not found in project | Verify the ID and active project |

## Full Flag Reference

For the complete flag inventory (every flag, short alias, default, and accepted values for every subcommand), read:

`${CLAUDE_PLUGIN_ROOT}/skills/azd-cli/reference.md`
