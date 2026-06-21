/**
 * Database Module Exports
 * Unified database access with migration support
 */

export { initDatabase, getDatabase, closeDatabase, getDatabasePath } from './database';
export type {
  DatabaseInstance,
  MessageRow,
  ScheduledTaskRow,
  SessionRow,
  TraceStepRow,
} from './database';

export {
  CURRENT_SCHEMA_VERSION,
  getMigration,
  getPendingMigrations,
  migrations,
} from './migration';
export type { Migration } from './migration';
export { MigrationRunner } from './migration-runner';
export type { MigrationResult } from './migration-runner';

export { DatabaseBackup } from './backup';
export type { BackupMetadata } from './backup';

export { IntegrityChecker } from './integrity-checker';
export type { IntegrityCheckResult } from './integrity-checker';

export {
  AutoRollbackExecutor,
  generateRollbackPlan,
  ROLLBACK_CONDITIONS,
  RollbackType,
} from './rollback';
export type { RollbackPlan, RollbackResult, RollbackStep } from './rollback';

export { RELEASE_PHASES, ReleaseValidator } from './release-validator';
export type { ReleasePhase, ReleaseValidationResult } from './release-validator';

/**
 * Initialize database with migrations
 */
import { initDatabase as initDb, getDatabasePath } from './database';
import { MigrationRunner } from './migration-runner';
import { DatabaseBackup } from './backup';
import { IntegrityChecker } from './integrity-checker';
import { ReleaseValidator } from './release-validator';
import { app } from 'electron';
import { existsSync } from 'fs';
import { log, logError } from '../utils/logger';

let migrationRunner: MigrationRunner | null = null;
let backupManager: DatabaseBackup | null = null;

export async function initDatabaseWithMigrations(): Promise<ReturnType<typeof initDb>> {
  const dbPath = getDatabasePath();
  const userDataPath = app.getPath('userData');

  // Initialize backup manager
  backupManager = new DatabaseBackup(userDataPath, dbPath);

  // Backup before migration
  if (existsSync(dbPath)) {
    backupManager.createBackup('pre-migration');
  }

  // Initialize database
  const dbInstance = initDb();
  const rawDb = dbInstance.raw;

  // Initialize migration runner
  migrationRunner = new MigrationRunner(rawDb, backupManager);

  // Run migrations
  const result = await migrationRunner.runMigrations();

  if (!result.success) {
    logError('[Database] Migration failed:', result.errors);

    // Attempt rollback
    await migrationRunner.rollbackTo(migrationRunner.getCurrentVersion() - 1);

    // Restore backup
    if (backupManager) {
      const latestBackup = backupManager.getLatestBackup();
      if (latestBackup) {
        backupManager.restoreBackup(latestBackup);
      }
    }

    throw new Error('Migration failed after rollback attempts');
  }

  log('[Database] Database initialized with migrations');
  return dbInstance;
}

/**
 * Get migration runner
 */
export function getMigrationRunner(): MigrationRunner {
  if (!migrationRunner) {
    throw new Error('Database not initialized with migrations');
  }
  return migrationRunner;
}

/**
 * Get backup manager
 */
export function getBackupManager(): DatabaseBackup {
  if (!backupManager) {
    throw new Error('Database not initialized');
  }
  return backupManager;
}

/**
 * Run integrity checks
 */
export function runIntegrityChecks(): ReturnType<typeof IntegrityChecker.prototype.runAllChecks> {
  const db = initDb();
  const checker = new IntegrityChecker(db.raw);
  return checker.runAllChecks();
}

/**
 * Validate release
 */
export function validateRelease(): ReturnType<typeof ReleaseValidator.prototype.validateRelease> {
  const db = initDb();
  const runner = getMigrationRunner();
  const validator = new ReleaseValidator(db.raw, runner);
  return validator.validateRelease();
}
