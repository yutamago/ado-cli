# ado-cli
An Azure DevOps CLI, mimicking the known and loved Github CLI syntax.

## Installation

**macOS, Linux, WSL** (recommended — no Node.js required):
```bash
curl -fsSL https://raw.githubusercontent.com/yutamago/ado-cli/main/install.sh | bash
```

**Windows PowerShell:**
```powershell
irm https://raw.githubusercontent.com/yutamago/ado-cli/main/install.ps1 | iex
```

**Windows CMD:**
```cmd
curl -fsSL https://raw.githubusercontent.com/yutamago/ado-cli/main/install.ps1 -o install.ps1 && powershell -File install.ps1 && del install.ps1
```

**npm** (requires Node.js 18+):
```bash
npm install -g ado-cli
```

Pre-built binaries for all platforms are also available on the [Releases](https://github.com/yutamago/ado-cli/releases) page.


### Installing the Plugin in your AI Agent

```bash
# Github Copilot
copilot plugin marketplace add https://github.com/yutamago/ado-cli.git
copilot plugin install azure-devops@ado-cli-skill

# Claude Code
claude plugin marketplace add https://github.com/yutamago/ado-cli.git
claude plugin install azure-devops@ado-cli-skill
```


## Authentication

```bash
ado auth login           # Browser OAuth (default)
ado auth login --device  # Device-code flow for headless/CI environments
ado auth status          # Show current auth state
ado auth logout          # Remove stored credentials
```

After login you will be prompted to select a default organization and project. These can also be set via environment variables:

```
AZURE_DEVOPS_ORG=https://dev.azure.com/myorg
AZURE_DEVOPS_PROJECT=my-project
```

For CI pipelines, set `SYSTEM_ACCESSTOKEN` (Azure Pipelines built-in) or `AZURE_DEVOPS_TOKEN` (PAT) — no login step required.


## Commands

### Issues (Work Items)

```bash
ado issue list                                         # List work items
ado issue list --state Active --assignee @me
ado issue view <id>                                    # Work item details
ado issue view <id> --comments
ado issue create --title "Bug report" --type Bug
ado issue edit <id> --state Resolved
ado issue close <id>
ado issue reopen <id>
ado issue comment <id> --body "LGTM"
ado issue status                                       # Items assigned to / created by you
ado issue develop <id>                                 # Create a branch linked to the work item
```

### Pull Requests

```bash
ado pr list
ado pr list --state abandoned --author @me
ado pr view <pr>
ado pr view <pr> --comments
ado pr diff <pr>
ado pr diff <pr> --name-only
ado pr comment <pr> --body "Looks good"
ado pr create --title "My PR" --draft
ado pr review <pr> --approve
ado pr review <pr> --reject --comment "Needs changes"
```

### Pipeline Runs

```bash
ado run list
ado run list --status failed --branch main
ado run view <run-id>
ado run watch <run-id>
ado run cancel <run-id>
ado run rerun <run-id>
ado run download <run-id>
ado run delete <run-id>
```

### Search

```bash
ado search issues "memory leak"
ado search code "TodoController" --repo my-repo
ado search commits "fix auth"
ado search prs "login"
ado search repos "api"
ado search projects "platform"
```

### Repositories

```bash
ado repo list
ado repo clone <repo>
```

### Shell Completions

```bash
ado completion bash        >> ~/.bashrc
ado completion zsh         >> ~/.zshrc
ado completion fish        > ~/.config/fish/completions/ado.fish
ado completion powershell  >> $PROFILE
```


## Output Modes

| Mode | Behavior |
|---|---|
| TTY | Styled tables and colored state labels |
| non-TTY (pipe / agent) | Tab-separated plain text — machine-readable |
| `--json` | Structured JSON (available on most commands) |
| `--web` / `-w` | Open the result in a browser |

Non-TTY output is optimized for agent consumption (GitHub Copilot, Claude, etc.).


## Configuration

Config is resolved in this order:

1. CLI flags (`--org`, `--project`)
2. Environment variables (`AZURE_DEVOPS_ORG`, `AZURE_DEVOPS_PROJECT`)
3. Git remote (auto-detected from `origin`)
4. `~/.ado/config.json`

Supported remote URL formats:

- `https://dev.azure.com/{org}/{project}/_git/{repo}`
- `https://{org}.visualstudio.com/{project}/_git/{repo}`
- `git@ssh.dev.azure.com:v3/{org}/{project}/{repo}`


## License

MIT — see [LICENSE](./LICENSE).
