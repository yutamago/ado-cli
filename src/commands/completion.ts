import { Command } from 'commander';

function detectShell(): string {
  const shell = process.env['SHELL'] ?? '';
  if (shell.includes('zsh')) return 'zsh';
  if (shell.includes('fish')) return 'fish';
  if (shell.includes('bash')) return 'bash';
  if (process.platform === 'win32') return 'powershell';
  return 'bash';
}

const SUBCOMMANDS: Record<string, string> = {
  auth: 'login status logout',
  issue: 'list view create edit close reopen comment status develop',
  pr: 'list view comment diff create review',
  search: 'issues code commits prs repos projects',
  repo: 'list clone',
  run: 'list view watch cancel rerun download delete',
  completion: '',
};

const TOP_LEVEL = Object.keys(SUBCOMMANDS).join(' ');

function bashCompletion(): string {
  const cases = Object.entries(SUBCOMMANDS)
    .map(([cmd, subs]) => `    ${cmd}) COMPREPLY=($(compgen -W "${subs}" -- "$cur")) ;;`)
    .join('\n');

  return `# bash completion for azd
# Add to your ~/.bashrc:
#   source <(ado completion -s bash)

_azd_completion() {
  local cur prev
  cur="\${COMP_WORDS[COMP_CWORD]}"
  prev="\${COMP_WORDS[COMP_CWORD-1]}"

  if [ "$COMP_CWORD" -eq 1 ]; then
    COMPREPLY=($(compgen -W "${TOP_LEVEL}" -- "$cur"))
    return
  fi

  case "\${COMP_WORDS[1]}" in
${cases}
    *) COMPREPLY=() ;;
  esac
}

complete -F _azd_completion azd
`;
}

function zshCompletion(): string {
  const cases = Object.entries(SUBCOMMANDS)
    .map(([cmd, subs]) => `      ${cmd}) _values 'subcommand' ${subs} ;;`)
    .join('\n');

  return `#compdef azd
# zsh completion for azd
# Add to your ~/.zshrc:
#   source <(ado completion -s zsh)

_azd() {
  local state
  _arguments '1: :->cmd' '*: :->args'

  case $state in
    cmd) _values 'command' ${TOP_LEVEL} ;;
    args)
      case $words[2] in
${cases}
      esac
      ;;
  esac
}

_ado "$@"
`;
}

function fishCompletion(): string {
  const lines: string[] = [
    `# fish completion for azd`,
    `# Save to ~/.config/fish/completions/azd.fish`,
    ``,
  ];

  const descriptions: Record<string, string> = {
    auth: 'Authenticate with Azure DevOps',
    issue: 'Manage work items',
    pr: 'Manage pull requests',
    search: 'Search Azure DevOps',
    repo: 'Manage repositories',
    run: 'Manage pipeline runs',
    completion: 'Generate shell completion scripts',
  };

  for (const [cmd, desc] of Object.entries(descriptions)) {
    lines.push(`complete -c ado -n '__fish_use_subcommand' -a '${cmd}' -d '${desc}'`);
  }
  lines.push('');

  for (const [cmd, subs] of Object.entries(SUBCOMMANDS)) {
    if (!subs) continue;
    for (const sub of subs.split(' ')) {
      lines.push(`complete -c ado -n '__fish_seen_subcommand_from ${cmd}' -a '${sub}'`);
    }
  }

  return lines.join('\n') + '\n';
}

function powershellCompletion(): string {
  const cases = Object.entries(SUBCOMMANDS)
    .map(
      ([cmd, subs]) =>
        `        '${cmd}' { '${subs}'.Split(' ') | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object { [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_) } }`,
    )
    .join('\n');

  return `# PowerShell completion for azd
# Add to your $PROFILE:
#   ado completion -s powershell | Out-String | Invoke-Expression

Register-ArgumentCompleter -Native -CommandName ado -ScriptBlock {
    param($wordToComplete, $commandAst, $cursorPosition)
    $words = $commandAst.ToString() -split '\\s+'
    if ($words.Count -le 2) {
        '${TOP_LEVEL}'.Split(' ') | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object { [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_) }
        return
    }
    switch ($words[1]) {
${cases}
    }
}
`;
}

export function registerCompletionCommand(program: Command): void {
  program
    .command('completion')
    .description('Generate shell completion scripts')
    .option('-s, --shell <shell>', 'Shell type: bash, zsh, fish, powershell (default: auto-detect)')
    .action((options: { shell?: string }) => {
      const shell = options.shell ?? detectShell();
      switch (shell.toLowerCase()) {
        case 'zsh':
          process.stdout.write(zshCompletion());
          break;
        case 'fish':
          process.stdout.write(fishCompletion());
          break;
        case 'powershell':
        case 'pwsh':
          process.stdout.write(powershellCompletion());
          break;
        default:
          process.stdout.write(bashCompletion());
      }
    });
}
