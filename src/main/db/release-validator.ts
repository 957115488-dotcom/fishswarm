/**
 * Release Validator
 * Gray release validation and monitoring
 */

import Database from 'better-sqlite3';
import { log, logError } from '../utils/logger';
import { IntegrityChecker } from './integrity-checker';
import { MigrationRunner } from './migration-runner';

export interface ReleaseValidationResult {
  passed: boolean;
  checks: Array<{
    category: string;
    name: string;
    passed: boolean;
    details: string;
  }>;
}

export interface ReleasePhase {
  name: string;
  percentage: number;
  duration: number; // ms
  metrics: {
    errorRate: number;
    latencyP95: number;
    success: boolean;
  };
}

interface JournalModeRow {
  journal_mode: string;
}

interface UserVersionRow {
  user_version: number;
}

interface ForeignKeysRow {
  foreign_keys: number;
}

/** Gray release phases */
export const RELEASE_PHASES: ReleasePhase[] = [
  {
    name: 'pre-release',
    percentage: 0,
    duration: 0,
    metrics: { errorRate: 0, latencyP95: 0, success: false },
  },
  {
    name: 'canary',
    percentage: 5,
    duration: 600000,
    metrics: { errorRate: 0.001, latencyP95: 2000, success: false },
  }, // 10min
  {
    name: 'small',
    percentage: 25,
    duration: 600000,
    metrics: { errorRate: 0.005, latencyP95: 2000, success: false },
  }, // 10min
  {
    name: 'medium',
    percentage: 50,
    duration: 600000,
    metrics: { errorRate: 0.005, latencyP95: 2000, success: false },
  }, // 10min
  {
    name: 'large',
    percentage: 75,
    duration: 600000,
    metrics: { errorRate: 0.01, latencyP95: 3000, success: false },
  }, // 10min
  {
    name: 'full',
    percentage: 100,
    duration: 86400000,
    metrics: { errorRate: 0.01, latencyP95: 3000, success: false },
  }, // 24h
];

export class ReleaseValidator {
  private db: Database.Database;
  private integrityChecker: IntegrityChecker;

  constructor(db: Database.Database, _runner: MigrationRunner) {
    this.db = db;
    this.integrityChecker = new IntegrityChecker(db);
  }

  /** Validate release readiness */
  async validateRelease(): Promise<ReleaseValidationResult> {
    const checks: ReleaseValidationResult['checks'] = [];

    // 1. Schema validation
    checks.push(...(await this.validateSchema()).checks);

    // 2. Data integrity
    const integrityResult = await this.integrityChecker.runAllChecks();
    checks.push(
      ...integrityResult.checks.map((c) => ({
        category: 'Integrity',
        name: c.name,
        passed: c.passed,
        details: c.details,
      }))
    );

    // 3. Functionality
    checks.push(...(await this.validateFunctionality()).checks);

    // 4. Performance
    checks.push(...(await this.validatePerformance()).checks);

    // 5. Compatibility
    checks.push(...(await this.validateCompatibility()).checks);

    const passed = checks.every((c) => c.passed);

    if (passed) {
      log('[Release] ✓ All validation checks passed');
    } else {
      logError(
        '[Release] ✗ Validation failed:',
        checks.filter((c) => !c.passed)
      );
    }

    return { passed, checks };
  }

  /** Validate schema */
  private async validateSchema(): Promise<ReleaseValidationResult> {
    const requiredTables = ['sessions', 'messages', 'trace_steps', 'scheduled_tasks', 'skills'];

    const checks = await Promise.all(
      requiredTables.map(async (table) => {
        const exists = this.db
          .prepare(
            `
        SELECT name FROM sqlite_master WHERE type='table' AND name=?
      `
          )
          .get(table);

        return {
          category: 'Schema',
          name: `Table: ${table}`,
          passed: !!exists,
          details: exists ? 'Table exists' : 'Table missing',
        };
      })
    );

    return { passed: checks.every((c) => c.passed), checks };
  }

  /** Validate functionality */
  private async validateFunctionality(): Promise<ReleaseValidationResult> {
    const checks = [];

    try {
      const testId = `test-${Date.now()}`;
      this.db
        .prepare(
          `
        INSERT INTO sessions (id, title, status, mounted_paths, allowed_tools, memory_enabled, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
        )
        .run(testId, 'Test', 'active', '[]', '[]', 0, Date.now(), Date.now());

      this.db.prepare('DELETE FROM sessions WHERE id = ?').run(testId);

      checks.push({
        category: 'Functionality',
        name: 'Session CRUD',
        passed: true,
        details: 'Session operations work correctly',
      });
    } catch (error) {
      checks.push({
        category: 'Functionality',
        name: 'Session CRUD',
        passed: false,
        details: String(error),
      });
    }

    return { passed: checks.every((c) => c.passed), checks };
  }

  /** Validate performance */
  private async validatePerformance(): Promise<ReleaseValidationResult> {
    const checks = [];

    // Query latency test
    const startTime = Date.now();
    this.db.prepare('SELECT * FROM sessions ORDER BY updated_at DESC LIMIT 100').all();
    const queryTime = Date.now() - startTime;

    checks.push({
      category: 'Performance',
      name: 'Query latency',
      passed: queryTime < 1000,
      details: `Query time: ${queryTime}ms`,
    });

    // WAL mode check
    const walMode = (this.db.pragma('journal_mode') as JournalModeRow[])[0]?.journal_mode;
    checks.push({
      category: 'Performance',
      name: 'WAL mode',
      passed: walMode === 'wal',
      details: `Journal mode: ${walMode}`,
    });

    return { passed: checks.every((c) => c.passed), checks };
  }

  /** Validate compatibility */
  private async validateCompatibility(): Promise<ReleaseValidationResult> {
    const checks = [];

    // SQLite version
    const version = (this.db.pragma('user_version') as UserVersionRow[])[0]?.user_version ?? 0;
    checks.push({
      category: 'Compatibility',
      name: 'SQLite version',
      passed: version >= 3,
      details: `SQLite v${version}`,
    });

    // Foreign keys
    const fkEnabled = (this.db.pragma('foreign_keys') as ForeignKeysRow[])[0]?.foreign_keys ?? 0;
    checks.push({
      category: 'Compatibility',
      name: 'Foreign keys',
      passed: fkEnabled === 1,
      details: `Foreign keys: ${fkEnabled ? 'enabled' : 'disabled'}`,
    });

    return { passed: checks.every((c) => c.passed), checks };
  }

  /** Get release phase */
  getReleasePhase(percentage: number): ReleasePhase | undefined {
    return RELEASE_PHASES.find((p) => p.percentage === percentage);
  }

  /** Check if release can proceed to next phase */
  canProceedToNextPhase(currentPhase: ReleasePhase): boolean {
    return currentPhase.metrics.success;
  }
}
