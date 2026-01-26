import type { Request, Response } from "verb";
import type { AllowInstance } from "./allow";
import { getSession, getUser } from "./allow";
import type { AuthMiddleware, AuthSession, AuthUser } from "./types";

// Extended request type with auth properties
type AuthRequest = Request & {
  user?: AuthUser;
  session?: AuthSession;
  isAuthenticated?: () => boolean;
};

export function createAuthMiddleware(allow: AllowInstance): AuthMiddleware {
  return {
    requireAuth: async (req: Request, res: Response, next: () => void): Promise<void> => {
      const user = await getUser(allow, req);

      if (!user) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }

      (req as AuthRequest).user = user;
      (req as AuthRequest).isAuthenticated = () => true;
      next();
    },

    optionalAuth: async (req: Request, _res: Response, next: () => void): Promise<void> => {
      const user = await getUser(allow, req);

      if (user) {
        (req as AuthRequest).user = user;
        (req as AuthRequest).isAuthenticated = () => true;
      } else {
        (req as AuthRequest).isAuthenticated = () => false;
      }

      next();
    },

    requireRole: (role: string) => {
      return async (req: Request, res: Response, next: () => void): Promise<void> => {
        const user = await getUser(allow, req);

        if (!user) {
          res.status(401).json({ error: "Authentication required" });
          return;
        }

        if (!user.profile?.roles?.includes(role)) {
          res.status(403).json({ error: "Insufficient permissions" });
          return;
        }

        (req as AuthRequest).user = user;
        (req as AuthRequest).isAuthenticated = () => true;
        next();
      };
    },
  };
}

export function sessionMiddleware(allow: AllowInstance) {
  return async (req: Request, _res: Response, next: () => void) => {
    const sessionId = (req as any).cookies?.["allow-session"];

    if (sessionId) {
      const session = await getSession(allow, sessionId);
      if (session) {
        (req as AuthRequest).session = session;
      }
    }

    next();
  };
}

// Re-export the extended request type for consumers
export type { AuthRequest };
