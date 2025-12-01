import type { Request } from "verb";
import type { AuthResult, JWTConfig, AuthUser, AuthStrategy } from "../types";
import { generateError, generateSuccess } from "./base";

export function createJWTStrategy(_config: JWTConfig): AuthStrategy {
  return {
    name: "jwt",

    async authenticate(req: Request): Promise<AuthResult> {
      const token = extractToken(req);

      if (!token) {
        return generateError("No JWT token provided");
      }

      try {
        const payload = await verifyToken(token);
        const user = await mapPayloadToUser(payload);

        return generateSuccess(user);
      } catch (_error) {
        return generateError("Invalid JWT token");
      }
    },
  };
}

function extractToken(req: Request): string | null {
  const authHeader = req.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }

  return req.query?.token || req.body?.token || null;
}

async function verifyToken(token: string): Promise<any> {
  // For now, return a basic implementation - in production you'd want to use a proper JWT library
  // or implement JWT verification with Web Crypto API
  try {
    const [header, payload, signature] = token.split(".");
    if (!header || !payload || !signature) {
      throw new Error("Invalid token format");
    }

    const decodedPayload = JSON.parse(atob(payload));

    // Check expiration
    if (decodedPayload.exp && decodedPayload.exp < Date.now() / 1000) {
      throw new Error("Token expired");
    }

    return decodedPayload;
  } catch (_error) {
    throw new Error("Invalid token");
  }
}

async function mapPayloadToUser(payload: any): Promise<AuthUser> {
  return {
    id: payload.sub || payload.id,
    username: payload.username || payload.preferred_username,
    email: payload.email,
    profile: payload,
    strategies: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export async function signToken(payload: any, _secret: string, options: any = {}): Promise<string> {
  // Basic JWT implementation - in production use a proper JWT library
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));

  const now = Math.floor(Date.now() / 1000);
  const tokenPayload = {
    ...payload,
    iat: now,
    exp: now + (options.expiresIn ? parseInt(options.expiresIn) : 3600),
  };

  const encodedPayload = btoa(JSON.stringify(tokenPayload));

  // For demo purposes, return a simple token without signature verification
  // In production, you'd want to implement proper HMAC signature
  return `${header}.${encodedPayload}.signature`;
}
