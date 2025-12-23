/**
 * Allow database schemas using Hull
 */

import { schema, type InferRow } from "@verb-js/hull";

/**
 * Auth users table - stores user accounts
 */
export const AuthUser = schema("auth_users")
  .string("id", 21, { primaryKey: true })
  .string("username", 255, { nullable: true, unique: true })
  .string("email", 255, { nullable: true, unique: true })
  .text("profile", { nullable: true }) // JSON stored as text
  .datetime("created_at", { default: "now()" })
  .datetime("updated_at", { default: "now()" });

/**
 * User strategies table - links auth methods (local, oauth) to users
 */
export const UserStrategy = schema("user_strategies")
  .string("id", 21, { primaryKey: true })
  .string("user_id", 21)
  .string("strategy_name", 100)
  .string("strategy_id", 255)
  .text("profile", { nullable: true }) // JSON
  .text("tokens", { nullable: true }) // JSON with access_token, refresh_token, expires_at
  .datetime("created_at", { default: "now()" })
  .datetime("updated_at", { default: "now()" });

/**
 * Auth sessions table - stores active user sessions
 */
export const AuthSession = schema("auth_sessions")
  .string("id", 21, { primaryKey: true })
  .string("user_id", 21)
  .text("data", { nullable: true }) // JSON session data
  .datetime("expires_at")
  .datetime("created_at", { default: "now()" });

/**
 * All schemas for sync operations
 */
export const schemas = [AuthUser, UserStrategy, AuthSession];

/**
 * Type definitions inferred from schemas
 */
export type AuthUserRow = InferRow<typeof AuthUser>;
export type UserStrategyRow = InferRow<typeof UserStrategy>;
export type AuthSessionRow = InferRow<typeof AuthSession>;
