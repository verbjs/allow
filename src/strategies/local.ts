import type { VerbRequest } from "verb";
import type { AuthResult, LocalConfig, AuthUser, AuthStrategy } from "../types";
import { generateError, generateSuccess } from "./base";

export function createLocalStrategy(config: LocalConfig): AuthStrategy {
  return {
    name: "local",
    
    async authenticate(req: VerbRequest): Promise<AuthResult> {
      const { usernameField = "username", passwordField = "password" } = config;
      
      const username = req.body?.[usernameField];
      const password = req.body?.[passwordField];

      if (!username || !password) {
        return generateError("Missing username or password");
      }

      try {
        const user = await verifyCredentials(username, password);
        if (!user) {
          return generateError("Invalid credentials");
        }

        return generateSuccess(user);
      } catch (error) {
        return generateError("Authentication failed");
      }
    }
  };
}

async function verifyCredentials(username: string, password: string): Promise<AuthUser | null> {
  throw new Error("verifyCredentials must be implemented by the application");
}

export async function hashPassword(password: string, rounds: number = 10): Promise<string> {
  return await Bun.password.hash(password, {
    algorithm: "bcrypt",
    cost: rounds
  });
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await Bun.password.verify(password, hash);
}