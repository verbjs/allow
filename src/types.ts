import type { VerbRequest, VerbResponse } from "verb";

export interface AuthConfig {
  secret: string;
  sessionDuration?: number;
  database?: DatabaseConfig;
  strategies: StrategyConfig[];
}

export interface DatabaseConfig {
  type: "sqlite" | "postgres";
  connection: string;
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
  authenticate: (req: VerbRequest, config: any) => Promise<AuthResult>;
  callback?: (req: VerbRequest, config: any) => Promise<AuthResult>;
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
  requireAuth: (req: VerbRequest, res: VerbResponse, next: () => void) => void | Promise<void>;
  optionalAuth: (req: VerbRequest, res: VerbResponse, next: () => void) => void | Promise<void>;
  requireRole: (role: string) => (req: VerbRequest, res: VerbResponse, next: () => void) => void | Promise<void>;
}

export interface AuthHandlers {
  login: (strategyName: string) => (req: VerbRequest, res: VerbResponse) => void | Promise<void>;
  callback: (strategyName: string) => (req: VerbRequest, res: VerbResponse) => void | Promise<void>;
  logout: (req: VerbRequest, res: VerbResponse) => void | Promise<void>;
  profile: (req: VerbRequest, res: VerbResponse) => void | Promise<void>;
  link: (strategyName: string) => (req: VerbRequest, res: VerbResponse) => void | Promise<void>;
  unlink: (strategyName: string) => (req: VerbRequest, res: VerbResponse) => void | Promise<void>;
}

