# TODO

## Done
- [x] Project scaffolding (package.json, tsconfig.json, .gitignore)
- [x] Foundation modules (errors, config, auth/store)
- [x] API client factory (azure-devops-node-api, PAT auth)
- [x] Output module (TTY/non-TTY, table/detail/json)
- [x] `ado auth login` — PAT-based auth with keytar + file fallback
- [x] `ado issue list` — list work items with state/assignee/tag/type filters
- [x] `ado issue view <id>` — work item detail view with optional comments
- [x] `ado pr list` — list PRs with state/author/repo filters
- [x] `ado pr view <pr>` — PR detail with optional comment threads
- [x] `ado pr comment <pr>` — add comment (--body or $EDITOR)
- [x] `ado pr diff <pr>` — real unified diff with `--color`, `--exclude`, `--name-only`, `--patch`, `--web` flags matching `gh pr diff`
- [x] OAuth browser login as default auth (MSAL `acquireTokenInteractive`); device code flow for headless/CI
- [x] DEP0169 deprecation warning suppression (upstream: azure-devops-node-api#664, fix: PR#662)
- [x] `ado search issues <query>` — search work items via WIQL
- [x] `ado search code <query>` — search code via Azure Search REST API
- [x] `ado search commits <query>` — search commits (client-side filter)
- [x] `ado search prs <query>` — search PRs (client-side filter)
- [x] `ado search repos <query>` — list/filter repositories
- [x] `ado auth status` — show current auth state
- [x] `ado auth logout` — remove stored credentials
- [x] After login: numbered list project selector (TTY) / plain stdin line-read (non-TTY, AI agent compatible)
- [x] `ado issue create` — create a new work item (type, title, description, assignee, tags)
- [x] `ado issue edit <id>` — update title, description, state, assignee, tags on an existing work item
- [x] `ado issue close <id>` — set work item state to Closed/Resolved
- [x] `ado issue reopen <id>` — set work item state back to Active
- [x] `ado issue comment <id>` — add a comment to a work item (mirrors `ado pr comment`)
- [x] `ado issue status` — show work items assigned to you / created by you
- [x] `ado issue list --web` / `ado issue view --web` — open in browser
- [x] `ado issue develop <id>` — create a branch linked to a work item (`GitApi.updateRefs` + `WorkItemTrackingApi.updateWorkItem` with ArtifactLink relation)
- [x] `ado pr create` — create a pull request
- [x] `ado pr review` — approve/reject a PR
- [x] `ado pr list --web` / `ado pr view --web` — open in browser
- [x] `ado search projects <query>` — list/filter Azure DevOps projects (`CoreApi.getProjects` + client-side filter)
- [x] `ado repo list` — list repositories
- [x] `ado repo clone` — clone a repository
- [x] `ado run list` — list recent pipeline runs (`BuildApi.getBuilds`)
- [x] `ado run view <run-id>` — show details of a specific run; `--web` to open in browser
- [x] `ado run watch <run-id>` — stream live status until run completes
- [x] `ado run cancel <run-id>` — cancel an in-progress run (`BuildApi.updateBuild` status=Cancelling)
- [x] `ado run rerun <run-id>` — re-queue a completed/failed run (`BuildApi.updateBuild` retry=true)
- [x] `ado run download <run-id>` — download build artifacts (`BuildApi.getArtifacts`)
- [x] `ado run delete <run-id>` — delete a pipeline run record
- [x] `ado completion` — generate shell completion scripts (bash/zsh/fish/powershell)
- [x] `--web` / `-w` flag audit — added to: `issue list`, `issue view`, `pr list`, `pr view`, `run list`, `run view`

## Backlog

- [ ] Tests
