import type { AuthResult } from "../types";

export function generateError(message: string): AuthResult {
  return {
    success: false,
    error: message
  };
}

export function generateSuccess(user: any, tokens?: any, redirect?: string): AuthResult {
  return {
    success: true,
    user,
    tokens,
    redirect
  };
}