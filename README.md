# Allow - Authentication Library for Verb

**Allow** is a flexible, TypeScript-first authentication library designed specifically for the Verb framework. It provides a simple yet powerful way to add authentication to your Verb applications with support for multiple authentication strategies, user account linking, and session management.

## Features

- 🔐 **Multiple Authentication Strategies**: Local (email/password), OAuth (GitHub, Google, Discord), JWT, and custom strategies
- 🔗 **Account Linking**: Users can link multiple authentication methods to a single account
- 🗄️ **Database Integration**: Optional SQLite/PostgreSQL storage for user data and sessions
- 🧩 **TypeScript First**: Full type safety and excellent developer experience
- 🚀 **Bun Optimized**: Built specifically for Bun runtime with native crypto and password hashing
- 🌐 **Verb Integration**: Seamless integration with Verb's request/response handling
- 🔧 **Flexible Configuration**: Configure strategies via TypeScript or store in database
- 🧪 **Testing Ready**: Comprehensive test suite with Bun test

## Installation

```bash
bun add @verb/allow
```

## Quick Start

```typescript
import { createServer } from "verb";
import { createAllow, getSessionMiddleware, getMiddleware, getHandlers } from "@verb/allow";

const allow = createAllow({
  secret: "your-secret-key",
  sessionDuration: 86400000, // 24 hours
  database: {
    type: "sqlite",
    connection: "auth.db",
    migrate: true
  },
  strategies: [
    {
      name: "local",
      type: "local",
      config: {
        usernameField: "email",
        passwordField: "password"
      }
    },
    {
      name: "github",
      type: "oauth",
      config: {
        clientId: process.env.GITHUB_CLIENT_ID!,
        clientSecret: process.env.GITHUB_CLIENT_SECRET!,
        callbackURL: "http://localhost:3000/auth/github/callback",
        scope: ["user:email"]
      }
    }
  ]
});

const app = createServer();

// Get middleware and handlers
const sessionMw = getSessionMiddleware(allow);
const middleware = getMiddleware(allow);
const handlers = getHandlers(allow);

// Add session middleware
app.use(sessionMw);

// Authentication routes
app.get("/auth/github", handlers.login("github"));
app.get("/auth/github/callback", handlers.callback("github"));

// Protected routes
app.get("/profile", middleware.requireAuth, handlers.profile);
app.get("/admin", middleware.requireRole("admin"), (req, res) => {
  res.json({ message: "Admin area", user: req.user });
});

// Account linking
app.get("/link/github", middleware.requireAuth, handlers.link("github"));
app.post("/unlink/github", middleware.requireAuth, handlers.unlink("github"));

// Logout
app.post("/logout", handlers.logout);

app.listen(3000);
```

## Configuration

### Basic Configuration

```typescript
interface AuthConfig {
  secret: string;                    // JWT secret key
  sessionDuration?: number;          // Session duration in milliseconds
  database?: DatabaseConfig;         // Optional database configuration
  strategies: StrategyConfig[];      // Authentication strategies
}
```

### Database Configuration

```typescript
interface DatabaseConfig {
  type: "sqlite" | "postgres";
  connection: string;                // Database connection string
  migrate?: boolean;                 // Run migrations on startup
}
```

### Strategy Configuration

```typescript
interface StrategyConfig {
  name: string;                      // Strategy name
  type: "local" | "oauth" | "jwt";   // Strategy type
  config: Record<string, any>;       // Strategy-specific configuration
  enabled?: boolean;                 // Enable/disable strategy
}
```

## Authentication Strategies

### Local Strategy (Email/Password)

```typescript
{
  name: "local",
  type: "local",
  config: {
    usernameField: "email",          // Field name for username
    passwordField: "password",       // Field name for password
    hashRounds: 12                   // Bcrypt hash rounds
  }
}
```

### OAuth Strategy

```typescript
{
  name: "github",
  type: "oauth",
  config: {
    clientId: "your-client-id",
    clientSecret: "your-client-secret",
    callbackURL: "http://localhost:3000/auth/github/callback",
    scope: ["user:email"]
  }
}
```

#### Built-in OAuth Providers

```typescript
import { useStrategy, githubStrategy, googleStrategy, discordStrategy } from "@verb/allow";

// GitHub
useStrategy(allow, githubStrategy({
  clientId: process.env.GITHUB_CLIENT_ID!,
  clientSecret: process.env.GITHUB_CLIENT_SECRET!,
  callbackURL: "http://localhost:3000/auth/github/callback"
}));

// Google
useStrategy(allow, googleStrategy({
  clientId: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  callbackURL: "http://localhost:3000/auth/google/callback"
}));

// Discord
useStrategy(allow, discordStrategy({
  clientId: process.env.DISCORD_CLIENT_ID!,
  clientSecret: process.env.DISCORD_CLIENT_SECRET!,
  callbackURL: "http://localhost:3000/auth/discord/callback"
}));
```

### JWT Strategy

```typescript
{
  name: "jwt",
  type: "jwt",
  config: {
    secret: "jwt-secret",
    algorithm: "HS256",
    expiresIn: "1h"
  }
}
```

## Custom Strategies

Create custom authentication strategies as functions:

