import { createServer } from "verb";
import { createAllow, githubStrategy, googleStrategy, getSessionMiddleware, getMiddleware, getHandlers } from "../src";

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
        passwordField: "password",
        hashRounds: 12
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
    },
    {
      name: "google",
      type: "oauth",
      config: {
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        callbackURL: "http://localhost:3000/auth/google/callback",
        scope: ["profile", "email"]
      }
    }
  ]
});

const app = createServer();

const sessionMw = getSessionMiddleware(allow);
const middleware = getMiddleware(allow);
const handlers = getHandlers(allow);

app.use(sessionMw);

app.get("/", (req, res) => {
  res.html(`
    <h1>Allow Authentication Demo</h1>
    <div>
      <h2>Login Options</h2>
      <a href="/auth/github">Login with GitHub</a><br>
      <a href="/auth/google">Login with Google</a><br>
      <a href="/auth/local">Login with Email/Password</a>
    </div>
    <div>
      <h2>Protected Routes</h2>
      <a href="/profile">View Profile</a><br>
      <a href="/admin">Admin Area</a>
    </div>
  `);
});

app.get("/auth/github", handlers.login("github"));
app.get("/auth/github/callback", handlers.callback("github"));

app.get("/auth/google", handlers.login("google"));
app.get("/auth/google/callback", handlers.callback("google"));

app.get("/auth/local", (req, res) => {
  res.html(`
    <form method="post" action="/auth/local">
      <input type="email" name="email" placeholder="Email" required>
      <input type="password" name="password" placeholder="Password" required>
      <button type="submit">Login</button>
    </form>
  `);
});

app.post("/auth/local", handlers.login("local"));

app.get("/profile", middleware.requireAuth, handlers.profile);

app.get("/admin", middleware.requireRole("admin"), (req, res) => {
  res.json({ message: "Admin area", user: req.user });
});

app.get("/link/github", middleware.requireAuth, handlers.link("github"));
app.get("/link/google", middleware.requireAuth, handlers.link("google"));

app.post("/unlink/github", middleware.requireAuth, handlers.unlink("github"));
app.post("/unlink/google", middleware.requireAuth, handlers.unlink("google"));

app.post("/logout", handlers.logout);

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
  console.log("Available endpoints:");
  console.log("  GET  /                    - Home page");
  console.log("  GET  /auth/github         - GitHub OAuth login");
  console.log("  GET  /auth/google         - Google OAuth login");
  console.log("  GET  /auth/local          - Local login form");
  console.log("  POST /auth/local          - Local login handler");
  console.log("  GET  /profile             - User profile (protected)");
  console.log("  GET  /admin               - Admin area (role protected)");
  console.log("  POST /logout              - Logout");
});