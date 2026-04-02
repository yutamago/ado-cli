# ado CLI — Full Flag Reference

Generated from source at `src/commands/**/*.ts`. Update this file whenever a command or flag is added, renamed, or removed.

---

## ado auth login

| Flag | Short | Description | Default |
|------|-------|-------------|---------|
| `--org <url>` | — | Azure DevOps organization URL | — |
| `--project <name>` | — | Default project name | — |
| `--with-token` | — | Authenticate with a PAT (reads from stdin) | — |
| `--token <token>` | — | PAT value inline (implies `--with-token`) | — |

---

## ado auth logout

| Flag | Short | Description | Default |
|------|-------|-------------|---------|
| `--org <url>` | — | Azure DevOps organization URL | — |

---

## ado auth status

| Flag | Short | Description | Default |
|------|-------|-------------|---------|
| `--org <url>` | — | Azure DevOps organization URL | — |
| `--json [fields]` | — | Output as JSON (optional comma-separated field filter) | — |

---

## ado issue list

| Flag | Short | Description | Default |
|------|-------|-------------|---------|
| `--state <state>` | `-s` | Filter: `open\|closed\|all` | `open` |
| `--assignee <who>` | `-a` | Filter by assignee; use `@me` for yourself | — |
| `--label <tag>` | `-l` | Filter by tag/label | — |
| `--type <type>` | `-t` | Work item type (e.g. `Bug`, `Task`, `User Story`) | — |
| `--limit <n>` | — | Max items to return | `30` |
| `--project <project>` | `-p` | Azure DevOps project (overrides config) | — |
| `--org <url>` | — | Organization URL (overrides config) | — |
| `--json [fields]` | — | Output as JSON | — |
| `--web` | `-w` | Open in browser | — |

---

## ado issue view \<id\>

| Flag | Short | Description | Default |
|------|-------|-------------|---------|
| `--comments` | — | Show comments | — |
| `--project <project>` | `-p` | Azure DevOps project | — |
| `--org <url>` | — | Organization URL | — |
| `--json [fields]` | — | Output as JSON | — |
| `--web` | `-w` | Open in browser | — |

---

## ado issue create

| Flag | Short | Description | Default |
|------|-------|-------------|---------|
| `--title <title>` | `-t` | Work item title **(required)** | — |
| `--type <type>` | — | Work item type | `Issue` |
| `--body <text>` | `-b` | Description | — |
| `--assignee <who>` | `-a` | Assign to user (display name or email) | — |
| `--label <tags>` | `-l` | Semi-colon separated tags | — |
| `--project <project>` | `-p` | Azure DevOps project | — |
| `--org <url>` | — | Organization URL | — |
| `--json [fields]` | — | Output as JSON | — |

---

## ado issue edit \<id\>

| Flag | Short | Description | Default |
|------|-------|-------------|---------|
| `--title <title>` | `-t` | New title | — |
| `--body <text>` | `-b` | New description | — |
| `--state <state>` | `-s` | New state (`Active`, `Closed`, `Resolved`, …) | — |
| `--assignee <who>` | `-a` | Assign to user; empty string to unassign | — |
| `--label <tags>` | `-l` | Semi-colon separated tags | — |
| `--project <project>` | `-p` | Azure DevOps project | — |
| `--org <url>` | — | Organization URL | — |
| `--json [fields]` | — | Output as JSON | — |

---

## ado issue close \<id\>

| Flag | Short | Description | Default |
|------|-------|-------------|---------|
| `--project <project>` | `-p` | Azure DevOps project | — |
| `--org <url>` | — | Organization URL | — |

---

## ado issue reopen \<id\>

| Flag | Short | Description | Default |
|------|-------|-------------|---------|
| `--project <project>` | `-p` | Azure DevOps project | — |
| `--org <url>` | — | Organization URL | — |

---

## ado issue comment \<id\>

| Flag | Short | Description | Default |
|------|-------|-------------|---------|
| `--body <text>` | `-b` | Comment body | — |
| `--editor` | — | Open `$EDITOR` to write the comment | — |
| `--project <project>` | `-p` | Azure DevOps project | — |
| `--org <url>` | — | Organization URL | — |

---

## ado issue status

| Flag | Short | Description | Default |
|------|-------|-------------|---------|
| `--project <project>` | `-p` | Azure DevOps project | — |
| `--org <url>` | — | Organization URL | — |
| `--json [fields]` | — | Output as JSON | — |

---

## ado issue develop \<id\>

