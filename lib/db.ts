import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { runMigrations } from "./migrate";

// Prototype data layer: SQLite via Node's built-in node:sqlite module.
// See prisma/schema.sql for the canonical schema (kept in the prisma/ dir
// for continuity with the intended Supabase/Postgres migration path).
//
// To move to Supabase/Postgres later: replace this file with a
// @supabase/supabase-js or `pg` client and keep the same exported function
// names (getDb, query helpers) so callers don't change.

declare global {
  // eslint-disable-next-line no-var
  var __procurementDb: DatabaseSync | undefined;
}

function initSchema(db: DatabaseSync) {
  const schemaPath = path.join(process.cwd(), "prisma", "schema.sql");
  const sql = fs.readFileSync(schemaPath, "utf-8");
  db.exec(sql);
}

export function getDb(): DatabaseSync {
  if (!global.__procurementDb) {
    const dbPath = path.join(process.cwd(), "prisma", "dev.db");
    const db = new DatabaseSync(dbPath);
    db.exec("PRAGMA foreign_keys = ON;");
    initSchema(db);
    runMigrations(db);
    global.__procurementDb = db;
  }
  return global.__procurementDb;
}

export function newId(prefix = ""): string {
  const rand = Math.random().toString(36).slice(2, 10);
  const time = Date.now().toString(36);
  return `${prefix}${time}${rand}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}
