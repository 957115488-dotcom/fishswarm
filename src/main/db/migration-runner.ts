/**
 * Migration Runner
 * Executes schema migrations with transaction safety
 */

import Database from 'better-sqlite3';
import { log, logError } from '../utils/logger';
import { CURRENT_SCHEMA_VERSION, getMigration, migrations } from './migration';
import { DatabaseBackup } from './backup';

export interface MigrationResult {
  success: boolean;
  currentVersion: number;
  appliedMigrations: number[];
  errors: Array<{ version: number; error: string }>;
  executionTime: number;
}

export class MigrationRunner {
  private db: Database.Database;
  private backup: DatabaseBackup;
  private stateTable = '__migration_state';

  constructor(db: Database.Database, backup: DatabaseBackup) {
    this.db = db;
    this.backup = backup;
    this.ensureStateTable();
  }

  private ensureStateTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ${this.stateTable} (
        key TEXT PRIMARY KEY,
        value TEXT
      )
    `);
  }

  private getState(key: string): string | null {
    const row = this.db.prepare(`SELECT value FROM ${this.stateTable} WHERE key = ?`).get(key) as
      | { value: string }
      | undefined;
    return row?.value ?? null;
  }

  private setState(key: string, value: string): void {
    this.db
      .prepare(`INSERT OR REPLACE INTO ${this.stateTable} (key, value) VALUES (?, ?)`)
      .run(key, value);
  }

  /** Get current schema version */
  getCurrentVersion(): number {
    const version = this.getState('schema_version');
    return version ? parseInt(version, 10) : 1;
  }

  /** Run all pending migrations */
  async runMigrations(): Promise<MigrationResult> {
    const startTime = Date.now();
    const result: MigrationResult = {
      success: true,
      currentVersion: this.getCurrentVersion(),
      appliedMigrations: [],
      errors: [],
      executionTime: 0,
    };

    const currentVersion = this.getCurrentVersion();
    const targetVersion = CURRENT_SCHEMA_VERSION;

    if (currentVersion >= targetVersion) {
      log(`[Migration] Already at version ${currentVersion}`);
      result.executionTime = Date.now() - startTime;
      return result;
    }

    log(`[Migration] Starting migration from v${currentVersion} to v${targetVersion}`);

    // Run migrations in order
    for (const migration of migrations) {
      if (migration.version <= currentVersion) continue;
      if (migration.version > targetVersion) break;

      try {
        // Pre-check
        if (migration.preCheck && !(await migration.preCheck(this.db))) {
          log(`[Migration] v${migration.version} preCheck failed, skipping`);
          continue;
        }

        log(`[Migration] Applying v${migration.version}: ${migration.description}`);

        // Backup before migration
        this.backup.createBackup(`pre-migration-v${migration.version}`);

        // Execute in transaction for atomicity
        const txn = this.db.transaction(() => {
          migration.up(this.db);
        });

        await txn();

        // Record success
        this.setState('schema_version', String(migration.version));
        this.setState(`migration_${migration.version}_at`, String(Date.now()));

        // Post-check
        if (migration.postCheck) {
          const checkResult = await migration.postCheck(this.db);
          if (!checkResult) {
            throw new Error(`Post-check failed for v${migration.version}`);
          }
        }

        result.appliedMigrations.push(migration.version);
        log(`[Migration] ✓ v${migration.version} applied successfully`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logError(`[Migration] ✗ v${migration.version} failed:`, errorMsg);

        result.errors.push({ version: migration.version, error: errorMsg });
        result.success = false;
        break;
      }
    }

    result.currentVersion = this.getCurrentVersion();
    result.executionTime = Date.now() - startTime;
    return result;
  }

  /** Rollback to a specific version */
  async rollbackTo(targetVersion: number): Promise<MigrationResult> {
    const startTime = Date.now();
    const result: MigrationResult = {
      success: true,
      currentVersion: this.getCurrentVersion(),
      appliedMigrations: [],
      errors: [],
      executionTime: 0,
    };

    const currentVersion = this.getCurrentVersion();

    if (targetVersion >= currentVersion) {
      result.success = false;
      result.errors.push({
        version: currentVersion,
        error: 'Target version must be lower than current',
      });
      return result;
    }

    log(`[Migration] Rolling back from v${currentVersion} to v${targetVersion}`);

    // Rollback in reverse order
    for (let v = currentVersion; v > targetVersion; v--) {
      const migration = getMigration(v);
      if (!migration) {
        result.errors.push({ version: v, error: 'Migration not found' });
        result.success = false;
        break;
      }

      try {
        log(`[Migration] Rolling back v${v}: ${migration.description}`);

        // Backup before rollback
        this.backup.createBackup(`pre-rollback-v${v}`);

        const txn = this.db.transaction(() => {
          migration.down(this.db);
        });

        await txn();

        this.setState('schema_version', String(v - 1));
        result.appliedMigrations.push(v);
        log(`[Migration] ✓ v${v} rolled back successfully`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logError(`[Migration] ✗ Rollback v${v} failed:`, errorMsg);

        result.errors.push({ version: v, error: `Rollback failed: ${errorMsg}` });
        result.success = false;
        break;
      }
    }

    result.currentVersion = this.getCurrentVersion();
    result.executionTime = Date.now() - startTime;
    return result;
  }
}
