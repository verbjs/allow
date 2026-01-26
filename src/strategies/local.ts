import type { Request } from "verb";
import type { AuthResult, AuthStrategy, LocalConfig } from "../types";
import { generateError, generateSuccess } from "./base";

export function createLocalStrategy(config: LocalConfig): AuthStrategy {
  return {
    name: "local",

    async authenticate(req: Request): Promise<AuthResult> {
      const { usernameField = "username", passwordField = "password" } = config;

      const username = (req as any).body?.[usernameField];
      const password = (req as any).body?.[passwordField];

      if (!username || !password) {
        return generateError("Missing username or password");
      }

      if (!config.verifyCredentials) {
        return generateError("verifyCredentials not configured");
      }

      try {
        const user = await config.verifyCredentials(username, password);
        if (!user) {
          return generateError("Invalid credentials");
        }

        return generateSuccess(user);
      } catch (_error) {
        return generateError("Authentication failed");
      }
    },
  };
}

export async function hashPassword(password: string, rounds: number = 10): Promise<string> {
  return await Bun.password.hash(password, {
    algorithm: "bcrypt",
    cost: rounds,
  });
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await Bun.password.verify(password, hash);
}
