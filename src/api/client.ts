import * as azdev from 'azure-devops-node-api';
import { AuthError } from '../errors/index.js';
import { getOrgUrl } from '../config/index.js';
import { loadCredential } from '../auth/store.js';
import { getOAuthTokenSilent } from '../auth/oauth.js';

export async function getWebApi(orgUrlOverride?: string): Promise<azdev.WebApi> {
  const orgUrl = getOrgUrl(orgUrlOverride);

  // 1. Azure Pipelines built-in token — always takes highest priority.
  //    Requires "Allow scripts to access the OAuth token" in pipeline settings,
  //    or expose it explicitly: env: SYSTEM_ACCESSTOKEN: $(System.AccessToken)
  if (process.env['SYSTEM_ACCESSTOKEN']) {
    return new azdev.WebApi(orgUrl, azdev.getBearerHandler(process.env['SYSTEM_ACCESSTOKEN']));
  }

  // 2. Explicit PAT env var — for scripts / local overrides
  if (process.env['AZURE_DEVOPS_TOKEN']) {
    return new azdev.WebApi(orgUrl, azdev.getPersonalAccessTokenHandler(process.env['AZURE_DEVOPS_TOKEN']));
  }

  // 3. Stored credential
  const cred = await loadCredential(orgUrl);

  if (!cred) {
    throw new AuthError();
  }

  if (cred.type === 'oauth') {
    // Silent OAuth refresh via persisted MSAL token cache (handles expiry automatically)
    const token = await getOAuthTokenSilent();
    return new azdev.WebApi(orgUrl, azdev.getBearerHandler(token));
  }

  // type === 'pat'
  if (!cred.token) {
    throw new AuthError();
  }
  return new azdev.WebApi(orgUrl, azdev.getPersonalAccessTokenHandler(cred.token));
}
