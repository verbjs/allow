import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { createDatabase, createUser, getUserById, createUserStrategy, getUserByStrategy, getDatabaseUserStrategies, deleteUserStrategy, createDatabaseSession, getDatabaseSession, updateDatabaseSession, deleteSession, cleanupExpiredSessions } from "../src/database";
import type { DatabaseInstance } from "../src/database";
import type { AuthUser, UserStrategy, AuthSession } from "../src/types";

describe("AuthDatabase", () => {
  let db: DatabaseInstance;
  let testSqliteDb: Database;

  beforeEach(() => {
    db = createDatabase({
      type: "sqlite",
      connection: ":memory:",
      migrate: true
    });
  });

  afterEach(() => {
    testSqliteDb?.close();
  });

  test("should create database with migration", () => {
    expect(db).toBeDefined();
  });

  test("should create and retrieve user", async () => {
    const userData = {
      id: "user-1",
      username: "testuser",
      email: "test@example.com",
      profile: { role: "user" },
      strategies: []
    };

    const user = await createUser(db, userData);
    
    expect(user).toBeDefined();
    expect(user.id).toBe(userData.id);
    expect(user.username).toBe(userData.username);
    expect(user.email).toBe(userData.email);
    expect(user.profile).toEqual(userData.profile);
    expect(user.createdAt).toBeInstanceOf(Date);
    expect(user.updatedAt).toBeInstanceOf(Date);

    const retrieved = await getUserById(db, user.id);
    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe(user.id);
    expect(retrieved?.username).toBe(user.username);
  });

  test("should return null for non-existent user", async () => {
    const user = await getUserById(db, "non-existent");
    expect(user).toBeNull();
  });

  test("should create and retrieve user strategy", async () => {
    const userData = {
      id: "user-1",
      username: "testuser",
      email: "test@example.com",
      profile: {},
      strategies: []
    };

    const user = await createUser(db, userData);

    const strategyData = {
      id: "strategy-1",
      userId: user.id,
      strategyName: "github",
      strategyId: "github-123",
      profile: { username: "testuser", email: "test@example.com" },
      tokens: {
        access_token: "token-123",
        refresh_token: "refresh-123",
        expires_at: new Date(Date.now() + 3600000)
      }
    };

    const strategy = await createUserStrategy(db, strategyData);
    
    expect(strategy).toBeDefined();
    expect(strategy.id).toBe(strategyData.id);
    expect(strategy.userId).toBe(strategyData.userId);
    expect(strategy.strategyName).toBe(strategyData.strategyName);
    expect(strategy.strategyId).toBe(strategyData.strategyId);
    expect(strategy.profile).toEqual(strategyData.profile);
    expect(strategy.tokens).toEqual(strategyData.tokens);
  });

  test("should get user by strategy", async () => {
    const userData = {
      id: "user-1",
      username: "testuser",
      email: "test@example.com",
      profile: {},
      strategies: []
    };

    const user = await createUser(db, userData);

    const strategyData = {
      id: "strategy-1",
      userId: user.id,
      strategyName: "github",
      strategyId: "github-123",
      profile: { username: "testuser" }
    };

    await createUserStrategy(db, strategyData);

    const retrievedUser = await getUserByStrategy(db, "github", "github-123");
    
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
      strategies: []
    };

    const user = await createUser(db, userData);

    const strategy1 = {
      id: "strategy-1",
      userId: user.id,
      strategyName: "github",
      strategyId: "github-123",
      profile: { username: "testuser" }
    };

    const strategy2 = {
      id: "strategy-2",
      userId: user.id,
      strategyName: "google",
      strategyId: "google-456",
      profile: { email: "test@example.com" }
    };

    await createUserStrategy(db, strategy1);
    await createUserStrategy(db, strategy2);

    const strategies = await getDatabaseUserStrategies(db, user.id);
    
    expect(strategies).toHaveLength(2);
    expect(strategies.map(s => s.strategyName)).toContain("github");
    expect(strategies.map(s => s.strategyName)).toContain("google");
  });

  test("should delete user strategy", async () => {
    const userData = {
      id: "user-1",
      username: "testuser",
      email: "test@example.com",
      profile: {},
      strategies: []
    };

    const user = await createUser(db, userData);

    const strategyData = {
      id: "strategy-1",
      userId: user.id,
      strategyName: "github",
      strategyId: "github-123",
      profile: { username: "testuser" }
    };

    await createUserStrategy(db, strategyData);

    let strategies = await getDatabaseUserStrategies(db, user.id);
    expect(strategies).toHaveLength(1);

    await deleteUserStrategy(db, user.id, "github");

    strategies = await getDatabaseUserStrategies(db, user.id);
    expect(strategies).toHaveLength(0);
  });

  test("should create and retrieve session", async () => {
    const userData = {
      id: "user-1",
      username: "testuser",
      email: "test@example.com",
      profile: {},
      strategies: []
    };

    const user = await createUser(db, userData);

    const sessionData = {
      id: "session-1",
      userId: user.id,
      data: { test: "data" },
      expiresAt: new Date(Date.now() + 3600000)
    };

    const session = await createDatabaseSession(db, sessionData);
    
    expect(session).toBeDefined();
    expect(session.id).toBe(sessionData.id);
    expect(session.userId).toBe(sessionData.userId);
    expect(session.data).toEqual(sessionData.data);
    expect(session.expiresAt).toEqual(sessionData.expiresAt);
    expect(session.createdAt).toBeInstanceOf(Date);

    const retrieved = await getDatabaseSession(db, session.id);
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
      strategies: []
    };

    const user = await createUser(db, userData);

    const sessionData = {
      id: "session-1",
      userId: user.id,
      data: { test: "data" },
      expiresAt: new Date(Date.now() - 1000) // Expired
    };

    await createDatabaseSession(db, sessionData);

    const session = await getDatabaseSession(db, sessionData.id);
    expect(session).toBeNull();
  });

  test("should update session", async () => {
    const userData = {
      id: "user-1",
      username: "testuser",
      email: "test@example.com",
      profile: {},
      strategies: []
    };

    const user = await createUser(db, userData);

    const sessionData = {
      id: "session-1",
      userId: user.id,
      data: { test: "data" },
      expiresAt: new Date(Date.now() + 3600000)
    };

    await createDatabaseSession(db, sessionData);

    const newData = { test: "updated", new: "field" };
    await updateDatabaseSession(db, sessionData.id, newData);

    const session = await getDatabaseSession(db, sessionData.id);
    expect(session?.data).toEqual(newData);
  });

  test("should delete session", async () => {
    const userData = {
      id: "user-1",
      username: "testuser",
      email: "test@example.com",
      profile: {},
      strategies: []
    };

    const user = await createUser(db, userData);

    const sessionData = {
      id: "session-1",
      userId: user.id,
      data: { test: "data" },
      expiresAt: new Date(Date.now() + 3600000)
    };

    await createDatabaseSession(db, sessionData);

    let session = await getDatabaseSession(db, sessionData.id);
    expect(session).toBeDefined();

    await deleteSession(db, sessionData.id);

    session = await getDatabaseSession(db, sessionData.id);
    expect(session).toBeNull();
  });

  test("should cleanup expired sessions", async () => {
    const userData = {
      id: "user-1",
      username: "testuser",
      email: "test@example.com",
      profile: {},
      strategies: []
    };

    const user = await createUser(db, userData);

    const expiredSession = {
      id: "expired-session",
      userId: user.id,
      data: {},
      expiresAt: new Date(Date.now() - 1000)
    };

    const validSession = {
      id: "valid-session",
      userId: user.id,
      data: {},
      expiresAt: new Date(Date.now() + 3600000)
    };

    await createDatabaseSession(db, expiredSession);
    await createDatabaseSession(db, validSession);

    await cleanupExpiredSessions(db);

    const expired = await getDatabaseSession(db, expiredSession.id);
    const valid = await getDatabaseSession(db, validSession.id);

    expect(expired).toBeNull();
    expect(valid).toBeDefined();
  });
});