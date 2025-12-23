# API Reference

Complete API documentation for Allow authentication library.

## Core Functions

### `createAllow(config)`

Create an Allow instance.

```typescript
import { createAllow } from "@verb-js/allow"

const allow = createAllow({
  secret: string,              // JWT secret (required)
  sessionDuration?: number,    // Session duration in ms (default: 86400000)
  database?: DatabaseConfig,   // Database configuration
  strategies: StrategyConfig[] // Authentication strategies
})
```

### `useStrategy(allow, strategy)`

Register a custom or built-in strategy.

```typescript
import { useStrategy, githubStrategy } from "@verb-js/allow"

useStrategy(allow, githubStrategy({
  clientId: "...",
  clientSecret: "...",
  callbackURL: "..."
}))
```

### `authenticate(allow, strategyName, req)`

Manually authenticate a request.

```typescript
import { authenticate } from "@verb-js/allow"

const result = await authenticate(allow, "local", req)
if (result.success) {
  console.log(result.user)
}
```

### `callback(allow, strategyName, req)`

Handle OAuth callback manually.

```typescript
import { callback } from "@verb-js/allow"

const result = await callback(allow, "github", req)
if (result.success) {
  // Create session, redirect, etc.
}
```

## Session Management

### `createSession(allow, user, data?)`

Create a new session.

```typescript
import { createSession } from "@verb-js/allow"

const session = await createSession(allow, user, {
  rememberMe: true,
  deviceInfo: req.headers.get("user-agent")
})
```

### `getSession(allow, sessionId)`

Retrieve a session.

```typescript
import { getSession } from "@verb-js/allow"

const session = await getSession(allow, sessionId)
if (session && session.expiresAt > new Date()) {
  // Session is valid
}
```

### `updateSession(allow, sessionId, data)`

Update session data.

```typescript
import { updateSession } from "@verb-js/allow"

await updateSession(allow, sessionId, {
  lastActivity: new Date(),
  customData: "value"
})
```

### `destroySession(allow, sessionId)`

Delete a session.

```typescript
import { destroySession } from "@verb-js/allow"

await destroySession(allow, sessionId)
```

## User Management

### `getUser(allow, req)`

Get current user from request.

```typescript
import { getUser } from "@verb-js/allow"

const user = await getUser(allow, req)
if (user) {
  console.log(user.email)
}
```

### `linkStrategy(allow, userId, strategyName, strategyId, profile, tokens?)`

Link an authentication strategy to a user.

```typescript
import { linkStrategy } from "@verb-js/allow"

await linkStrategy(allow, userId, "github", githubId, {
  login: "username",
  avatar_url: "https://..."
}, {
  access_token: "...",
  refresh_token: "..."
})
```

### `unlinkStrategy(allow, userId, strategyName)`

Remove a linked strategy.

```typescript
import { unlinkStrategy } from "@verb-js/allow"

await unlinkStrategy(allow, userId, "github")
```

### `getUserStrategies(allow, userId)`

Get all strategies linked to a user.

```typescript
import { getUserStrategies } from "@verb-js/allow"

const strategies = await getUserStrategies(allow, userId)
// [{ name: "local", ... }, { name: "github", ... }]
```

## Middleware & Handlers

### `getSessionMiddleware(allow)`

Get session middleware.

```typescript
import { getSessionMiddleware } from "@verb-js/allow"

const sessionMw = getSessionMiddleware(allow)
app.use(sessionMw)
```

### `getMiddleware(allow)`

Get authentication middleware.

```typescript
import { getMiddleware } from "@verb-js/allow"

const middleware = getMiddleware(allow)
// middleware.requireAuth
// middleware.optionalAuth
// middleware.requireRole(role)
// middleware.requirePermission(permission)
```

### `getHandlers(allow)`

Get route handlers.

```typescript
import { getHandlers } from "@verb-js/allow"

const handlers = getHandlers(allow)
// handlers.register
// handlers.login(strategy)
// handlers.callback(strategy)
// handlers.logout
// handlers.profile
// handlers.link(strategy)
// handlers.linkCallback(strategy)
// handlers.unlink(strategy)
```

## Password Utilities

### `hashPassword(password)`

Hash a password using Bun's native crypto.

```typescript
import { hashPassword } from "@verb-js/allow"

const hash = await hashPassword("password123")
// $2b$12$...
```

### `verifyPassword(password, hash)`

Verify a password against a hash.

```typescript
import { verifyPassword } from "@verb-js/allow"

const isValid = await verifyPassword("password123", hash)
if (isValid) {
  // Password matches
}
```

## Result Helpers

### `generateSuccess(user, options?)`

Create a success result.

```typescript
import { generateSuccess } from "@verb-js/allow"

return generateSuccess(user, {
  redirect: "/dashboard",
  tokens: { access_token: "..." }
})
```

### `generateError(message, options?)`

Create an error result.

```typescript
import { generateError } from "@verb-js/allow"

return generateError("Invalid credentials", {
  code: "INVALID_CREDENTIALS",
  status: 401
})
```

## Types

### `AuthConfig`

```typescript
interface AuthConfig {
  secret: string
  sessionDuration?: number
  database?: DatabaseConfig
  strategies: StrategyConfig[]
}
```

### `DatabaseConfig`

```typescript
interface DatabaseConfig {
  type: "sqlite" | "postgres"
  connection: string
  migrate?: boolean
}
```

### `StrategyConfig`

```typescript
interface StrategyConfig {
  name: string
  type: "local" | "oauth" | "jwt"
  config: Record<string, any>
  enabled?: boolean
}
```

### `AuthUser`

```typescript
interface AuthUser {
  id: string
  username?: string
  email?: string
  role?: string
  profile?: Record<string, any>
  strategies: UserStrategy[]
  createdAt: Date
  updatedAt: Date
}
```

### `AuthSession`

```typescript
interface AuthSession {
  id: string
  userId: string
  data: Record<string, any>
  expiresAt: Date
  createdAt: Date
}
```

### `AuthResult`

```typescript
interface AuthResult {
  success: boolean
  user?: AuthUser
  error?: string
  redirect?: string
  tokens?: {
    access_token?: string
    refresh_token?: string
    expires_at?: Date
  }
}
```

### `AuthStrategy`

```typescript
interface AuthStrategy {
  name: string
  authenticate(req: VerbRequest): Promise<AuthResult>
  callback?(req: VerbRequest): Promise<AuthResult>
}
```

### `UserStrategy`

```typescript
interface UserStrategy {
  id: string
  userId: string
  strategyName: string
  strategyId: string
  profile: Record<string, any>
  tokens?: Record<string, any>
  createdAt: Date
  updatedAt: Date
}
```

## Built-in Strategies

### `githubStrategy(config)`

```typescript
import { githubStrategy } from "@verb-js/allow"

const strategy = githubStrategy({
  clientId: string,
  clientSecret: string,
  callbackURL: string,
  scope?: string[]
})
```

### `googleStrategy(config)`

```typescript
import { googleStrategy } from "@verb-js/allow"

const strategy = googleStrategy({
  clientId: string,
  clientSecret: string,
  callbackURL: string,
  scope?: string[]
})
```

### `discordStrategy(config)`

```typescript
import { discordStrategy } from "@verb-js/allow"

const strategy = discordStrategy({
  clientId: string,
  clientSecret: string,
  callbackURL: string,
  scope?: string[]
})
```
