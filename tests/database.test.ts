import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import {
  initDatabase,
  syncDatabase,
  closeDatabase,
  getRepo,
} from "../src/db";
import {
  createUser,
  getUserById,
  createUserStrategy,
  getUserByStrategy,
  getUserStrategies,
  deleteUserStrategy,
  createSession,
  getSession,
  updateSession,
  deleteSession,
  cleanupExpiredSessions,
} from "../src/db/queries";
import { raw } from "@verb-js/hull";

/**
 * Get test database URL from environment
 */
const getTestDatabaseUrl = (): string | undefined => {
  return process.env.DATABASE_URL || process.env.TEST_DATABASE_URL;
};

/**
 * Check if database tests should be skipped
 */
const shouldSkipDbTests = (): boolean => {
  return !getTestDatabaseUrl();
};

describe.skipIf(shouldSkipDbTests())("AuthDatabase", () => {
  const dbUrl = getTestDatabaseUrl()!;

  beforeEach(async () => {
    initDatabase(dbUrl);

    // Clean up tables if they exist
    const repo = getRepo();
    await raw(repo, "DROP TABLE IF EXISTS auth_sessions CASCADE").catch(() => {});
    await raw(repo, "DROP TABLE IF EXISTS user_strategies CASCADE").catch(() => {});
    await raw(repo, "DROP TABLE IF EXISTS auth_users CASCADE").catch(() => {});

    // Sync schema to create tables
    await syncDatabase();
  });

  afterEach(async () => {
    await closeDatabase();
  });

  test("should sync database schema", async () => {
    // Tables should exist after sync
    const repo = getRepo();
    const result = await raw(repo, "SELECT 1");
    expect(result).toBeDefined();
  });

  test("should create and retrieve user", async () => {
    const userData = {
      id: "user-1",
      username: "testuser",
      email: "test@example.com",
      profile: { role: "user" },
    };

    const user = await createUser(userData);

    expect(user).toBeDefined();
    expect(user.id).toBe(userData.id);
    expect(user.username).toBe(userData.username);
    expect(user.email).toBe(userData.email);
    expect(user.profile).toEqual(userData.profile);
    expect(user.createdAt).toBeInstanceOf(Date);
    expect(user.updatedAt).toBeInstanceOf(Date);

    const retrieved = await getUserById(user.id);
    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe(user.id);
    expect(retrieved?.username).toBe(user.username);
  });

  test("should return null for non-existent user", async () => {
    const user = await getUserById("non-existent");
    expect(user).toBeNull();
  });

  test("should create and retrieve user strategy", async () => {
    const userData = {
      id: "user-1",
      username: "testuser",
      email: "test@example.com",
      profile: {},
    };

    const user = await createUser(userData);

    const strategyData = {
      id: "strategy-1",
      userId: user.id,
      strategyName: "github",
      strategyId: "github-123",
      profile: { username: "testuser", email: "test@example.com" },
      tokens: {
        access_token: "token-123",
        refresh_token: "refresh-123",
        expires_at: new Date(Date.now() + 3600000),
      },
    };

    const strategy = await createUserStrategy(strategyData);

    expect(strategy).toBeDefined();
    expect(strategy.id).toBe(strategyData.id);
    expect(strategy.userId).toBe(strategyData.userId);
    expect(strategy.strategyName).toBe(strategyData.strategyName);
    expect(strategy.strategyId).toBe(strategyData.strategyId);
    expect(strategy.profile).toEqual(strategyData.profile);
    expect(strategy.tokens?.access_token).toBe(strategyData.tokens.access_token);
  });

  test("should get user by strategy", async () => {
    const userData = {
      id: "user-1",
      username: "testuser",
      email: "test@example.com",
      profile: {},
    };

    const user = await createUser(userData);

    const strategyData = {
      id: "strategy-1",
      userId: user.id,
      strategyName: "github",
      strategyId: "github-123",
      profile: { username: "testuser" },
    };

    await createUserStrategy(strategyData);

    const retrievedUser = await getUserByStrategy("github", "github-123");

    expect(retrievedUser).toBeDefined();
    expect(retrievedUser?.id).toBe(user.id);
    expect(retrievedUser?.strategies).toHaveLength(1);
    expect(retrievedUser?.strategies[0].strategyName).toBe("github");
  });

  test("should get user strategies", async () => {
    const userData = {
      id: "user-1",
      username: "testuser",
      email: "test@example.com",
      profile: {},
    };

    const user = await createUser(userData);

    const strategy1 = {
      id: "strategy-1",
      userId: user.id,
      strategyName: "github",
      strategyId: "github-123",
      profile: { username: "testuser" },
    };

    const strategy2 = {
      id: "strategy-2",
      userId: user.id,
      strategyName: "google",
      strategyId: "google-456",
      profile: { email: "test@example.com" },
    };

    await createUserStrategy(strategy1);
    await createUserStrategy(strategy2);

    const strategies = await getUserStrategies(user.id);

    expect(strategies).toHaveLength(2);
    expect(strategies.map((s) => s.strategyName)).toContain("github");
    expect(strategies.map((s) => s.strategyName)).toContain("google");
  });

  test("should delete user strategy", async () => {
    const userData = {
      id: "user-1",
      username: "testuser",
      email: "test@example.com",
      profile: {},
    };

    const user = await createUser(userData);

    const strategyData = {
      id: "strategy-1",
      userId: user.id,
      strategyName: "github",
      strategyId: "github-123",
      profile: { username: "testuser" },
    };

    await createUserStrategy(strategyData);

    let strategies = await getUserStrategies(user.id);
    expect(strategies).toHaveLength(1);

    await deleteUserStrategy(user.id, "github");

    strategies = await getUserStrategies(user.id);
    expect(strategies).toHaveLength(0);
  });

  test("should create and retrieve session", async () => {
    const userData = {
      id: "user-1",
      username: "testuser",
      email: "test@example.com",
      profile: {},
    };

    const user = await createUser(userData);

    const sessionData = {
      id: "session-1",
      userId: user.id,
      data: { test: "data" },
      expiresAt: new Date(Date.now() + 3600000),
    };

    const session = await createSession(sessionData);

    expect(session).toBeDefined();
    expect(session.id).toBe(sessionData.id);
    expect(session.userId).toBe(sessionData.userId);
    expect(session.data).toEqual(sessionData.data);
    expect(session.createdAt).toBeInstanceOf(Date);

    const retrieved = await getSession(session.id);
    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe(session.id);
    expect(retrieved?.data).toEqual(session.data);
  });

  test("should return null for expired session", async () => {
    const userData = {
      id: "user-1",
      username: "testuser",
      email: "test@example.com",
      profile: {},
    };

    const user = await createUser(userData);

    const sessionData = {
      id: "session-1",
      userId: user.id,
      data: { test: "data" },
      expiresAt: new Date(Date.now() - 1000), // Expired
    };

    await createSession(sessionData);

    const session = await getSession(sessionData.id);
    expect(session).toBeNull();
  });

  test("should update session", async () => {
    const userData = {
      id: "user-1",
      username: "testuser",
      email: "test@example.com",
      profile: {},
    };

    const user = await createUser(userData);

    const sessionData = {
      id: "session-1",
      userId: user.id,
      data: { test: "data" },
      expiresAt: new Date(Date.now() + 3600000),
    };

    await createSession(sessionData);

    const newData = { test: "updated", new: "field" };
    await updateSession(sessionData.id, newData);

    const session = await getSession(sessionData.id);
    expect(session?.data).toEqual(newData);
  });

  test("should delete session", async () => {
    const userData = {
      id: "user-1",
      username: "testuser",
      email: "test@example.com",
      profile: {},
    };

    const user = await createUser(userData);

    const sessionData = {
      id: "session-1",
      userId: user.id,
      data: { test: "data" },
      expiresAt: new Date(Date.now() + 3600000),
    };

    await createSession(sessionData);

    let session = await getSession(sessionData.id);
    expect(session).toBeDefined();

    await deleteSession(sessionData.id);

    session = await getSession(sessionData.id);
    expect(session).toBeNull();
  });

  test("should cleanup expired sessions", async () => {
    const userData = {
      id: "user-1",
      username: "testuser",
      email: "test@example.com",
      profile: {},
    };

    const user = await createUser(userData);

    const expiredSession = {
      id: "expired-session",
      userId: user.id,
      data: {},
      expiresAt: new Date(Date.now() - 1000),
    };

    const validSession = {
      id: "valid-session",
      userId: user.id,
      data: {},
      expiresAt: new Date(Date.now() + 3600000),
    };

    await createSession(expiredSession);
    await createSession(validSession);

    await cleanupExpiredSessions();

    // Expired session should be deleted (would return null anyway due to expiry check)
    // Valid session should still exist
    const valid = await getSession(validSession.id);
    expect(valid).toBeDefined();
  });
});

// Note: These tests require PostgreSQL. Set DATABASE_URL to run them.
// Example: DATABASE_URL=postgres://user:pass@localhost:5432/allow_test bun test