| Flag | Short | Description | Default |
|------|-------|-------------|---------|
| `--branch <name>` | `-b` | Branch name | `workitem/<id>-<title-slug>` |
| `--base <branch>` | — | Base branch to branch from | `main` (falls back to `master`) |
| `--repo <repo>` | `-r` | Repository name | — |
| `--project <project>` | `-p` | Azure DevOps project | — |
| `--org <url>` | — | Organization URL | — |

---

## ado pr list

| Flag | Short | Description | Default |
|------|-------|-------------|---------|
| `--state <state>` | `-s` | Filter: `open\|closed\|merged\|all` | `open` |
| `--author <who>` | `-a` | Filter by author; `@me` for yourself | — |
| `--repo <repo>` | `-r` | Repository name | — |
| `--limit <n>` | — | Max items to return | `30` |
| `--draft [only]` | — | Include drafts; `--draft only` for drafts only | — |
| `--project <project>` | `-p` | Azure DevOps project | — |
| `--org <url>` | — | Organization URL | — |
| `--json [fields]` | — | Output as JSON | — |
| `--web` | `-w` | Open in browser | — |

---

## ado pr view \<id\>

| Flag | Short | Description | Default |
|------|-------|-------------|---------|
| `--comments` | — | Show review comments and threads | — |
| `--repo <repo>` | `-r` | Repository name | — |
| `--project <project>` | `-p` | Azure DevOps project | — |
| `--org <url>` | — | Organization URL | — |
| `--json [fields]` | — | Output as JSON | — |
| `--web` | `-w` | Open in browser | — |

---

## ado pr comment \<id\>

| Flag | Short | Description | Default |
|------|-------|-------------|---------|
| `--body <text>` | `-b` | Comment body | — |
| `--editor` | — | Open `$EDITOR` to write the comment | — |
| `--repo <repo>` | `-r` | Repository name | — |
| `--project <project>` | `-p` | Azure DevOps project | — |
| `--org <url>` | — | Organization URL | — |

---

## ado pr diff \<id\>

| Flag | Short | Description | Default |
|------|-------|-------------|---------|
| `--name-only` | — | Display only names of changed files | — |
| `--patch` | — | Display diff in patch format (default behavior) | — |
| `--exclude <pattern>` | `-e` | Exclude files matching glob (repeatable) | — |
| `--color <when>` | — | Colorize: `always\|never\|auto` | `auto` |
| `--repo <repo>` | `-r` | Repository name | — |
| `--project <project>` | `-p` | Azure DevOps project | — |
| `--org <url>` | — | Organization URL | — |
| `--web` | `-w` | Open PR diff in browser | — |

---

## ado pr create

| Flag | Short | Description | Default |
|------|-------|-------------|---------|
| `--title <title>` | `-t` | Pull request title | — |
| `--body <text>` | `-b` | Pull request description | — |
| `--base <branch>` | `-B` | Target (base) branch | detected from remote or `main` |
| `--head <branch>` | `-H` | Source (head) branch | current git branch |
| `--draft` | `-d` | Create as draft | — |
| `--reviewer <who>` | `-a` | Add reviewer (repeatable) | — |
| `--repo <repo>` | `-r` | Repository name | — |
| `--project <project>` | `-p` | Azure DevOps project | — |
| `--org <url>` | — | Organization URL | — |
| `--json [fields]` | — | Output as JSON | — |
| `--web` | `-w` | Open in browser after creation | — |

---

## ado pr review \<id\>

| Flag | Short | Description | Default |
|------|-------|-------------|---------|
| `--approve` | — | Approve the pull request | — |
| `--reject` | — | Reject the pull request | — |
| `--request-changes` | — | Request changes (waiting for author) | — |
| `--body <text>` | `-b` | Review comment (optional) | — |
| `--repo <repo>` | `-r` | Repository name | — |
| `--project <project>` | `-p` | Azure DevOps project | — |
| `--org <url>` | — | Organization URL | — |

---

## ado run list

| Flag | Short | Description | Default |
|------|-------|-------------|---------|
| `--limit <n>` | — | Max runs to return | `30` |
| `--status <status>` | — | Filter: `queued\|in_progress\|completed` | — |
| `--branch <branch>` | — | Filter by branch name | — |
| `--project <project>` | `-p` | Azure DevOps project | — |
| `--org <url>` | — | Organization URL | — |
| `--json [fields]` | — | Output as JSON | — |
| `--web` | `-w` | Open in browser | — |

---

## ado run view \<id\>

