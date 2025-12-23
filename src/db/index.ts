/**
 * Allow database connection and utilities using Hull
 */

import { connect, disconnect, sync, type Repo } from "@verb-js/hull";
import { schemas } from "./schema";

let repo: Repo | null = null;

/**
 * Initialize database connection
 * @param url Database URL (sqlite:///path or postgres://...)
 */
export function initDatabase(url: string): Repo {
  repo = connect({ url });
  return repo;
}

/**
 * Get the current database repository
 * @throws Error if database not initialized
 */
export function getRepo(): Repo {
  if (!repo) {
    throw new Error("Database not initialized. Call initDatabase() first.");
  }
  return repo;
}

/**
 * Check if database is initialized
 */
export function isDatabaseInitialized(): boolean {
  return repo !== null;
}

/**
 * Sync database schema (creates tables and adds missing columns)
 */
export async function syncDatabase() {
  const result = await sync(getRepo(), schemas);
  return result;
}

/**
 * Close database connection
 */
export async function closeDatabase(): Promise<void> {
  if (repo) {
    await disconnect(repo);
    repo = null;
  }
}

// Re-export Hull utilities for convenience
export {
  all,
  cast,
  changeset,
  count,
  exists,
  from,
  type InferRow,
  insert,
  limit,
  offset,
  one,
  orderBy,
  raw,
  remove,
  type Repo,
  transaction,
  update,
  validateFormat,
  validateLength,
  validateRequired,
  whereEq,
  whereIn,
  whereNotNull,
  whereNull,
} from "@verb-js/hull";

// Re-export schemas
export * from "./schema";
