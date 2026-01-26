import type { Request, Response } from "verb";

export interface AuthConfig {
  secret: string;
  sessionDuration?: number;
  database?: DatabaseConfig;
  strategies: StrategyConfig[];
}

/**
 * Database configuration for Hull
 *
 * @example SQLite
 * ```ts
 * { type: "sqlite", connection: "sqlite:///auth.db", migrate: true }
 * ```
 *
 * @example PostgreSQL
 * ```ts
 * { type: "postgres", connection: "postgres://user:pass@localhost:5432/mydb", migrate: true }
 * ```
 */
export interface DatabaseConfig {
  /** Database type */
  type: "sqlite" | "postgres";
  /** Database connection URL (sqlite:///path or postgres://...) */
  connection: string;
  /** Auto-sync schema on initialization (creates tables/columns) */
  migrate?: boolean;
}

export interface StrategyConfig {
  name: string;
  type: "local" | "oauth" | "saml" | "jwt";
  config: Record<string, any>;
  enabled?: boolean;
}

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  callbackURL: string;
  scope?: string[];
  authorizeURL?: string;
  tokenURL?: string;
  userInfoURL?: string;
}

export interface LocalConfig {
  usernameField?: string;
  passwordField?: string;
  hashRounds?: number;
  verifyCredentials?: (username: string, password: string) => Promise<AuthUser | null>;
}

export interface JWTConfig {
  secret: string;
  algorithm?: string;
  expiresIn?: string;
}

export interface AuthUser {
  id: string;
  username?: string;
  email?: string;
  profile?: Record<string, any>;
  strategies: UserStrategy[];
  createdAt: Date;
  updatedAt: Date;
}

export interface UserStrategy {
  id: string;
  userId: string;
  strategyName: string;
  strategyId: string;
  profile: Record<string, any>;
  tokens?: {
    access_token?: string;
    refresh_token?: string;
    expires_at?: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthSession {
  id: string;
  userId: string;
  data: Record<string, any>;
  expiresAt: Date;
  createdAt: Date;
}

export interface AuthStrategy {
  name: string;
  authenticate: (req: Request, config: any) => Promise<AuthResult>;
  callback?: (req: Request, config: any) => Promise<AuthResult>;
}

export interface AuthResult {
  success: boolean;
  user?: AuthUser;
  error?: string;
  redirect?: string;
  tokens?: {
    access_token?: string;
    refresh_token?: string;
    expires_at?: Date;
  };
}

export interface AuthMiddleware {
  requireAuth: (req: Request, res: Response, next: () => void) => void | Promise<void>;
  optionalAuth: (req: Request, res: Response, next: () => void) => void | Promise<void>;
  requireRole: (
    role: string,
  ) => (req: Request, res: Response, next: () => void) => void | Promise<void>;
}

export interface AuthHandlers {
  login: (strategyName: string) => (req: Request, res: Response) => Promise<void>;
  callback: (strategyName: string) => (req: Request, res: Response) => Promise<void>;
  logout: (req: Request, res: Response) => Promise<void>;
  profile: (req: Request, res: Response) => Promise<void>;
  link: (strategyName: string) => (req: Request, res: Response) => Promise<void>;
  unlink: (strategyName: string) => (req: Request, res: Response) => Promise<void>;
}
