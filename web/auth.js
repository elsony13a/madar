import { UserManager, WebStorageStateStore } from "oidc-client-ts";
import { config } from "./config.js";
let manager;
export function validateConfig() {
  if (config.mode !== "aws") return;
  for (const k of [
    "apiBaseUrl",
    "cognitoDomain",
    "region",
    "userPoolId",
    "clientId",
    "redirectUri",
    "logoutUri",
  ])
    if (!config[k]) throw Error(`Missing AWS setting: ${k}`);
  for (const k of ["apiBaseUrl", "cognitoDomain"])
    if (new URL(config[k]).protocol !== "https:")
      throw Error(`${k} must use HTTPS`);
  const redirect = new URL(config.redirectUri);
  if (
    redirect.origin !== location.origin ||
    redirect.pathname !== location.pathname
  )
    throw Error("redirectUri must match this page exactly");
  if (config.clientId.includes(" ")) throw Error("Invalid clientId");
}
function client() {
  validateConfig();
  if (!manager)
    manager = new UserManager({
      authority: `https://cognito-idp.${config.region}.amazonaws.com/${config.userPoolId}`,
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: "code",
      scope: config.scopes.join(" "),
      automaticSilentRenew: false,
      loadUserInfo: false,
      userStore: new WebStorageStateStore({ store: sessionStorage }),
      stateStore: new WebStorageStateStore({ store: sessionStorage }),
      metadata: {
        issuer: `https://cognito-idp.${config.region}.amazonaws.com/${config.userPoolId}`,
        authorization_endpoint: `${config.cognitoDomain}/oauth2/authorize`,
        token_endpoint: `${config.cognitoDomain}/oauth2/token`,
        userinfo_endpoint: `${config.cognitoDomain}/oauth2/userInfo`,
        jwks_uri: `https://cognito-idp.${config.region}.amazonaws.com/${config.userPoolId}/.well-known/jwks.json`,
      },
    });
  return manager;
}
export async function initializeAuth() {
  if (config.mode !== "aws") return null;
  const params = new URLSearchParams(location.search);
  if (params.has("code") || params.has("error")) {
    try {
      await client().signinRedirectCallback();
    } finally {
      history.replaceState({}, "", location.pathname + location.hash);
    }
  }
  const user = await client().getUser();
  return user && !user.expired ? user : null;
}
export async function signIn() {
  await client().signinRedirect();
}
export async function signOut() {
  await client().removeUser();
  const url = new URL("/logout", config.cognitoDomain);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("logout_uri", config.logoutUri);
  location.assign(url);
}
export async function accessToken() {
  const user = await client().getUser();
  if (!user || user.expired)
    throw Error("Your session has expired. Sign in again.");
  return user.access_token;
}
