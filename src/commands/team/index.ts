import { Command } from 'commander';
import { registerTeamList } from './list.js';
import { registerTeamIteration } from './iteration.js';

export function registerTeamCommands(program: Command): void {
  const team = program.command('team').description('Manage Azure DevOps teams');
  registerTeamList(team);
  registerTeamIteration(team);
}
