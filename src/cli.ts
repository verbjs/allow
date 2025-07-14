#!/usr/bin/env bun
import { runMigrations, rollbackMigrations } from "./migration";

const command = process.argv[2];
const dbConnection = process.env.DATABASE_URL || "auth.db";

switch (command) {
  case "migrate":
    await runMigrations({
      database: {
        type: "sqlite",
        connection: dbConnection
      }
    });
    break;
    
  case "rollback": {
    const steps = parseInt(process.argv[3]) || 1;
    await rollbackMigrations({
      database: {
        type: "sqlite", 
        connection: dbConnection
      }
    }, steps);
    break;
  }
    
  default:
    console.log("Usage: bun src/cli.ts [migrate|rollback] [steps]");
    console.log("Environment variables:");
    console.log("  DATABASE_URL - Database connection string (default: auth.db)");
    process.exit(1);
}