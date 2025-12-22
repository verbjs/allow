import type { Request, Response } from "verb";
import * as db from "./database";
import { createAuthMiddleware, sessionMiddleware } from "./middleware";
import { createJWTStrategy } from "./strategies/jwt";
import { createLocalStrategy } from "./strategies/local";
import {
  createOAuthStrategy,
  discordStrategy,
  githubStrategy,
  googleStrategy,
} from "./strategies/oauth";
import type {
  AuthConfig,
  AuthHandlers,
  AuthResult,
  AuthSession,
  AuthStrategy,
  AuthUser,
  UserStrategy,
} from "./types";

export interface AllowInstance {
  config: AuthConfig;
  strategies: Map<string, AuthStrategy>;
  database?: any;
}

export function createAllow(config: AuthConfig): AllowInstance {
  const strategies = new Map<string, AuthStrategy>();
  let database: any;

  if (config.database) {
    database = db.createDatabase(config.database);
  }

  // Setup strategies
  for (const strategyConfig of config.strategies) {
    if (!strategyConfig.enabled && strategyConfig.enabled !== undefined) {
      continue;
    }

    let strategy: AuthStrategy;

    switch (strategyConfig.type) {
      case "local":
        strategy = createLocalStrategy(strategyConfig.config);
        break;
      case "oauth":
        strategy = createOAuthStrategy(strategyConfig.name, strategyConfig.config);
        break;
      case "jwt":
        strategy = createJWTStrategy(strategyConfig.config);
        break;
      default:
        throw new Error(`Unknown strategy type: ${strategyConfig.type}`);
    }

    strategies.set(strategyConfig.name, strategy);
  }

  return {
    config,
    strategies,
    database,
  };
}

export function useStrategy(allow: AllowInstance, strategy: AuthStrategy): void {
  allow.strategies.set(strategy.name, strategy);
}

export async function authenticate(
  allow: AllowInstance,
  strategyName: string,
  req: Request,
): Promise<AuthResult> {
  const strategy = allow.strategies.get(strategyName);
  if (!strategy) {
    return { success: false, error: `Strategy '${strategyName}' not found` };
  }

  const strategyConfig = allow.config.strategies.find((s) => s.name === strategyName);
  return strategy.authenticate(req, strategyConfig?.config);
}

export async function callback(
  allow: AllowInstance,
  strategyName: string,
  req: Request,
): Promise<AuthResult> {
  const strategy = allow.strategies.get(strategyName);
  if (!strategy?.callback) {
    return { success: false, error: `Strategy '${strategyName}' does not support callbacks` };
  }

  const strategyConfig = allow.config.strategies.find((s) => s.name === strategyName);
  return strategy.callback(req, strategyConfig?.config);
}

export async function createSession(
  allow: AllowInstance,
  user: AuthUser,
  data: Record<string, any> = {},
): Promise<AuthSession> {
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + (allow.config.sessionDuration || 86400000)); // 24 hours default

  const session: AuthSession = {
    id: sessionId,
    userId: user.id,
    data,
    expiresAt,
    createdAt: new Date(),
  };

  if (allow.database) {
    await db.createDatabaseSession(allow.database, session);
  }

  return session;
}

export async function getSession(
  allow: AllowInstance,
  sessionId: string,
): Promise<AuthSession | null> {
  if (!allow.database) {
    return null;
  }
  return db.getDatabaseSession(allow.database, sessionId);
}

export async function updateSession(
  allow: AllowInstance,
  sessionId: string,
  data: Record<string, any>,
): Promise<void> {
  if (!allow.database) {
    return;
  }
  await db.updateDatabaseSession(allow.database, sessionId, data);
}

export async function destroySession(allow: AllowInstance, sessionId: string): Promise<void> {
  if (!allow.database) {
    return;
  }
  await db.deleteSession(allow.database, sessionId);
}

export async function getUser(allow: AllowInstance, req: Request): Promise<AuthUser | null> {
  const sessionId = req.cookies?.["allow-session"];
  if (!sessionId || !allow.database) {
    return null;
  }

  const session = await db.getDatabaseSession(allow.database, sessionId);
  if (!session) {
    return null;
  }

  return db.getUserById(allow.database, session.userId);
}

