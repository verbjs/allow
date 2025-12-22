# Authentication Strategies

Allow supports multiple authentication strategies that can be mixed and matched.

## Local Strategy (Email/Password)

Traditional username/password authentication with secure password hashing.

```typescript
{
  name: "local",
  type: "local",
  config: {
    usernameField: "email",     // Form field for username
    passwordField: "password",  // Form field for password
    hashRounds: 12              // Bcrypt rounds (default: 12)
  }
}
```

### Registration Flow

```typescript
// POST /auth/register
app.post("/auth/register", handlers.register)

// Request body:
// { "email": "user@example.com", "password": "secure123" }
```

### Login Flow

```typescript
// POST /auth/login
app.post("/auth/login", handlers.login("local"))

// Request body:
// { "email": "user@example.com", "password": "secure123" }
```

## OAuth Strategies

### GitHub

```typescript
import { useStrategy, githubStrategy } from "@verb/allow"

useStrategy(allow, githubStrategy({
  clientId: process.env.GITHUB_CLIENT_ID!,
  clientSecret: process.env.GITHUB_CLIENT_SECRET!,
  callbackURL: "http://localhost:3000/auth/github/callback",
  scope: ["user:email", "read:user"]  // Optional scopes
}))

// Routes
app.get("/auth/github", handlers.login("github"))
app.get("/auth/github/callback", handlers.callback("github"))
```

**GitHub App Setup:**
1. Go to GitHub Settings → Developer Settings → OAuth Apps
2. Create new OAuth App
3. Set callback URL to your app's callback endpoint
4. Copy Client ID and Client Secret

### Google

```typescript
import { useStrategy, googleStrategy } from "@verb/allow"

useStrategy(allow, googleStrategy({
  clientId: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  callbackURL: "http://localhost:3000/auth/google/callback",
  scope: ["email", "profile"]
}))

// Routes
app.get("/auth/google", handlers.login("google"))
app.get("/auth/google/callback", handlers.callback("google"))
```

**Google Cloud Setup:**
1. Go to Google Cloud Console → APIs & Services → Credentials
2. Create OAuth 2.0 Client ID
3. Add authorized redirect URI
4. Copy Client ID and Client Secret

### Discord

```typescript
import { useStrategy, discordStrategy } from "@verb/allow"

useStrategy(allow, discordStrategy({
  clientId: process.env.DISCORD_CLIENT_ID!,
  clientSecret: process.env.DISCORD_CLIENT_SECRET!,
  callbackURL: "http://localhost:3000/auth/discord/callback",
  scope: ["identify", "email"]
}))

// Routes
app.get("/auth/discord", handlers.login("discord"))
app.get("/auth/discord/callback", handlers.callback("discord"))
```

**Discord Developer Portal:**
1. Go to Discord Developer Portal → Applications
2. Create new application
3. Go to OAuth2 → Add redirect URL
4. Copy Client ID and Client Secret

## JWT Strategy

For API token authentication without sessions.

```typescript
{
  name: "jwt",
  type: "jwt",
  config: {
    secret: process.env.JWT_SECRET!,
    algorithm: "HS256",      // HS256, HS384, HS512, RS256, etc.
    expiresIn: "1h",         // Token expiration
    issuer: "my-app",        // Optional issuer claim
    audience: "my-api"       // Optional audience claim
  }
}
```

### Usage

```typescript
// Generate token
const token = await generateToken(allow, user, { expiresIn: "24h" })

// Verify token (automatic via middleware)
app.get("/api/protected", middleware.requireAuth, (req, res) => {
  res.json({ user: req.user })
})

// Client sends: Authorization: Bearer <token>
```

## Custom Strategies

Create custom authentication strategies:

```typescript
import { useStrategy, generateError, generateSuccess } from "@verb/allow"
import type { AuthStrategy, AuthResult, VerbRequest } from "@verb/allow"

function createApiKeyStrategy(): AuthStrategy {
  return {
    name: "apikey",

    async authenticate(req: VerbRequest): Promise<AuthResult> {
      const apiKey = req.headers.get("X-API-Key")

      if (!apiKey) {
        return generateError("API key required")
      }

      // Validate API key (your logic here)
      const user = await validateApiKey(apiKey)

      if (!user) {
        return generateError("Invalid API key")
      }

      return generateSuccess(user)
    },

    // Optional: Handle OAuth-style callbacks
    async callback?(req: VerbRequest): Promise<AuthResult> {
      // Handle callback if needed
      return generateError("Not implemented")
    }
  }
}

// Register the strategy
useStrategy(allow, createApiKeyStrategy())

// Use it
app.get("/api/data", middleware.requireAuth, (req, res) => {
  // Works with X-API-Key header
  res.json({ data: "secret" })
})
```

### Magic Link Strategy Example

```typescript
function createMagicLinkStrategy(): AuthStrategy {
  return {
    name: "magic-link",

    async authenticate(req: VerbRequest): Promise<AuthResult> {
      const { email } = await req.json()

      // Generate and send magic link
      const token = generateMagicToken(email)
      await sendEmail(email, `Login: https://myapp.com/auth/verify?token=${token}`)

      return {
        success: true,
        redirect: "/check-email"
      }
    },

    async callback(req: VerbRequest): Promise<AuthResult> {
      const url = new URL(req.url)
      const token = url.searchParams.get("token")

      const user = await verifyMagicToken(token)

      if (!user) {
        return generateError("Invalid or expired link")
      }

      return generateSuccess(user)
    }
  }
}
```

## Account Linking

Allow users to connect multiple authentication methods:

```typescript
import { getMiddleware, getHandlers, getUserStrategies } from "@verb/allow"

const middleware = getMiddleware(allow)
const handlers = getHandlers(allow)

// Link GitHub to existing account
app.get("/link/github", middleware.requireAuth, handlers.link("github"))
app.get("/link/github/callback", middleware.requireAuth, handlers.linkCallback("github"))

// Unlink GitHub from account
app.post("/unlink/github", middleware.requireAuth, handlers.unlink("github"))

// Get user's linked strategies
app.get("/account/connections", middleware.requireAuth, async (req, res) => {
  const strategies = await getUserStrategies(allow, req.user.id)
  res.json({ strategies })
})
```

## Strategy Configuration Options

### Common Options

| Option | Type | Description |
|--------|------|-------------|
| `name` | string | Unique strategy identifier |
| `type` | string | Strategy type (local, oauth, jwt) |
| `enabled` | boolean | Enable/disable strategy |
| `config` | object | Strategy-specific configuration |

### OAuth Options

| Option | Type | Description |
|--------|------|-------------|
| `clientId` | string | OAuth client ID |
| `clientSecret` | string | OAuth client secret |
| `callbackURL` | string | OAuth callback URL |
| `scope` | string[] | Requested permissions |
| `state` | boolean | Enable CSRF protection (default: true) |

### JWT Options

| Option | Type | Description |
|--------|------|-------------|
| `secret` | string | Signing secret |
| `algorithm` | string | Signing algorithm |
| `expiresIn` | string | Token expiration |
| `issuer` | string | Token issuer claim |
| `audience` | string | Token audience claim |
