/**
 * Allow database queries using Hull
 */

import type { AuthSession, AuthUser, UserStrategy } from "../types";
import {
  all,
  cast,
  changeset,
  from,
  getRepo,
  insert,
  one,
  raw,
  update,
  whereEq,
  AuthUser as AuthUserSchema,
  UserStrategy as UserStrategySchema,
  AuthSession as AuthSessionSchema,
  type AuthUserRow,
  type UserStrategyRow,
  type AuthSessionRow,
} from "./index";

// ============================================================================
// User Operations
// ============================================================================

/**
 * Create a new user
 */
export async function createUser(
  userData: Omit<AuthUser, "createdAt" | "updatedAt" | "strategies">,
): Promise<AuthUser> {
  const repo = getRepo();

  const cs = cast(
    changeset(AuthUserSchema, {}),
    {
      id: userData.id || crypto.randomUUID(),
      username: userData.username || null,
      email: userData.email || null,
      profile: userData.profile ? JSON.stringify(userData.profile) : null,
    },
    ["id", "username", "email", "profile"],
  );

  const row = await insert(repo, cs);
  return rowToUser(row as AuthUserRow, []);
}

/**
 * Get user by ID
 */
export async function getUserById(id: string): Promise<AuthUser | null> {
  const repo = getRepo();
  const row = await one(repo, whereEq(from(AuthUserSchema), "id", id));

  if (!row) {
    return null;
  }

  const strategies = await getUserStrategies(id);
  return rowToUser(row as AuthUserRow, strategies);
}

/**
 * Get user by linked strategy (e.g., GitHub OAuth)
 */
export async function getUserByStrategy(
  strategyName: string,
  strategyId: string,
): Promise<AuthUser | null> {
  const repo = getRepo();

  // Use raw query for JOIN
  const rows = await raw<AuthUserRow>(
    repo,
    `
    SELECT u.* FROM auth_users u
    JOIN user_strategies s ON u.id = s.user_id
    WHERE s.strategy_name = $1 AND s.strategy_id = $2
    LIMIT 1
  `,
    [strategyName, strategyId],
  );

  const row = rows[0];
  if (!row) {
    return null;
  }

  const strategies = await getUserStrategies(row.id!);
  return rowToUser(row, strategies);
}

// ============================================================================
// User Strategy Operations
// ============================================================================

/**
 * Get all strategies linked to a user
 */
export async function getUserStrategies(userId: string): Promise<UserStrategy[]> {
  const repo = getRepo();
  const rows = await all(repo, whereEq(from(UserStrategySchema), "user_id", userId));
  return (rows as UserStrategyRow[]).map(rowToStrategy);
}

/**
 * Create a user strategy link
 */
export async function createUserStrategy(
  strategyData: Omit<UserStrategy, "createdAt" | "updatedAt">,
): Promise<UserStrategy> {
  const repo = getRepo();

  const cs = cast(
    changeset(UserStrategySchema, {}),
    {
      id: strategyData.id || crypto.randomUUID(),
      user_id: strategyData.userId,
      strategy_name: strategyData.strategyName,
      strategy_id: strategyData.strategyId,
      profile: strategyData.profile ? JSON.stringify(strategyData.profile) : null,
      tokens: strategyData.tokens ? JSON.stringify(strategyData.tokens) : null,
    },
    ["id", "user_id", "strategy_name", "strategy_id", "profile", "tokens"],
  );

  const row = await insert(repo, cs);
  return rowToStrategy(row as UserStrategyRow);
}

/**
 * Delete a user strategy link
 */
export async function deleteUserStrategy(userId: string, strategyName: string): Promise<void> {
  const repo = getRepo();
  await raw(
    repo,
    `DELETE FROM user_strategies WHERE user_id = $1 AND strategy_name = $2`,
    [userId, strategyName],
  );
}

// ============================================================================
// Session Operations
// ============================================================================

/**
 * Create a new session
 */
export async function createSession(
  sessionData: Omit<AuthSession, "createdAt">,
): Promise<AuthSession> {
  const repo = getRepo();

  const cs = cast(
    changeset(AuthSessionSchema, {}),
    {
      id: sessionData.id || crypto.randomUUID(),
      user_id: sessionData.userId,
      data: sessionData.data ? JSON.stringify(sessionData.data) : null,
      expires_at: sessionData.expiresAt.toISOString(),
    },
    ["id", "user_id", "data", "expires_at"],
  );

  const row = await insert(repo, cs);
  return rowToSession(row as AuthSessionRow);
}

/**
 * Get session by ID (returns null if expired)
 */
export async function getSession(sessionId: string): Promise<AuthSession | null> {
  const repo = getRepo();
  const row = await one(repo, whereEq(from(AuthSessionSchema), "id", sessionId));

  if (!row) {
    return null;
  }

  const session = rowToSession(row as AuthSessionRow);

  // Check if session is expired
  if (session.expiresAt <= new Date()) {
    return null;
  }

  return session;
}

/**
 * Update session data
 */
export async function updateSession(
  sessionId: string,
  data: Record<string, unknown>,
): Promise<void> {
  const repo = getRepo();
  await raw(repo, `UPDATE auth_sessions SET data = $1 WHERE id = $2`, [JSON.stringify(data), sessionId]);
}

/**
 * Delete a session
 */
export async function deleteSession(sessionId: string): Promise<void> {
  const repo = getRepo();
  await raw(repo, `DELETE FROM auth_sessions WHERE id = $1`, [sessionId]);
}

/**
 * Clean up expired sessions
 */
export async function cleanupExpiredSessions(): Promise<void> {
  const repo = getRepo();
  await raw(repo, `DELETE FROM auth_sessions WHERE expires_at <= $1`, [new Date().toISOString()]);
}

// ============================================================================
// Row Conversion Helpers
// ============================================================================

function rowToUser(row: AuthUserRow, strategies: UserStrategy[]): AuthUser {
  return {
    id: row.id!,
    username: row.username ?? undefined,
    email: row.email ?? undefined,
    profile: row.profile ? JSON.parse(row.profile) : {},
    strategies,
    createdAt: new Date(row.created_at!),
    updatedAt: new Date(row.updated_at!),
  };
}

function rowToStrategy(row: UserStrategyRow): UserStrategy {
  return {
    id: row.id!,
    userId: row.user_id!,
    strategyName: row.strategy_name!,
    strategyId: row.strategy_id!,
    profile: row.profile ? JSON.parse(row.profile) : {},
    tokens: row.tokens
      ? JSON.parse(row.tokens, (key, value) => {
          // Convert expires_at string back to Date
          if (key === "expires_at" && typeof value === "string") {
            return new Date(value);
          }
          return value;
        })
      : undefined,
    createdAt: new Date(row.created_at!),
    updatedAt: new Date(row.updated_at!),
  };
}

function rowToSession(row: AuthSessionRow): AuthSession {
  return {
    id: row.id!,
    userId: row.user_id!,
    data: row.data ? JSON.parse(row.data) : {},
    expiresAt: new Date(row.expires_at!),
    createdAt: new Date(row.created_at!),
  };
}
