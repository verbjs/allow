import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { createAllow, useStrategy, authenticate, createSession, getSession, updateSession, destroySession, linkStrategy, unlinkStrategy, getUserStrategies, getMiddleware, getSessionMiddleware, getHandlers } from "../src/allow";
import { createLocalStrategy } from "../src/strategies/local";
import { runMigrations } from "../src/migration";
import type { AuthConfig } from "../src/types";

describe("Allow Authentication Library", () => {
  let testDb: Database;
  let config: AuthConfig;

  beforeEach(async () => {
    testDb = new Database(":memory:");
    
    config = {
      secret: "test-secret",
      sessionDuration: 86400000,
      database: {
        type: "sqlite",
        connection: ":memory:",
        migrate: true
      },
      strategies: [
        {
          name: "local",
          type: "local",
          config: {
            usernameField: "username",
            passwordField: "password",
            hashRounds: 10
          }
        },
        {
          name: "github",
          type: "oauth",
          config: {
            clientId: "test-client-id",
            clientSecret: "test-client-secret",
            callbackURL: "http://localhost:3000/auth/github/callback",
            authorizeURL: "https://github.com/login/oauth/authorize",
            tokenURL: "https://github.com/login/oauth/access_token",
            userInfoURL: "https://api.github.com/user",
            scope: ["user:email"]
          }
        }
      ]
    };
  });

  afterEach(() => {
    testDb?.close();
  });

  test("should create Allow instance with configuration", () => {
    const allow = createAllow(config);
    expect(allow).toBeDefined();
    expect(getMiddleware(allow)).toBeDefined();
    expect(getHandlers(allow)).toBeDefined();
  });

  test("should register strategies correctly", () => {
    const allow = createAllow(config);
    const customStrategy = createLocalStrategy({ usernameField: "email" });
    useStrategy(allow, customStrategy);
    
    expect(allow).toBeDefined();
  });

  test("should handle password hashing and verification", async () => {
    const { hashPassword, verifyPassword } = await import("../src/strategies/local");
    const password = "test-password";
    const hash = await hashPassword(password);
    
    expect(hash).toBeDefined();
    expect(hash).not.toBe(password);
    
    const isValid = await verifyPassword(password, hash);
    expect(isValid).toBe(true);
    
    const isInvalid = await verifyPassword("wrong-password", hash);
    expect(isInvalid).toBe(false);
  });

  test("should authenticate with local strategy", async () => {
    const allow = createAllow(config);
    
    const mockReq = {
      body: {
        username: "testuser",
        password: "testpass"
      }
    } as any;

    const result = await authenticate(allow, "local", mockReq);
    
    expect(result).toBeDefined();
    expect(result.success).toBe(false);
    expect(result.error).toBe("Authentication failed");
  });

  test("should create and retrieve sessions", async () => {
    const allow = createAllow(config);
    
    const user = {
      id: "user-1",
      username: "testuser",
      email: "test@example.com",
      profile: { role: "user" },
      strategies: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const session = await createSession(allow, user, { test: "data" });
    
    expect(session).toBeDefined();
    expect(session.id).toBeDefined();
    expect(session.userId).toBe(user.id);
    expect(session.data.test).toBe("data");
    expect(session.expiresAt).toBeInstanceOf(Date);
  });

  test("should handle session lifecycle", async () => {
    const allow = createAllow(config);
    
    const user = {
      id: "user-1",
      username: "testuser",
      email: "test@example.com",
      profile: {},
      strategies: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const session = await createSession(allow, user);
    
    const retrieved = await getSession(allow, session.id);
    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe(session.id);
    
    await updateSession(allow, session.id, { updated: true });
    
    const updated = await getSession(allow, session.id);
    expect(updated?.data.updated).toBe(true);
    
    await destroySession(allow, session.id);
    
    const destroyed = await getSession(allow, session.id);
    expect(destroyed).toBeNull();
  });

  test("should handle OAuth strategy initialization", async () => {
    const allow = createAllow(config);
    
    const mockReq = {
      query: {},
      body: {}
    } as any;

    const result = await authenticate(allow, "github", mockReq);
    
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.redirect).toBeDefined();
    expect(result.redirect).toContain("https://github.com/login/oauth/authorize");
  });

  test("should handle middleware creation", () => {
    const allow = createAllow(config);
    
    const middleware = getMiddleware(allow);
    const sessionMw = getSessionMiddleware(allow);
    
    expect(middleware.requireAuth).toBeDefined();
    expect(middleware.optionalAuth).toBeDefined();
    expect(middleware.requireRole).toBeDefined();
    expect(sessionMw).toBeDefined();
  });

  test("should handle auth handlers", () => {
    const allow = createAllow(config);
    
    const handlers = getHandlers(allow);
    
    expect(handlers.login).toBeDefined();
    expect(handlers.callback).toBeDefined();
    expect(handlers.logout).toBeDefined();
    expect(handlers.profile).toBeDefined();
    expect(handlers.link).toBeDefined();
    expect(handlers.unlink).toBeDefined();
  });

  test("should handle strategy linking", async () => {
    const allow = createAllow(config);
    
    const userId = "user-1";
    const strategyName = "github";
    const strategyId = "github-123";
    const profile = { username: "testuser", email: "test@example.com" };
    
    const userStrategy = await linkStrategy(allow, userId, strategyName, strategyId, profile);
    
    expect(userStrategy).toBeDefined();
    expect(userStrategy.userId).toBe(userId);
    expect(userStrategy.strategyName).toBe(strategyName);
    expect(userStrategy.strategyId).toBe(strategyId);
    expect(userStrategy.profile).toEqual(profile);
  });

  test("should handle strategy unlinking", async () => {
    const allow = createAllow(config);
    
    const userId = "user-1";
    const strategyName = "github";
    const strategyId = "github-123";
    const profile = { username: "testuser" };
    
    await linkStrategy(allow, userId, strategyName, strategyId, profile);
    
    const strategies = await getUserStrategies(allow, userId);
    expect(strategies).toHaveLength(1);
    
    await unlinkStrategy(allow, userId, strategyName);
    
    const updatedStrategies = await getUserStrategies(allow, userId);
    expect(updatedStrategies).toHaveLength(0);
  });
});

describe("Migration System", () => {
  test("should run migrations successfully", async () => {
    const config = {
      database: {
        type: "sqlite" as const,
        connection: ":memory:"
      }
    };

    try {
      await runMigrations(config);
      expect(true).toBe(true); // If we reach here, migration succeeded
    } catch (error) {
      throw error;
    }
  });

  test("should handle migration errors gracefully", async () => {
    const config = {
      database: {
        type: "postgres" as const,
        connection: "invalid"
      }
    };

    await expect(runMigrations(config)).rejects.toThrow("Only SQLite migrations are currently supported");
  });
});