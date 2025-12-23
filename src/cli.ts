#!/usr/bin/env bun
/**
 * Allow CLI - Database management commands
 *
 * Uses Hull's sync for schema management instead of traditional migrations.
 * Hull sync is idempotent - it creates missing tables and adds missing columns.
 */

import { initDatabase, syncDatabase, closeDatabase } from "./db";

const command = process.argv[2];
const dbUrl = process.env.DATABASE_URL || "sqlite:///auth.db";

async function main() {
  switch (command) {
    case "sync":
    case "migrate": {
      console.log(`Syncing database schema to ${dbUrl}...`);
      initDatabase(dbUrl);

      const result = await syncDatabase();

      if (result.created.length > 0) {
        console.log("Created tables:", result.created.join(", "));
      }

      if (result.altered.length > 0) {
        for (const alt of result.altered) {
          if (alt.added.length > 0) {
            console.log(`Added columns to ${alt.table}:`, alt.added.join(", "));
          }
        }
      }

      if (result.created.length === 0 && result.altered.length === 0) {
        console.log("Database schema is up to date.");
      }

      await closeDatabase();
      console.log("Done.");
      break;
    }

    case "status": {
      console.log(`Checking database schema at ${dbUrl}...`);
      initDatabase(dbUrl);

      // Dry run to see what would change
      const { sync } = await import("@verb-js/hull");
      const { getRepo } = await import("./db");
      const { schemas } = await import("./db/schema");

      const result = await sync(getRepo(), schemas, { dryRun: true });

      if (result.created.length > 0) {
        console.log("Tables to create:", result.created.join(", "));
      }

      if (result.altered.length > 0) {
        for (const alt of result.altered) {
          if (alt.added.length > 0) {
            console.log(`Columns to add to ${alt.table}:`, alt.added.join(", "));
          }
        }
      }

      if (result.created.length === 0 && result.altered.length === 0) {
        console.log("Database schema is up to date.");
      }

      await closeDatabase();
      break;
    }

    default:
      console.log("Allow Database CLI");
      console.log("");
      console.log("Usage: bun src/cli.ts <command>");
      console.log("");
      console.log("Commands:");
      console.log("  sync, migrate  Sync database schema (create tables, add columns)");
      console.log("  status         Show pending schema changes without applying");
      console.log("");
      console.log("Environment variables:");
      console.log("  DATABASE_URL   Database connection URL");
      console.log("                 SQLite: sqlite:///path/to/db.sqlite");
      console.log("                 PostgreSQL: postgres://user:pass@host:5432/db");
      console.log("");
      console.log("Note: Hull uses sync instead of migrations. Sync is idempotent -");
      console.log("it creates missing tables and adds missing columns automatically.");
      process.exit(1);
  }
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
