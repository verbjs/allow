import { createServer } from "verb";
import { createAllow, getSessionMiddleware, getMiddleware, getHandlers, createSession, getUser, getUserStrategies, linkStrategy, unlinkStrategy } from "../src";
import { hashPassword, verifyPassword } from "../src/strategies/local";

const allow = createAllow({
  secret: "your-secret-key",
  sessionDuration: 86400000,
  database: {
    type: "sqlite",
    connection: "multi-auth.db",
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
    <h1>Multiple Authentication Strategies</h1>
    <div>
      <h2>Login Methods</h2>
      <a href="/auth/github">Login with GitHub</a><br>
      <a href="/auth/google">Login with Google</a><br>
      <a href="/login">Login with Email/Password</a>
    </div>
  `);
});

app.get("/login", (req, res) => {
  res.html(`
    <h2>Login</h2>
    <form method="post" action="/auth/local">
      <input type="email" name="email" placeholder="Email" required><br>
      <input type="password" name="password" placeholder="Password" required><br>
      <button type="submit">Login</button>
    </form>
    <p><a href="/register">Don't have an account? Register</a></p>
  `);
});

app.get("/register", (req, res) => {
  res.html(`
    <h2>Register</h2>
    <form method="post" action="/register">
      <input type="email" name="email" placeholder="Email" required><br>
      <input type="password" name="password" placeholder="Password" required><br>
      <input type="password" name="confirmPassword" placeholder="Confirm Password" required><br>
      <button type="submit">Register</button>
    </form>
    <p><a href="/login">Already have an account? Login</a></p>
  `);
});

app.post("/register", async (req, res) => {
  const { email, password, confirmPassword } = req.body;
  
  if (password !== confirmPassword) {
    return res.status(400).json({ error: "Passwords don't match" });
  }

  try {
    const hashedPassword = await hashPassword(password);
    
    const user = {
      id: crypto.randomUUID(),
      username: email,
      email,
      profile: { 
        hashedPassword,
        role: "user"
      },
      strategies: []
    };

    const session = await createSession(allow, user);
    res.cookie("allow-session", session.id, {
      httpOnly: true,
      secure: req.secure,
      maxAge: 86400000
    });

    res.redirect("/profile");
  } catch (error) {
    res.status(500).json({ error: "Registration failed" });
  }
});

app.post("/auth/local", async (req, res) => {
  const { email, password } = req.body;
  
  try {
    const user = await getUserByEmail(email);
    if (!user) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    const isValidPassword = await verifyPassword(password, user.profile.hashedPassword);
    if (!isValidPassword) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    const session = await createSession(allow, user);
    res.cookie("allow-session", session.id, {
      httpOnly: true,
      secure: req.secure,
      maxAge: 86400000
    });

    res.redirect("/profile");
  } catch (error) {
    res.status(500).json({ error: "Authentication failed" });
  }
});

app.get("/auth/github", handlers.login("github"));
app.get("/auth/github/callback", handlers.callback("github"));

app.get("/auth/google", handlers.login("google"));
app.get("/auth/google/callback", handlers.callback("google"));

app.get("/profile", middleware.requireAuth, async (req, res) => {
  const strategies = await getUserStrategies(allow, req.user.id);
  
  res.html(`
    <h1>Profile</h1>
    <p>Welcome, ${req.user.username || req.user.email}!</p>
    
    <h2>Linked Accounts</h2>
    <ul>
      ${strategies.map(strategy => `
        <li>
          ${strategy.strategyName} (${strategy.profile.username || strategy.profile.email})
          <form method="post" action="/unlink/${strategy.strategyName}" style="display: inline;">
            <button type="submit">Unlink</button>
          </form>
        </li>
      `).join('')}
    </ul>
    
    <h2>Link Additional Accounts</h2>
    <a href="/link/github">Link GitHub</a><br>
    <a href="/link/google">Link Google</a><br>
    
    <br><br>
    <form method="post" action="/logout">
      <button type="submit">Logout</button>
    </form>
  `);
});

app.get("/link/github", middleware.requireAuth, handlers.link("github"));
app.get("/link/google", middleware.requireAuth, handlers.link("google"));

app.post("/unlink/github", middleware.requireAuth, handlers.unlink("github"));
app.post("/unlink/google", middleware.requireAuth, handlers.unlink("google"));

app.post("/logout", handlers.logout);

async function getUserByEmail(email: string) {
  // In a real app, this would query your database
  // For demo purposes, we'll simulate a user lookup
  return null;
}

app.listen(3000, () => {
  console.log("Multiple strategies server running on http://localhost:3000");
  console.log("Features:");
  console.log("  - Local email/password registration and login");
  console.log("  - GitHub OAuth authentication");
  console.log("  - Google OAuth authentication");
  console.log("  - Account linking/unlinking");
  console.log("  - Session management");
});