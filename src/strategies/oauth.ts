import type { Request } from "verb";
import type { AuthResult, AuthStrategy, AuthUser, OAuthConfig } from "../types";
import { generateError, generateSuccess } from "./base";

export function createOAuthStrategy(name: string, config: OAuthConfig): AuthStrategy {
  return {
    name,

    async authenticate(_req: Request): Promise<AuthResult> {
      const state = generateState();
      const authURL = buildAuthURL(config, state);

      return {
        success: true,
        redirect: authURL,
      };
    },

    async callback(req: Request): Promise<AuthResult> {
      const code = (req as any).query?.code;
      const _state = (req as any).query?.state;

      if (!code) {
        return generateError("Missing authorization code");
      }

      try {
        const tokenResponse = await exchangeCodeForToken(config, code);
        if (!tokenResponse.access_token) {
          return generateError("Failed to obtain access token");
        }

        const userProfile = await getUserProfile(config, tokenResponse.access_token);
        if (!userProfile) {
          return generateError("Failed to get user profile");
        }

        const user = await mapProfileToUser(userProfile);

        return generateSuccess(user, {
          access_token: tokenResponse.access_token,
          refresh_token: tokenResponse.refresh_token,
          expires_at: tokenResponse.expires_in
            ? new Date(Date.now() + tokenResponse.expires_in * 1000)
            : undefined,
        });
      } catch (_error) {
        return generateError("OAuth callback failed");
      }
    },
  };
}

function generateState(): string {
  return crypto.randomUUID();
}

function buildAuthURL(config: OAuthConfig, state: string): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.callbackURL,
    response_type: "code",
    state,
    scope: config.scope?.join(" ") || "",
  });

  return `${config.authorizeURL}?${params.toString()}`;
}

async function exchangeCodeForToken(config: OAuthConfig, code: string): Promise<any> {
  const response = await fetch(config.tokenURL!, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: config.callbackURL,
    }),
  });

  if (!response.ok) {
    throw new Error(`Token exchange failed: ${response.status}`);
  }

  return response.json();
}

async function getUserProfile(config: OAuthConfig, accessToken: string): Promise<any> {
  const response = await fetch(config.userInfoURL!, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`User profile fetch failed: ${response.status}`);
  }

  return response.json();
}

async function mapProfileToUser(profile: any): Promise<AuthUser> {
  return {
    id: profile.id || profile.sub,
    username: profile.username || profile.login || profile.preferred_username,
    email: profile.email,
    profile,
    strategies: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export const githubStrategy = (
  config: Omit<OAuthConfig, "authorizeURL" | "tokenURL" | "userInfoURL">,
) =>
  createOAuthStrategy("github", {
    ...config,
    authorizeURL: "https://github.com/login/oauth/authorize",
    tokenURL: "https://github.com/login/oauth/access_token",
    userInfoURL: "https://api.github.com/user",
  });

export const googleStrategy = (
  config: Omit<OAuthConfig, "authorizeURL" | "tokenURL" | "userInfoURL">,
) =>
  createOAuthStrategy("google", {
    ...config,
    authorizeURL: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenURL: "https://oauth2.googleapis.com/token",
    userInfoURL: "https://www.googleapis.com/oauth2/v2/userinfo",
  });

export const discordStrategy = (
  config: Omit<OAuthConfig, "authorizeURL" | "tokenURL" | "userInfoURL">,
) =>
  createOAuthStrategy("discord", {
    ...config,
    authorizeURL: "https://discord.com/oauth2/authorize",
    tokenURL: "https://discord.com/api/oauth2/token",
    userInfoURL: "https://discord.com/api/users/@me",
  });

export const facebookStrategy = (
  config: Omit<OAuthConfig, "authorizeURL" | "tokenURL" | "userInfoURL">,
) =>
  createOAuthStrategy("facebook", {
    ...config,
    scope: config.scope || ["email", "public_profile"],
    authorizeURL: "https://www.facebook.com/v19.0/dialog/oauth",
    tokenURL: "https://graph.facebook.com/v19.0/oauth/access_token",
    userInfoURL: "https://graph.facebook.com/me?fields=id,name,email,picture",
  });

export const instagramStrategy = (
  config: Omit<OAuthConfig, "authorizeURL" | "tokenURL" | "userInfoURL">,
) =>
  createOAuthStrategy("instagram", {
    ...config,
    scope: config.scope || ["instagram_business_basic"],
    authorizeURL: "https://www.instagram.com/oauth/authorize",
    tokenURL: "https://api.instagram.com/oauth/access_token",
    userInfoURL: "https://graph.instagram.com/me?fields=id,username,account_type",
  });

export const tiktokStrategy = (
  config: Omit<OAuthConfig, "authorizeURL" | "tokenURL" | "userInfoURL">,
) =>
  createOAuthStrategy("tiktok", {
    ...config,
    scope: config.scope || ["user.info.basic"],
    authorizeURL: "https://www.tiktok.com/v2/auth/authorize",
    tokenURL: "https://open.tiktokapis.com/v2/oauth/token/",
    userInfoURL: "https://open.tiktokapis.com/v2/user/info/",
  });