```typescript
import { useStrategy, generateError, generateSuccess } from "@verb/allow";
import type { VerbRequest, AuthResult, AuthStrategy } from "@verb/allow";

function createAPIKeyStrategy(): AuthStrategy {
  return {
    name: "apikey",
    
    async authenticate(req: VerbRequest): Promise<AuthResult> {
      const apiKey = req.headers.get("X-API-Key");
      
      if (!apiKey) {
        return generateError("Missing API key");
      }

      const user = await validateAPIKey(apiKey);
      if (!user) {
        return generateError("Invalid API key");
      }

      return generateSuccess(user);
    }
  };
}

async function validateAPIKey(apiKey: string) {
  // Your validation logic here
  return null;
}

// Register custom strategy
useStrategy(allow, createAPIKeyStrategy());
```

## Middleware

### Authentication Middleware

```typescript
import { getMiddleware } from "@verb/allow";

const middleware = getMiddleware(allow);

// Require authentication
app.get("/protected", middleware.requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// Optional authentication
app.get("/mixed", middleware.optionalAuth, (req, res) => {
  if (req.isAuthenticated()) {
    res.json({ user: req.user });
  } else {
    res.json({ message: "Public content" });
  }
});

// Require specific role
app.get("/admin", middleware.requireRole("admin"), (req, res) => {
  res.json({ message: "Admin area" });
});
```

### Session Middleware

```typescript
import { getSessionMiddleware } from "@verb/allow";

// Add session support
const sessionMw = getSessionMiddleware(allow);
app.use(sessionMw);
```

## Account Linking

Allow users to link multiple authentication methods to a single account:

```typescript
import { getMiddleware, getHandlers, getUserStrategies } from "@verb/allow";

const middleware = getMiddleware(allow);
const handlers = getHandlers(allow);

// Link GitHub account to current user
app.get("/link/github", middleware.requireAuth, handlers.link("github"));

// Unlink GitHub account
app.post("/unlink/github", middleware.requireAuth, handlers.unlink("github"));

// Get user's linked strategies
const strategies = await getUserStrategies(allow, userId);
```

## Database Migrations

Run database migrations to set up the required tables:

```typescript
import { runMigrations } from "@verb/allow";

await runMigrations({
  database: {
    type: "sqlite",
    connection: "auth.db"
  }
});
```

Or run migrations via CLI:

```bash
bun run migrate
```

## Password Hashing

Use Bun's built-in password hashing for local authentication:

```typescript
import { hashPassword, verifyPassword } from "@verb/allow";

// Hash password
const hash = await hashPassword("password123");

// Verify password
const isValid = await verifyPassword("password123", hash);
```

## Testing

```bash
# Run all tests
bun test

# Run tests in watch mode
bun test --watch

# Run specific test file
bun test src/allow.test.ts
```

## Examples

Check out the [examples](./examples) directory for complete working examples:

- [Basic Usage](./examples/basic-usage.ts) - Simple authentication setup
- [Custom Strategy](./examples/custom-strategy.ts) - Implementing custom authentication
- [Multiple Strategies](./examples/multiple-strategies.ts) - Account linking and multiple auth methods

## API Reference

### Core Functions

```typescript
// Main factory function
function createAllow(config: AuthConfig): AllowInstance

// Strategy management
function useStrategy(allow: AllowInstance, strategy: AuthStrategy): void
function authenticate(allow: AllowInstance, strategyName: string, req: VerbRequest): Promise<AuthResult>
function callback(allow: AllowInstance, strategyName: string, req: VerbRequest): Promise<AuthResult>

// Session management
function createSession(allow: AllowInstance, user: AuthUser, data?: Record<string, any>): Promise<AuthSession>
function getSession(allow: AllowInstance, sessionId: string): Promise<AuthSession | null>
function updateSession(allow: AllowInstance, sessionId: string, data: Record<string, any>): Promise<void>
function destroySession(allow: AllowInstance, sessionId: string): Promise<void>

// User management
function getUser(allow: AllowInstance, req: VerbRequest): Promise<AuthUser | null>
function linkStrategy(allow: AllowInstance, userId: string, strategyName: string, strategyId: string, profile: any, tokens?: any): Promise<UserStrategy>
function unlinkStrategy(allow: AllowInstance, userId: string, strategyName: string): Promise<void>
function getUserStrategies(allow: AllowInstance, userId: string): Promise<UserStrategy[]>

// Middleware and handlers
function getMiddleware(allow: AllowInstance): AuthMiddleware
function getSessionMiddleware(allow: AllowInstance): Function
function getHandlers(allow: AllowInstance): AuthHandlers
```

### Types

```typescript
interface AuthUser {
  id: string;
  username?: string;
  email?: string;
  profile?: Record<string, any>;
  strategies: UserStrategy[];
  createdAt: Date;
  updatedAt: Date;
}

interface AuthSession {
  id: string;
  userId: string;
  data: Record<string, any>;
  expiresAt: Date;
  createdAt: Date;
}

interface AuthResult {
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
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- 📖 [Documentation](https://allow.verb.dev)
- 💬 [Discussions](https://github.com/verb/allow/discussions)
- 🐛 [Issues](https://github.com/verb/allow/issues)
- 📧 [Email Support](mailto:support@verb.codes)
