import * as msal from '@azure/msal-node';
import { AuthError } from '../errors/index.js';
import { loadOAuthCache, saveOAuthCache } from './store.js';

// Azure DevOps resource scope
const AZURE_DEVOPS_SCOPE = '499b84ac-1321-427f-aa17-267ca6975798/.default';

// Default to the Azure CLI public client — a well-known Microsoft public client app
// with http://localhost registered as a redirect URI, suitable for interactive CLI flows.
// Override with AZD_CLIENT_ID env var if you have your own Azure AD app registration.
const DEFAULT_CLIENT_ID = '04b07795-8ddb-461a-bbee-02f9e1bf7b46';

function createPca(): msal.PublicClientApplication {
  const clientId = process.env['AZD_CLIENT_ID'] ?? DEFAULT_CLIENT_ID;

  const cachePlugin: msal.ICachePlugin = {
    beforeCacheAccess: async (ctx: msal.TokenCacheContext) => {
      const cached = await loadOAuthCache();
      if (cached) ctx.tokenCache.deserialize(cached);
    },
    afterCacheAccess: async (ctx: msal.TokenCacheContext) => {
      if (ctx.cacheHasChanged) {
        await saveOAuthCache(ctx.tokenCache.serialize());
      }
    },
  };

  return new msal.PublicClientApplication({
    auth: {
      clientId,
      authority: 'https://login.microsoftonline.com/common',
    },
    cache: { cachePlugin },
  });
}

/**
 * Attempt a silent token refresh using the persisted MSAL token cache.
 * Throws AuthError if no cached session exists.
 */
export async function getOAuthTokenSilent(): Promise<string> {
  const pca = createPca();
  const accounts = await pca.getAllAccounts();

  if (accounts.length === 0) {
    throw new AuthError();
  }

  try {
    const result = await pca.acquireTokenSilent({
      account: accounts[0]!,
      scopes: [AZURE_DEVOPS_SCOPE],
    });
    return result.accessToken;
  } catch {
    throw new AuthError('OAuth session expired. Run: azd auth login');
  }
}

/**
 * Interactive browser-based OAuth login.
 * Opens the system browser, starts a local loopback server to capture the redirect,
 * and returns the access token.
 */
export async function loginBrowser(): Promise<string> {
  const pca = createPca();

  const openMod = await import('open');
  const open = openMod.default;

  const result = await pca.acquireTokenInteractive({
    scopes: [AZURE_DEVOPS_SCOPE],
    openBrowser: async (url: string) => {
      await open(url);
    },
    successTemplate:
      '<h3 style="font-family:sans-serif">Authentication complete. You may close this tab.</h3>',
    errorTemplate:
      '<h3 style="font-family:sans-serif">Authentication failed: {error}. You may close this tab.</h3>',
  });

  return result.accessToken;
}

/**
 * Device code flow — for headless / CI environments where a browser cannot be opened.
 * Prints a URL and one-time code the user enters at https://microsoft.com/devicelogin.
 */
export async function loginDeviceCode(): Promise<string> {
  const pca = createPca();

  const result = await pca.acquireTokenByDeviceCode({
    scopes: [AZURE_DEVOPS_SCOPE],
    deviceCodeCallback: (response) => {
      process.stdout.write(`\n${response.message}\n\n`);
    },
  });

  if (!result) {
    throw new AuthError('Device code authentication failed.');
  }

  return result.accessToken;
}
