import { createServer } from "verb";
import { createAllow, useStrategy, getSessionMiddleware, getMiddleware } from "../src";
import { generateError, generateSuccess } from "../src/strategies/base";
import type { VerbRequest, AuthResult, AuthStrategy } from "../src";

function createAPIKeyStrategy(): AuthStrategy {
  return {
    name: "apikey",
    
    async authenticate(req: VerbRequest): Promise<AuthResult> {
      const apiKey = req.headers.get("X-API-Key") || req.query?.apikey;
      
      if (!apiKey) {
        return generateError("Missing API key");
      }

      try {
        const user = await validateAPIKey(apiKey);
        if (!user) {
          return generateError("Invalid API key");
        }

        return generateSuccess(user);
      } catch (error) {
        return generateError("API key validation failed");
      }
    }
  };
}

async function validateAPIKey(apiKey: string) {
  const validKeys = {
    "key-123": {
      id: "api-user-1",
      username: "api-user",
      email: "api@example.com",
      profile: { role: "api", permissions: ["read", "write"] },
      strategies: [],
      createdAt: new Date(),
      updatedAt: new Date()
    }
  };

  return validKeys[apiKey] || null;
}

const allow = createAllow({
  secret: "your-secret-key",
  strategies: [
    {
      name: "apikey",
      type: "local", // We'll override this with custom strategy
      config: {}
    }
  ]
});

useStrategy(allow, createAPIKeyStrategy());

const app = createServer();

const sessionMw = getSessionMiddleware(allow);
const middleware = getMiddleware(allow);

app.use(sessionMw);

app.get("/", (req, res) => {
  res.html(`
    <h1>Custom API Key Strategy Demo</h1>
    <p>Try accessing /api/protected with header: X-API-Key: key-123</p>
    <p>Or try: <a href="/api/protected?apikey=key-123">GET /api/protected?apikey=key-123</a></p>
  `);
});

app.get("/api/protected", middleware.requireAuth, (req, res) => {
  res.json({ 
    message: "Protected API endpoint", 
    user: req.user,
    timestamp: new Date().toISOString()
  });
});

app.get("/api/admin", middleware.requireRole("admin"), (req, res) => {
  res.json({ 
    message: "Admin API endpoint", 
    user: req.user 
  });
});

app.use(middleware.optionalAuth);

app.get("/api/public", (req, res) => {
  res.json({ 
    message: "Public API endpoint", 
    authenticated: req.isAuthenticated?.() || false,
    user: req.user || null
  });
});

app.listen(3000, () => {
  console.log("Custom strategy server running on http://localhost:3000");
  console.log("Try:");
  console.log("  curl -H 'X-API-Key: key-123' http://localhost:3000/api/protected");
  console.log("  curl http://localhost:3000/api/protected?apikey=key-123");
});