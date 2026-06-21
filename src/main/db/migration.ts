/**
 * Database Migration System
 * Version-controlled schema migrations with rollback support
 */

import Database from 'better-sqlite3';
import { log } from '../utils/logger';

/** Current schema version */
export const CURRENT_SCHEMA_VERSION = 3;

/** Migration interface */
export interface Migration {
  version: number;
  description: string;

  /** Upgrade script */
  up: (db: Database.Database) => void | Promise<void>;

  /** Rollback script */
  down: (db: Database.Database) => void | Promise<void>;

  /** Pre-check: verify prerequisites */
  preCheck?: (db: Database.Database) => boolean | Promise<boolean>;

  /** Post-check: verify success */
  postCheck?: (db: Database.Database) => boolean | Promise<boolean>;
}

/** Migration registry */
export const migrations: Migration[] = [
  {
    version: 1,
    description: 'Initial schema (v1.0 baseline)',
    up: (_db) => {
      // v1.0 schema is already embedded in initializeSchema()
      log('[Migration] v1: Initial schema already applied');
    },
    down: (_db) => {
      throw new Error('Cannot rollback to v0.x - no migration available');
    },
  },
  {
    version: 2,
    description: 'Add role_capabilities table for role system',
    preCheck: (db) => {
      const result = db
        .prepare(
          `
        SELECT name FROM sqlite_master WHERE type='table' AND name='role_capabilities'
      `
        )
        .get();
      return !result;
    },
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS role_capabilities (
          id TEXT PRIMARY KEY,
          role_id TEXT NOT NULL,
          capability TEXT NOT NULL,
          config TEXT,
          created_at INTEGER NOT NULL,
          FOREIGN KEY (role_id) REFERENCES sessions(id) ON DELETE CASCADE
        )
      `);
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_role_capabilities_role_id 
        ON role_capabilities(role_id)
      `);
      log('[Migration] v2: Created role_capabilities table');
    },
    down: (db) => {
      db.exec(`DROP INDEX IF EXISTS idx_role_capabilities_role_id`);
      db.exec(`DROP TABLE IF EXISTS role_capabilities`);
      log('[Migration] v2: Dropped role_capabilities table');
    },
    postCheck: (db) => {
      const result = db
        .prepare(
          `
        SELECT name FROM sqlite_master WHERE type='table' AND name='role_capabilities'
      `
        )
        .get();
      return !!result;
    },
  },
  {
    version: 3,
    description: 'Add session_metadata for analytics',
    preCheck: (db) => {
      const result = db
        .prepare(
          `
        SELECT name FROM sqlite_master WHERE type='table' AND name='session_metadata'
      `
        )
        .get();
      return !result;
    },
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS session_metadata (
          session_id TEXT PRIMARY KEY,
          model TEXT,
          total_tokens INTEGER DEFAULT 0,
          api_latency_ms INTEGER,
          first_response_at INTEGER,
          last_activity_at INTEGER,
          FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
        )
      `);
      log('[Migration] v3: Created session_metadata table');
    },
    down: (db) => {
      db.exec(`DROP TABLE IF EXISTS session_metadata`);
      log('[Migration] v3: Dropped session_metadata table');
    },
    postCheck: (db) => {
      const result = db
        .prepare(
          `
        SELECT name FROM sqlite_master WHERE type='table' AND name='session_metadata'
      `
        )
        .get();
      return !!result;
    },
  },
];

/** Get migration by version */
export function getMigration(version: number): Migration | undefined {
  return migrations.find((m) => m.version === version);
}

/** Get all pending migrations from current version */
export function getPendingMigrations(currentVersion: number): Migration[] {
  return migrations.filter(
    (m) => m.version > currentVersion && m.version <= CURRENT_SCHEMA_VERSION
  );
}
