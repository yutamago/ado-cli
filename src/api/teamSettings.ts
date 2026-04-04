import * as azdev from 'azure-devops-node-api';
import { WebApiTeam } from 'azure-devops-node-api/interfaces/CoreInterfaces';
import { TeamSettingsIteration } from 'azure-devops-node-api/interfaces/WorkInterfaces';


/**
 * Get a list of teams.
 */
export async function getTeams(
  connection: azdev.WebApi,
  project: string,
  options: {
    /**
     * If true return all the teams requesting user is member, otherwise return all the teams user has read access.
     */
    mine?: boolean;
    skip?: number;
    top?: number;
    /**
     * A value indicating whether or not to expand Identity information in the result WebApiTeam object.
     */
    expandIdentity?: boolean;
  }
): Promise<WebApiTeam[]> {
  const coreApi = await connection.getCoreApi();
  const teams = await coreApi.getTeams(project, options.mine, options.top, options.skip, options.expandIdentity);
  return teams;
}

/**
 * Get a team's iterations using timeframe filter.
 */
export async function getTeamIterations(
  connection: azdev.WebApi,
  project: string,
  team: string,
  options: {
    current?: boolean;
  }
): Promise<TeamSettingsIteration[]> {
  const workApi = await connection.getWorkApi();

  const timeframe = options.current ? 'Current' : undefined;

  const iterations = await workApi.getTeamIterations({project, team}, timeframe);
  return iterations;
}
