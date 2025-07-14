import { Database } from "bun:sqlite";
import type { AuthUser, UserStrategy, AuthSession, DatabaseConfig } from "./types";

export interface DatabaseInstance {
  db: Database;
}

export function createDatabase(config: DatabaseConfig): DatabaseInstance {
  if (config.type !== "sqlite") {
    throw new Error("PostgreSQL support coming soon");
  }

  const db = new Database(config.connection);
  
  if (config.migrate) {
    migrate(db);
  }

  return { db };
}

function migrate(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS auth_users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE,
      email TEXT UNIQUE,
      profile TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_strategies (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      strategy_name TEXT NOT NULL,
      strategy_id TEXT NOT NULL,
      profile TEXT,
      tokens TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE,
      UNIQUE(strategy_name, strategy_id)
    );

    CREATE TABLE IF NOT EXISTS auth_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      data TEXT,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_user_strategies_user_id ON user_strategies(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_strategies_strategy ON user_strategies(strategy_name, strategy_id);
    CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires ON auth_sessions(expires_at);
  `);
}

export async function createUser(database: DatabaseInstance, userData: Omit<AuthUser, "createdAt" | "updatedAt">): Promise<AuthUser> {
  const query = database.db.query(`
    INSERT INTO auth_users (id, username, email, profile, created_at, updated_at)
    VALUES (?1, ?2, ?3, ?4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    RETURNING *
  `);

  const row = query.get(
    userData.id,
    userData.username,
    userData.email,
    JSON.stringify(userData.profile || {})
  ) as any;

  return {
    ...row,
    profile: JSON.parse(row.profile || "{}"),
    strategies: [],
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at)
  };
}

export async function getUserById(database: DatabaseInstance, id: string): Promise<AuthUser | null> {
  const query = database.db.query("SELECT * FROM auth_users WHERE id = ?1");
  const row = query.get(id) as any;
  
  if (!row) return null;

  const strategies = await getDatabaseUserStrategies(database, id);
  
  return {
    ...row,
    profile: JSON.parse(row.profile || "{}"),
    strategies,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at)
  };
}

export async function getUserByStrategy(database: DatabaseInstance, strategyName: string, strategyId: string): Promise<AuthUser | null> {
  const query = database.db.query(`
    SELECT u.* FROM auth_users u
    JOIN user_strategies s ON u.id = s.user_id
    WHERE s.strategy_name = ?1 AND s.strategy_id = ?2
  `);
  
  const row = query.get(strategyName, strategyId) as any;
  
  if (!row) return null;

  const strategies = await getDatabaseUserStrategies(database, row.id);
  
  return {
    ...row,
    profile: JSON.parse(row.profile || "{}"),
    strategies,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at)
  };
}

export async function getDatabaseUserStrategies(database: DatabaseInstance, userId: string): Promise<UserStrategy[]> {
  const query = database.db.query("SELECT * FROM user_strategies WHERE user_id = ?1");
  const rows = query.all(userId) as any[];
  
  return rows.map(row => ({
    id: row.id,
    userId: row.user_id,
    strategyName: row.strategy_name,
    strategyId: row.strategy_id,
    profile: JSON.parse(row.profile || "{}"),
    tokens: row.tokens ? JSON.parse(row.tokens, (key, value) => {
      if (key === 'expires_at' && typeof value === 'string') {
        return new Date(value);
      }
      return value;
    }) : undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at)
  }));
}

export async function createUserStrategy(database: DatabaseInstance, strategyData: Omit<UserStrategy, "createdAt" | "updatedAt">): Promise<UserStrategy> {
  const query = database.db.query(`
    INSERT INTO user_strategies (id, user_id, strategy_name, strategy_id, profile, tokens, created_at, updated_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    RETURNING *
  `);

  const row = query.get(
    strategyData.id,
    strategyData.userId,
    strategyData.strategyName,
    strategyData.strategyId,
    JSON.stringify(strategyData.profile || {}),
    JSON.stringify(strategyData.tokens || {})
  ) as any;

  return {
    id: row.id,
    userId: row.user_id,
    strategyName: row.strategy_name,
    strategyId: row.strategy_id,
    profile: JSON.parse(row.profile || "{}"),
    tokens: row.tokens ? JSON.parse(row.tokens, (key, value) => {
      if (key === 'expires_at' && typeof value === 'string') {
        return new Date(value);
      }
      return value;
    }) : undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at)
  };
}

export async function deleteUserStrategy(database: DatabaseInstance, userId: string, strategyName: string): Promise<void> {
  const query = database.db.query("DELETE FROM user_strategies WHERE user_id = ?1 AND strategy_name = ?2");
  query.run(userId, strategyName);
}

export async function createDatabaseSession(database: DatabaseInstance, sessionData: Omit<AuthSession, "createdAt">): Promise<AuthSession> {
  const query = database.db.query(`
    INSERT INTO auth_sessions (id, user_id, data, expires_at, created_at)
    VALUES (?1, ?2, ?3, ?4, CURRENT_TIMESTAMP)
    RETURNING *
  `);

  const row = query.get(
    sessionData.id,
    sessionData.userId,
    JSON.stringify(sessionData.data || {}),
    sessionData.expiresAt.toISOString()
  ) as any;

  return {
    id: row.id,
    userId: row.user_id,
    data: JSON.parse(row.data || "{}"),
    expiresAt: new Date(row.expires_at),
    createdAt: new Date(row.created_at)
  };
}

export async function getDatabaseSession(database: DatabaseInstance, sessionId: string): Promise<AuthSession | null> {
  const query = database.db.query("SELECT * FROM auth_sessions WHERE id = ?1");
  const row = query.get(sessionId) as any;
  
  if (!row) return null;

  const session = {
    id: row.id,
    userId: row.user_id,
    data: JSON.parse(row.data || "{}"),
    expiresAt: new Date(row.expires_at),
    createdAt: new Date(row.created_at)
  };

  // Check if session is expired
  if (session.expiresAt <= new Date()) {
    return null;
  }

  return session;
}

export async function updateDatabaseSession(database: DatabaseInstance, sessionId: string, data: Record<string, any>): Promise<void> {
  const query = database.db.query("UPDATE auth_sessions SET data = ?1 WHERE id = ?2");
  query.run(JSON.stringify(data), sessionId);
}

export async function deleteSession(database: DatabaseInstance, sessionId: string): Promise<void> {
  const query = database.db.query("DELETE FROM auth_sessions WHERE id = ?1");
  query.run(sessionId);
}

export async function cleanupExpiredSessions(database: DatabaseInstance): Promise<void> {
  const query = database.db.query("DELETE FROM auth_sessions WHERE expires_at <= ?1");
  query.run(new Date().toISOString());
}