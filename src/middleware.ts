import type { Request, Response } from "verb";
import type { AuthMiddleware, AuthUser, AuthSession } from "./types";
import type { AllowInstance } from "./allow";
import { getUser, getSession } from "./allow";

export function createAuthMiddleware(allow: AllowInstance): AuthMiddleware {
  return {
    requireAuth: async (req: Request, res: Response, next: () => void) => {
      const user = await getUser(allow, req);
      
      if (!user) {
        return res.status(401).json({ error: "Authentication required" });
      }
      
      req.user = user;
      req.isAuthenticated = () => true;
      next();
    },

    optionalAuth: async (req: Request, res: Response, next: () => void) => {
      const user = await getUser(allow, req);
      
      if (user) {
        req.user = user;
        req.isAuthenticated = () => true;
      } else {
        req.isAuthenticated = () => false;
      }
      
      next();
    },

    requireRole: (role: string) => {
      return async (req: Request, res: Response, next: () => void) => {
        const user = await getUser(allow, req);
        
        if (!user) {
          return res.status(401).json({ error: "Authentication required" });
        }
        
        if (!user.profile?.roles?.includes(role)) {
          return res.status(403).json({ error: "Insufficient permissions" });
        }
        
        req.user = user;
        req.isAuthenticated = () => true;
        next();
      };
    }
  };
}

export function sessionMiddleware(allow: AllowInstance) {
  return async (req: Request, res: Response, next: () => void) => {
    const sessionId = req.cookies?.["allow-session"];
    
    if (sessionId) {
      const session = await getSession(allow, sessionId);
      if (session) {
        req.session = session;
      }
    }
    
    next();
  };
}

declare module "verb" {
  interface Request {
    user?: AuthUser;
    session?: AuthSession;
    isAuthenticated?: () => boolean;
  }
}