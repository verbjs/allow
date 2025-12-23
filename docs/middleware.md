# Middleware Reference

Allow provides middleware and handlers for authentication and authorization.

## Session Middleware

Required for session-based authentication.

```typescript
import { getSessionMiddleware } from "@verb-js/allow"

const sessionMw = getSessionMiddleware(allow)
app.use(sessionMw)  // Must be added before auth routes
```

The session middleware:
- Reads session ID from cookies
- Loads session data from database
- Attaches user to `req.user` if authenticated
- Provides `req.isAuthenticated()` helper

## Authentication Middleware

```typescript
import { getMiddleware } from "@verb-js/allow"

const middleware = getMiddleware(allow)
```

### `requireAuth`

Require authentication. Returns 401 if not authenticated.

```typescript
app.get("/profile", middleware.requireAuth, (req, res) => {
  // req.user is guaranteed to exist
  res.json({ user: req.user })
})
```

### `optionalAuth`

Allow both authenticated and unauthenticated access.

```typescript
app.get("/posts", middleware.optionalAuth, (req, res) => {
  if (req.isAuthenticated()) {
    // Show personalized content
    res.json({ posts: getPersonalizedPosts(req.user.id) })
  } else {
    // Show public content
    res.json({ posts: getPublicPosts() })
  }
})
```

### `requireRole`

Require specific user role(s).

```typescript
// Single role
app.get("/admin", middleware.requireRole("admin"), (req, res) => {
  res.json({ message: "Admin area" })
})

// Multiple roles (any of)
app.get("/dashboard", middleware.requireRole(["admin", "moderator"]), (req, res) => {
  res.json({ message: "Staff dashboard" })
})
```

### `requirePermission`

Require specific permission(s).

```typescript
// Single permission
app.delete("/posts/:id", middleware.requirePermission("posts:delete"), handler)

// Multiple permissions (all required)
app.put("/users/:id", middleware.requirePermission(["users:read", "users:write"]), handler)
```

## Handlers

```typescript
import { getHandlers } from "@verb-js/allow"

const handlers = getHandlers(allow)
```

### Authentication Handlers

| Handler | Description |
|---------|-------------|
| `handlers.register` | Register new user (local strategy) |
| `handlers.login(strategy)` | Initiate login for strategy |
| `handlers.callback(strategy)` | Handle OAuth callback |
| `handlers.logout` | Destroy session and logout |
| `handlers.profile` | Return current user profile |

### Account Linking Handlers

| Handler | Description |
|---------|-------------|
| `handlers.link(strategy)` | Initiate account linking |
| `handlers.linkCallback(strategy)` | Handle link callback |
| `handlers.unlink(strategy)` | Remove linked account |

### Example Routes

```typescript
const handlers = getHandlers(allow)

// Registration
app.post("/auth/register", handlers.register)

// Local login
app.post("/auth/login", handlers.login("local"))

// OAuth login
app.get("/auth/github", handlers.login("github"))
app.get("/auth/github/callback", handlers.callback("github"))
app.get("/auth/google", handlers.login("google"))
app.get("/auth/google/callback", handlers.callback("google"))

// Profile & Logout
app.get("/auth/me", middleware.requireAuth, handlers.profile)
app.post("/auth/logout", handlers.logout)

// Account linking
app.get("/link/github", middleware.requireAuth, handlers.link("github"))
app.get("/link/github/callback", middleware.requireAuth, handlers.linkCallback("github"))
app.post("/unlink/github", middleware.requireAuth, handlers.unlink("github"))
```

## Request Object Extensions

After session middleware, `req` includes:

```typescript
interface AuthenticatedRequest {
  user?: AuthUser           // Current user (if authenticated)
  session?: AuthSession     // Current session
  isAuthenticated(): boolean // Check authentication status
}
```

### Usage

```typescript
app.get("/dashboard", middleware.optionalAuth, (req, res) => {
  if (req.isAuthenticated()) {
    console.log(req.user.id)        // User ID
    console.log(req.user.email)     // User email
    console.log(req.user.profile)   // User profile data
    console.log(req.session.id)     // Session ID
  }
})
```

## Creating Custom Middleware

### Role-Based Access Control

```typescript
function requireMinRole(minRole: string) {
  const roleHierarchy = ["user", "moderator", "admin", "superadmin"]

  return async (req, res, next) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Unauthorized" })
    }

    const userRoleIndex = roleHierarchy.indexOf(req.user.role)
    const minRoleIndex = roleHierarchy.indexOf(minRole)

    if (userRoleIndex < minRoleIndex) {
      return res.status(403).json({ error: "Insufficient permissions" })
    }

    next()
  }
}

// Usage
app.get("/admin", requireMinRole("admin"), handler)
```

### Resource-Based Authorization

```typescript
function requireOwnership(resourceType: string) {
  return async (req, res, next) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Unauthorized" })
    }

    const resourceId = req.params.id
    const resource = await db.get(resourceType, resourceId)

    if (!resource) {
      return res.status(404).json({ error: "Not found" })
    }

    if (resource.userId !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ error: "Access denied" })
    }

    req.resource = resource
    next()
  }
}

// Usage
app.put("/posts/:id", requireOwnership("posts"), updatePost)
app.delete("/posts/:id", requireOwnership("posts"), deletePost)
```

### Rate Limiting by User

```typescript
const userRateLimits = new Map<string, number[]>()

function rateLimitByUser(limit: number, windowMs: number) {
  return async (req, res, next) => {
    const key = req.isAuthenticated() ? req.user.id : req.ip
    const now = Date.now()
    const windowStart = now - windowMs

    // Get and filter requests
    const requests = (userRateLimits.get(key) || []).filter(t => t > windowStart)

    if (requests.length >= limit) {
      return res.status(429).json({ error: "Rate limit exceeded" })
    }

    requests.push(now)
    userRateLimits.set(key, requests)
    next()
  }
}

// Usage: 100 requests per minute
app.use("/api", rateLimitByUser(100, 60000))
```

## Error Handling

Handle authentication errors:

```typescript
app.use((err, req, res, next) => {
  if (err.name === "UnauthorizedError") {
    return res.status(401).json({ error: "Invalid or expired token" })
  }

  if (err.name === "ForbiddenError") {
    return res.status(403).json({ error: "Access denied" })
  }

  next(err)
})
```
