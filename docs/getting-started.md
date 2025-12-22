# Getting Started with Allow

This guide walks you through setting up authentication in your Verb application.

## Installation

```bash
bun add @verb/allow
```

## Basic Setup

### 1. Create the Allow Instance

```typescript
import { createAllow } from "@verb/allow"

const allow = createAllow({
  secret: process.env.AUTH_SECRET || "your-secret-key",
  sessionDuration: 86400000, // 24 hours in milliseconds
  database: {
    type: "sqlite",
    connection: "auth.db",
    migrate: true
  },
  strategies: []
})
```

### 2. Add Authentication Strategies

```typescript
const allow = createAllow({
  secret: process.env.AUTH_SECRET!,
  database: {
    type: "sqlite",
    connection: "auth.db",
    migrate: true
  },
  strategies: [
    // Local (email/password)
    {
      name: "local",
      type: "local",
      config: {
        usernameField: "email",
        passwordField: "password"
      }
    },
    // GitHub OAuth
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
})
```

### 3. Add Middleware and Routes

```typescript
import { createServer } from "verb"
import { getSessionMiddleware, getMiddleware, getHandlers } from "@verb/allow"

const app = createServer()

// Get middleware and handlers
const sessionMw = getSessionMiddleware(allow)
const middleware = getMiddleware(allow)
const handlers = getHandlers(allow)

// Add session middleware (required)
app.use(sessionMw)

// Public routes
app.get("/", (req, res) => res.send("Home"))

// Auth routes
app.post("/auth/register", handlers.register)
app.post("/auth/login", handlers.login("local"))
app.get("/auth/github", handlers.login("github"))
app.get("/auth/github/callback", handlers.callback("github"))
app.post("/auth/logout", handlers.logout)

// Protected routes
app.get("/profile", middleware.requireAuth, handlers.profile)
app.get("/admin", middleware.requireRole("admin"), (req, res) => {
  res.json({ message: "Admin area", user: req.user })
})

app.listen(3000)
```

## Database Setup

### SQLite (Default)

```typescript
database: {
  type: "sqlite",
  connection: "auth.db",  // File path
  migrate: true           // Auto-run migrations
}
```

### PostgreSQL

```typescript
database: {
  type: "postgres",
  connection: "postgres://user:pass@localhost:5432/mydb",
  migrate: true
}
```

### Manual Migrations

Run migrations programmatically:

```typescript
import { runMigrations } from "@verb/allow"

await runMigrations({
  database: {
    type: "sqlite",
    connection: "auth.db"
  }
})
```

## Environment Variables

Create a `.env` file:

```bash
# Required
AUTH_SECRET=your-super-secret-key-min-32-chars

# OAuth Providers (optional)
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
DISCORD_CLIENT_ID=your-discord-client-id
DISCORD_CLIENT_SECRET=your-discord-client-secret
```

## Testing Your Setup

### Register a User

```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password123"}'
```

### Login

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password123"}'
```

### Access Protected Route

```bash
curl http://localhost:3000/profile \
  -H "Cookie: session=<session-cookie>"
```

## Next Steps

- [Strategies Guide](./strategies.md) - Configure OAuth providers
- [Middleware Reference](./middleware.md) - Available middleware
- [API Reference](./api-reference.md) - Full API documentation
