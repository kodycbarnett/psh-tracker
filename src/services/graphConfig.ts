// Microsoft Graph Configuration
console.log('Environment variable VITE_MSAL_CLIENT_ID:', import.meta.env.VITE_MSAL_CLIENT_ID);
console.log('Using authority:', 'https://login.microsoftonline.com/common');
export const graphConfig = {
  clientId: '5623f00f-1698-49e1-a45f-c19be44732a5',
  authority: 'https://login.microsoftonline.com/common',
  redirectUri: window.location.origin,
  scopes: [
    'https://graph.microsoft.com/User.Read'
    // Email scopes archived - can be restored later
    // 'https://graph.microsoft.com/Mail.Send',
    // 'https://graph.microsoft.com/Mail.ReadWrite',
    // 'https://graph.microsoft.com/Mail.Read'
  ]
};

export const msalConfig = {
  auth: {
    clientId: graphConfig.clientId,
    authority: graphConfig.authority,
    redirectUri: graphConfig.redirectUri,
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false,
  },
  system: {
    allowNativeBroker: false,
    iframeHashTimeout: 10000, // Increase timeout for mobile
    loadFrameTimeout: 10000,  // Increase timeout for mobile
  },
};

export const loginRequest = {
  scopes: graphConfig.scopes,
  prompt: 'select_account',
};
