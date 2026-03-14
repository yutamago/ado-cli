import * as azdev from 'azure-devops-node-api';
import { AuthError } from '../errors/index.js';
import { getOrgUrl } from '../config/index.js';
import { loadToken } from '../auth/store.js';

export async function getWebApi(orgUrlOverride?: string): Promise<azdev.WebApi> {
  const orgUrl = getOrgUrl(orgUrlOverride);
  const token = await loadToken(orgUrl);

  if (!token) {
    throw new AuthError();
  }

  const authHandler = azdev.getPersonalAccessTokenHandler(token);
  return new azdev.WebApi(orgUrl, authHandler);
}
