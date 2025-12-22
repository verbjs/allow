import { Database } from "bun:sqlite";
import type { DatabaseConfig } from "./types";

export interface MigrationConfig {
  database: DatabaseConfig;
  force?: boolean;
}

export async function runMigrations(config: MigrationConfig): Promise<void> {
  if (config.database.type !== "sqlite") {
    throw new Error("Only SQLite migrations are currently supported");
  }

  const db = new Database(config.database.connection);

  try {
    createMigrationTable(db);
    const appliedMigrations = getAppliedMigrations(db);

    for (const migration of migrations) {
      if (appliedMigrations.includes(migration.id) && !config.force) {
        console.log(`Skipping migration ${migration.id} (already applied)`);
        continue;
      }

      console.log(`Running migration ${migration.id}: ${migration.description}`);
      await migration.up(db);
      markMigrationAsApplied(db, migration.id);
      console.log(`Migration ${migration.id} completed`);
    }

    console.log("All migrations completed successfully");
  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  } finally {
    db.close();
  }
}

export async function rollbackMigrations(
  config: MigrationConfig,
  steps: number = 1,
): Promise<void> {
  if (config.database.type !== "sqlite") {
    throw new Error("Only SQLite rollbacks are currently supported");
  }

  const db = new Database(config.database.connection);

  try {
    createMigrationTable(db);
    const appliedMigrations = getAppliedMigrations(db);

    const migrationsToRollback = appliedMigrations.slice(-steps).reverse();

    for (const migrationId of migrationsToRollback) {
      const migration = migrations.find((m) => m.id === migrationId);
      if (!migration) {
        console.warn(`Migration ${migrationId} not found, skipping rollback`);
        continue;
      }

      console.log(`Rolling back migration ${migration.id}: ${migration.description}`);
      await migration.down(db);
      markMigrationAsRolledBack(db, migration.id);
      console.log(`Migration ${migration.id} rolled back`);
    }

    console.log("Rollback completed successfully");
  } catch (error) {
    console.error("Rollback failed:", error);
    throw error;
  } finally {
    db.close();
  }
}

interface Migration {
  id: string;
  description: string;
  up: (db: Database) => Promise<void>;
  down: (db: Database) => Promise<void>;
}

const migrations: Migration[] = [
  {
    id: "001_create_auth_tables",
    description: "Create authentication tables",
    up: async (db: Database) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS auth_users (
          id TEXT PRIMARY KEY,
          username TEXT UNIQUE,
          email TEXT UNIQUE,
          profile TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
    },
    down: async (db: Database) => {
      db.exec("DROP TABLE IF EXISTS auth_users;");
    },
  },
  {
    id: "002_create_user_strategies_table",
    description: "Create user strategies table",
    up: async (db: Database) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS user_strategies (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          strategy_name TEXT NOT NULL,
          strategy_id TEXT NOT NULL,
          profile TEXT,
          tokens TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE,
          UNIQUE(strategy_name, strategy_id)
        );
      `);
    },
    down: async (db: Database) => {
      db.exec("DROP TABLE IF EXISTS user_strategies;");
    },
  },
  {
    id: "003_create_auth_sessions_table",
    description: "Create authentication sessions table",
    up: async (db: Database) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS auth_sessions (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          data TEXT,
          expires_at DATETIME NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
        );
      `);
    },
    down: async (db: Database) => {
      db.exec("DROP TABLE IF EXISTS auth_sessions;");
    },
  },
  {
    id: "004_create_indexes",
    description: "Create database indexes for performance",
    up: async (db: Database) => {
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_user_strategies_user_id ON user_strategies(user_id);
        CREATE INDEX IF NOT EXISTS idx_user_strategies_strategy ON user_strategies(strategy_name, strategy_id);
        CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions(user_id);
        CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires ON auth_sessions(expires_at);
      `);
    },
    down: async (db: Database) => {
      db.exec(`
        DROP INDEX IF EXISTS idx_user_strategies_user_id;
        DROP INDEX IF EXISTS idx_user_strategies_strategy;
        DROP INDEX IF EXISTS idx_auth_sessions_user_id;
        DROP INDEX IF EXISTS idx_auth_sessions_expires;
      `);
    },
  },
  {
    id: "005_add_user_roles",
    description: "Add roles field to users profile",
    up: async (_db: Database) => {
      // SQLite doesn't support ALTER COLUMN, so we'll handle this in application logic
      // The profile column already exists and can store role information
      console.log("Roles will be stored in the profile JSON field");
    },
    down: async (_db: Database) => {
      // No-op for SQLite
      console.log("Roles removal is handled in application logic");
    },
  },
];

function createMigrationTable(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id TEXT PRIMARY KEY,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

function getAppliedMigrations(db: Database): string[] {
  const query = db.query("SELECT id FROM migrations ORDER BY applied_at");
  const rows = query.all() as { id: string }[];
  return rows.map((row) => row.id);
}

function markMigrationAsApplied(db: Database, migrationId: string): void {
  const query = db.query("INSERT OR REPLACE INTO migrations (id) VALUES (?1)");
  query.run(migrationId);
}

function markMigrationAsRolledBack(db: Database, migrationId: string): void {
  const query = db.query("DELETE FROM migrations WHERE id = ?1");
  query.run(migrationId);
}

export { migrations };
