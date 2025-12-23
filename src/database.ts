/**
 * @deprecated Use the new db module directly: import { ... } from "./db"
 *
 * This file provides backward compatibility with the old database API.
 */

import type { DatabaseConfig } from "./types";
import {
  initDatabase,
  getRepo,
  isDatabaseInitialized,
  syncDatabase,
  closeDatabase,
  type Repo,
} from "./db";
import * as queries from "./db/queries";

/**
 * Backward-compatible DatabaseInstance type
 * @deprecated Use Repo from Hull directly
 */
export interface DatabaseInstance {
  repo: Repo;
}

/**
 * Convert old config format to Hull URL
 */
function configToUrl(config: DatabaseConfig): string {
  if (config.type === "sqlite") {
    // Handle :memory: and file paths
    if (config.connection === ":memory:") {
      return "sqlite://:memory:";
    }
    return `sqlite:///${config.connection}`;
  }
  // PostgreSQL URLs are usually already in the right format
  return config.connection;
}

/**
 * Create database connection (backward compatible)
 * @deprecated Use initDatabase from "./db" directly
 */
export function createDatabase(config: DatabaseConfig): DatabaseInstance {
  const url = configToUrl(config);
  const repo = initDatabase(url);

  // Auto-sync if migrate is true
  if (config.migrate) {
    // Note: This is async but the old API was sync
    // We'll need to handle this differently
    syncDatabase().catch(console.error);
  }

  return { repo };
}

// Re-export for backward compatibility
export { getRepo, isDatabaseInitialized, syncDatabase, closeDatabase };

// Backward-compatible query functions that accept DatabaseInstance
export async function createUser(
  _db: DatabaseInstance,
  userData: Parameters<typeof queries.createUser>[0],
) {
  return queries.createUser(userData);
}

export async function getUserById(_db: DatabaseInstance, id: string) {
  return queries.getUserById(id);
}

export async function getUserByStrategy(
  _db: DatabaseInstance,
  strategyName: string,
  strategyId: string,
) {
  return queries.getUserByStrategy(strategyName, strategyId);
}

export async function getDatabaseUserStrategies(_db: DatabaseInstance, userId: string) {
  return queries.getUserStrategies(userId);
}

export async function createUserStrategy(
  _db: DatabaseInstance,
  strategyData: Parameters<typeof queries.createUserStrategy>[0],
) {
  return queries.createUserStrategy(strategyData);
}

export async function deleteUserStrategy(
  _db: DatabaseInstance,
  userId: string,
  strategyName: string,
) {
  return queries.deleteUserStrategy(userId, strategyName);
}

export async function createDatabaseSession(
  _db: DatabaseInstance,
  sessionData: Parameters<typeof queries.createSession>[0],
) {
  return queries.createSession(sessionData);
}

export async function getDatabaseSession(_db: DatabaseInstance, sessionId: string) {
  return queries.getSession(sessionId);
}

export async function updateDatabaseSession(
  _db: DatabaseInstance,
  sessionId: string,
  data: Record<string, unknown>,
) {
  return queries.updateSession(sessionId, data);
}

export async function deleteSession(_db: DatabaseInstance, sessionId: string) {
  return queries.deleteSession(sessionId);
}

export async function cleanupExpiredSessions(_db: DatabaseInstance) {
  return queries.cleanupExpiredSessions();
}

// Re-export types
export type { AuthUserRow, UserStrategyRow, AuthSessionRow } from "./db/schema";
