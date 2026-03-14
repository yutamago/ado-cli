# TODO

## Done
- [x] Project scaffolding (package.json, tsconfig.json, .gitignore)
- [x] Foundation modules (errors, config, auth/store)
- [x] API client factory (azure-devops-node-api, PAT auth)
- [x] Output module (TTY/non-TTY, table/detail/json)
- [x] `azd auth login` — PAT-based auth with keytar + file fallback
- [x] `azd issue list` — list work items with state/assignee/tag/type filters
- [x] `azd issue view <id>` — work item detail view with optional comments
- [x] `azd pr list` — list PRs with state/author/repo filters
- [x] `azd pr view <pr>` — PR detail with optional comment threads
- [x] `azd pr comment <pr>` — add comment (--body or $EDITOR)
- [x] `azd pr diff <pr>` — list changed files (--name-only for agent use)
- [x] `azd search issues <query>` — search work items via WIQL
- [x] `azd search code <query>` — search code via Azure Search REST API
- [x] `azd search commits <query>` — search commits (client-side filter)
- [x] `azd search prs <query>` — search PRs (client-side filter)
- [x] `azd search repos <query>` — list/filter repositories

## Backlog
- [ ] `azd auth status` — show current auth state
- [ ] `azd auth logout` — remove stored credentials
- [ ] `azd pr create` — create a pull request
- [ ] `azd issue create` — create a work item
- [ ] `azd repo list` — list repositories
- [ ] `azd repo clone` — clone a repository
- [ ] `azd pr review` — approve/reject a PR
- [ ] `azd run` — trigger a pipeline run
- [ ] OAuth2 device flow auth (via @azure/identity DeviceCodeCredential)
- [ ] Shell completion (bash/zsh/fish/powershell)
- [ ] Tests
