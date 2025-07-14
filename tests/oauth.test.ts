import { test, expect, describe } from "bun:test";
import { createOAuthStrategy, githubStrategy, googleStrategy, discordStrategy } from "../src/strategies/oauth";

describe("OAuthStrategy", () => {
  const mockConfig = {
    clientId: "test-client-id",
    clientSecret: "test-client-secret",
    callbackURL: "http://localhost:3000/auth/test/callback",
    authorizeURL: "https://example.com/oauth/authorize",
    tokenURL: "https://example.com/oauth/token",
    userInfoURL: "https://example.com/api/user",
    scope: ["user", "email"]
  };

  test("should create OAuth strategy with custom name", () => {
    const strategy = createOAuthStrategy("custom", mockConfig);
    expect(strategy.name).toBe("custom");
  });

  test("should generate authorization URL", async () => {
    const strategy = createOAuthStrategy("test", mockConfig);
    const mockReq = {} as any;

    const result = await strategy.authenticate(mockReq);
    
    expect(result.success).toBe(true);
    expect(result.redirect).toBeDefined();
    expect(result.redirect).toContain("https://example.com/oauth/authorize");
    expect(result.redirect).toContain("client_id=test-client-id");
    expect(result.redirect).toContain("redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fauth%2Ftest%2Fcallback");
    expect(result.redirect).toContain("response_type=code");
    expect(result.redirect).toContain("scope=user+email");
    expect(result.redirect).toContain("state=");
  });

  test("should handle callback without code", async () => {
    const strategy = createOAuthStrategy("test", mockConfig);
    const mockReq = {
      query: {}
    } as any;

    const result = await strategy.callback!(mockReq);
    
    expect(result.success).toBe(false);
    expect(result.error).toBe("Missing authorization code");
  });

  test("should handle callback with code", async () => {
    const strategy = createOAuthStrategy("test", mockConfig);
    const mockReq = {
      query: {
        code: "test-code",
        state: "test-state"
      }
    } as any;

    const result = await strategy.callback!(mockReq);
    
    expect(result.success).toBe(false);
    expect(result.error).toBe("OAuth callback failed");
  });

  test("should create GitHub strategy", () => {
    const strategy = githubStrategy({
      clientId: "github-client-id",
      clientSecret: "github-client-secret",
      callbackURL: "http://localhost:3000/auth/github/callback"
    });

    expect(strategy.name).toBe("github");
    expect(strategy.name).toBeDefined();
  });

  test("should create Google strategy", () => {
    const strategy = googleStrategy({
      clientId: "google-client-id",
      clientSecret: "google-client-secret",
      callbackURL: "http://localhost:3000/auth/google/callback"
    });

    expect(strategy.name).toBe("google");
    expect(strategy.name).toBeDefined();
  });

  test("should create Discord strategy", () => {
    const strategy = discordStrategy({
      clientId: "discord-client-id",
      clientSecret: "discord-client-secret",
      callbackURL: "http://localhost:3000/auth/discord/callback"
    });

    expect(strategy.name).toBe("discord");
    expect(strategy.name).toBeDefined();
  });

  test("should handle empty scope", async () => {
    const configWithoutScope = {
      ...mockConfig,
      scope: undefined
    };

    const strategy = createOAuthStrategy("test", configWithoutScope);
    const mockReq = {} as any;

    const result = await strategy.authenticate(mockReq);
    
    expect(result.success).toBe(true);
    expect(result.redirect).toBeDefined();
    expect(result.redirect).toContain("scope=");
  });

  test("should handle single scope", async () => {
    const configWithSingleScope = {
      ...mockConfig,
      scope: ["user"]
    };

    const strategy = createOAuthStrategy("test", configWithSingleScope);
    const mockReq = {} as any;

    const result = await strategy.authenticate(mockReq);
    
    expect(result.success).toBe(true);
    expect(result.redirect).toBeDefined();
    expect(result.redirect).toContain("scope=user");
  });
});