export async function linkStrategy(
  allow: AllowInstance,
  userId: string,
  strategyName: string,
  strategyId: string,
  profile: any,
  tokens?: any,
): Promise<UserStrategy> {
  if (!allow.database) {
    throw new Error("Database required for linking strategies");
  }

  const userStrategy: Omit<UserStrategy, "createdAt" | "updatedAt"> = {
    id: crypto.randomUUID(),
    userId,
    strategyName,
    strategyId,
    profile,
    tokens,
  };

  return db.createUserStrategy(allow.database, userStrategy);
}

export async function unlinkStrategy(
  allow: AllowInstance,
  userId: string,
  strategyName: string,
): Promise<void> {
  if (!allow.database) {
    throw new Error("Database required for unlinking strategies");
  }

  await db.deleteUserStrategy(allow.database, userId, strategyName);
}

export async function getUserStrategies(
  allow: AllowInstance,
  userId: string,
): Promise<UserStrategy[]> {
  if (!allow.database) {
    return [];
  }
  return db.getDatabaseUserStrategies(allow.database, userId);
}

export function getMiddleware(allow: AllowInstance) {
  return createAuthMiddleware(allow);
}

export function getSessionMiddleware(allow: AllowInstance) {
  return sessionMiddleware(allow);
}

export function getHandlers(allow: AllowInstance): AuthHandlers {
  return {
    login: (strategyName: string) => {
      return async (req: Request, res: Response) => {
        const result = await authenticate(allow, strategyName, req);

        if (!result.success) {
          return res.status(400).json({ error: result.error });
        }

        if (result.redirect) {
          return res.redirect(result.redirect);
        }

        if (result.user) {
          const session = await createSession(allow, result.user);
          res.cookie("allow-session", session.id, {
            httpOnly: true,
            secure: req.secure,
            maxAge: allow.config.sessionDuration || 86400000,
          });
        }

        res.json({ success: true, user: result.user });
      };
    },

    callback: (strategyName: string) => {
      return async (req: Request, res: Response) => {
        const result = await callback(allow, strategyName, req);

        if (!result.success) {
          return res.status(400).json({ error: result.error });
        }

        if (result.user) {
          let user = result.user;

          if (allow.database) {
            const existingUser = await db.getUserByStrategy(allow.database, strategyName, user.id);
            if (existingUser) {
              user = existingUser;
            } else {
              user = await db.createUser(allow.database, user);
              await linkStrategy(
                allow,
                user.id,
                strategyName,
                result.user.id,
                result.user.profile,
                result.tokens,
              );
            }
          }

          const session = await createSession(allow, user);
          res.cookie("allow-session", session.id, {
            httpOnly: true,
            secure: req.secure,
            maxAge: allow.config.sessionDuration || 86400000,
          });
        }

        res.json({ success: true, user: result.user });
      };
    },

    logout: async (req: Request, res: Response) => {
      const sessionId = req.cookies?.["allow-session"];
      if (sessionId) {
        await destroySession(allow, sessionId);
      }

      res.clearCookie("allow-session");
      res.json({ success: true });
    },

    profile: async (req: Request, res: Response) => {
      const user = await getUser(allow, req);
      if (!user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const strategies = await getUserStrategies(allow, user.id);
      res.json({ user: { ...user, strategies } });
    },

    link: (strategyName: string) => {
      return async (req: Request, res: Response) => {
        const user = await getUser(allow, req);
        if (!user) {
          return res.status(401).json({ error: "Not authenticated" });
        }

        const result = await authenticate(allow, strategyName, req);
        if (!result.success) {
          return res.status(400).json({ error: result.error });
        }

        if (result.redirect) {
          return res.redirect(result.redirect);
        }

        if (result.user) {
          await linkStrategy(
            allow,
            user.id,
            strategyName,
            result.user.id,
            result.user.profile,
            result.tokens,
          );
        }

        res.json({ success: true });
      };
    },

    unlink: (strategyName: string) => {
      return async (req: Request, res: Response) => {
        const user = await getUser(allow, req);
        if (!user) {
          return res.status(401).json({ error: "Not authenticated" });
        }

        const strategies = await getUserStrategies(allow, user.id);
        if (strategies.length <= 1) {
          return res.status(400).json({ error: "Cannot unlink last authentication method" });
        }

        await unlinkStrategy(allow, user.id, strategyName);
        res.json({ success: true });
      };
    },
  };
}

export { githubStrategy, googleStrategy, discordStrategy };
