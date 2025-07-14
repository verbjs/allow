import { test, expect, describe } from "bun:test";
import { createLocalStrategy, hashPassword, verifyPassword } from "../src/strategies/local";

describe("LocalStrategy", () => {
  test("should hash and verify passwords correctly", async () => {
    const password = "test-password-123";
    const hash = await hashPassword(password);
    
    expect(hash).toBeDefined();
    expect(hash).not.toBe(password);
    expect(hash.length).toBeGreaterThan(50);
    
    const isValid = await verifyPassword(password, hash);
    expect(isValid).toBe(true);
    
    const isInvalid = await verifyPassword("wrong-password", hash);
    expect(isInvalid).toBe(false);
  });

  test("should handle custom hash rounds", async () => {
    const password = "test-password";
    const hash4 = await hashPassword(password, 4);
    const hash12 = await hashPassword(password, 12);
    
    expect(hash4).toBeDefined();
    expect(hash12).toBeDefined();
    expect(hash4).not.toBe(hash12);
    
    const isValid4 = await verifyPassword(password, hash4);
    const isValid12 = await verifyPassword(password, hash12);
    
    expect(isValid4).toBe(true);
    expect(isValid12).toBe(true);
  });

  test("should authenticate with correct credentials", async () => {
    const strategy = createLocalStrategy({
      usernameField: "email",
      passwordField: "password"
    });

    const mockReq = {
      body: {
        email: "test@example.com",
        password: "correct-password"
      }
    } as any;

    const result = await strategy.authenticate(mockReq);
    
    expect(result).toBeDefined();
    expect(result.success).toBe(false);
    expect(result.error).toBe("Authentication failed");
  });

  test("should fail with missing credentials", async () => {
    const strategy = createLocalStrategy({
      usernameField: "username",
      passwordField: "password"
    });

    const mockReqMissingUsername = {
      body: {
        password: "password"
      }
    } as any;

    const result1 = await strategy.authenticate(mockReqMissingUsername);
    expect(result1.success).toBe(false);
    expect(result1.error).toBe("Missing username or password");

    const mockReqMissingPassword = {
      body: {
        username: "user"
      }
    } as any;

    const result2 = await strategy.authenticate(mockReqMissingPassword);
    expect(result2.success).toBe(false);
    expect(result2.error).toBe("Missing username or password");
  });

  test("should use custom field names", async () => {
    const strategy = createLocalStrategy({
      usernameField: "email",
      passwordField: "pass"
    });

    const mockReq = {
      body: {
        email: "test@example.com",
        pass: "password"
      }
    } as any;

    const result = await strategy.authenticate(mockReq);
    
    expect(result.success).toBe(false);
    expect(result.error).toBe("Authentication failed");
  });

  test("should handle empty body", async () => {
    const strategy = createLocalStrategy({
      usernameField: "username",
      passwordField: "password"
    });

    const mockReq = {
      body: null
    } as any;

    const result = await strategy.authenticate(mockReq);
    
    expect(result.success).toBe(false);
    expect(result.error).toBe("Missing username or password");
  });
});