| Flag | Short | Description | Default |
|------|-------|-------------|---------|
| `--project <project>` | `-p` | Azure DevOps project | — |
| `--org <url>` | — | Organization URL | — |
| `--json [fields]` | — | Output as JSON | — |
| `--web` | `-w` | Open in browser | — |

---

## ado run watch \<id\>

| Flag | Short | Description | Default |
|------|-------|-------------|---------|
| `--project <project>` | `-p` | Azure DevOps project | — |
| `--org <url>` | — | Organization URL | — |

---

## ado run cancel \<id\>

| Flag | Short | Description | Default |
|------|-------|-------------|---------|
| `--project <project>` | `-p` | Azure DevOps project | — |
| `--org <url>` | — | Organization URL | — |

---

## ado run rerun \<id\>

| Flag | Short | Description | Default |
|------|-------|-------------|---------|
| `--project <project>` | `-p` | Azure DevOps project | — |
| `--org <url>` | — | Organization URL | — |

---

## ado run download \<id\>

| Flag | Short | Description | Default |
|------|-------|-------------|---------|
| `--name <artifact>` | `-n` | Specific artifact name; downloads all if omitted | — |
| `--dir <dir>` | `-D` | Output directory | `.` (current directory) |
| `--project <project>` | `-p` | Azure DevOps project | — |
| `--org <url>` | — | Organization URL | — |

---

## ado run delete \<id\>

| Flag | Short | Description | Default |
|------|-------|-------------|---------|
| `--yes` | — | Skip confirmation prompt | — |
| `--project <project>` | `-p` | Azure DevOps project | — |
| `--org <url>` | — | Organization URL | — |

---

## ado search issues \<query\>

| Flag | Short | Description | Default |
|------|-------|-------------|---------|
| `--state <state>` | `-s` | Filter: `open\|closed\|all` | `all` |
| `--limit <n>` | — | Max results | `25` |
| `--project <project>` | `-p` | Azure DevOps project | — |
| `--org <url>` | — | Organization URL | — |
| `--json [fields]` | — | Output as JSON | — |

---

## ado search code \<query\>

| Flag | Short | Description | Default |
|------|-------|-------------|---------|
| `--repo <repo>` | `-r` | Filter by repository name | — |
| `--limit <n>` | — | Max results | `25` |
| `--project <project>` | `-p` | Azure DevOps project | — |
| `--org <url>` | — | Organization URL | — |
| `--json [fields]` | — | Output as JSON | — |

---

## ado search commits \<query\>

| Flag | Short | Description | Default |
|------|-------|-------------|---------|
| `--repo <repo>` | `-r` | Filter by repository name | — |
| `--limit <n>` | — | Max results | `25` |
| `--project <project>` | `-p` | Azure DevOps project | — |
| `--org <url>` | — | Organization URL | — |
| `--json [fields]` | — | Output as JSON | — |

---

## ado search prs \<query\>

| Flag | Short | Description | Default |
|------|-------|-------------|---------|
| `--state <state>` | `-s` | Filter: `open\|closed\|merged\|all` | `all` |
| `--limit <n>` | — | Max results | `25` |
| `--project <project>` | `-p` | Azure DevOps project | — |
| `--org <url>` | — | Organization URL | — |
| `--json [fields]` | — | Output as JSON | — |

---

## ado search repos \<query\>

| Flag | Short | Description | Default |
|------|-------|-------------|---------|
| `--limit <n>` | — | Max results | `30` |
| `--project <project>` | `-p` | Azure DevOps project | — |
| `--org <url>` | — | Organization URL | — |
| `--json [fields]` | — | Output as JSON | — |

---

## ado search projects \<query\>

| Flag | Short | Description | Default |
|------|-------|-------------|---------|
| `--limit <n>` | — | Max results | `30` |
| `--org <url>` | — | Organization URL | — |
| `--json [fields]` | — | Output as JSON | — |

---

## ado repo list

| Flag | Short | Description | Default |
|------|-------|-------------|---------|
| `--limit <n>` | — | Max results | `30` |
| `--project <project>` | `-p` | Azure DevOps project | — |
| `--org <url>` | — | Organization URL | — |
| `--json [fields]` | — | Output as JSON | — |

---

## ado repo clone \<repo\> [directory]

| Flag | Short | Description | Default |
|------|-------|-------------|---------|
| `--project <project>` | `-p` | Azure DevOps project | — |
| `--org <url>` | — | Organization URL | — |

---

## ado completion \<shell\>

Accepted values for `<shell>`: `bash`, `zsh`, `fish`, `powershell`

No additional flags.
