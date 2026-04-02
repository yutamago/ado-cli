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
    throw new AuthError('OAuth session expired. Run: ado auth login');
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
    successTemplate: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>ado — authenticated</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #0d1117;
      color: #e6edf3;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    .card {
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 12px;
      padding: 48px 56px;
      max-width: 420px;
      width: 100%;
      text-align: center;
    }
    .icon {
      width: 56px;
      height: 56px;
      background: #1f6feb22;
      border: 1px solid #1f6feb66;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
      font-size: 28px;
    }
    h1 { font-size: 20px; font-weight: 600; margin-bottom: 8px; }
    p  { font-size: 14px; color: #8b949e; line-height: 1.5; }
    .badge {
      display: inline-block;
      margin-top: 24px;
      background: #1f6feb22;
      border: 1px solid #1f6feb66;
      color: #58a6ff;
      font-size: 12px;
      font-weight: 500;
      padding: 4px 12px;
      border-radius: 20px;
      letter-spacing: 0.02em;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✓</div>
    <h1>Authentication successful</h1>
    <p>You are now logged in to Azure DevOps.<br>You may close this tab and return to your terminal.</p>
    <span class="badge">ado cli</span>
  </div>
</body>
</html>`,
    errorTemplate: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>ado — authentication failed</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #0d1117;
      color: #e6edf3;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    .card {
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 12px;
      padding: 48px 56px;
      max-width: 420px;
      width: 100%;
      text-align: center;
    }
    .icon {
      width: 56px;
      height: 56px;
      background: #f8514922;
      border: 1px solid #f8514966;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
      font-size: 28px;
    }
    h1 { font-size: 20px; font-weight: 600; margin-bottom: 8px; }
    p  { font-size: 14px; color: #8b949e; line-height: 1.5; }
    .error {
      margin-top: 16px;
      background: #f8514911;
      border: 1px solid #f8514944;
      border-radius: 6px;
      padding: 10px 14px;
      font-size: 13px;
      color: #ff7b72;
      font-family: ui-monospace, monospace;
      word-break: break-all;
    }
    .badge {
      display: inline-block;
      margin-top: 24px;
      background: #f8514922;
      border: 1px solid #f8514966;
      color: #ff7b72;
      font-size: 12px;
      font-weight: 500;
      padding: 4px 12px;
      border-radius: 20px;
      letter-spacing: 0.02em;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✗</div>
    <h1>Authentication failed</h1>
    <p>Something went wrong during sign-in.<br>Close this tab and try <code>ado auth login</code> again.</p>
    <div class="error">{error}</div>
    <span class="badge">ado cli</span>
  </div>
</body>
</html>`,
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
