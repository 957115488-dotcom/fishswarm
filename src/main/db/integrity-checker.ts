/**
 * Data Integrity Checker
 * Validates database consistency after migration
 */

import Database from 'better-sqlite3';

export interface IntegrityCheckResult {
  passed: boolean;
  checks: Array<{
    name: string;
    passed: boolean;
    details: string;
    severity: 'critical' | 'warning' | 'info';
  }>;
}

type IntegrityCheck = IntegrityCheckResult['checks'][number];

export class IntegrityChecker {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  /** Run all integrity checks */
  async runAllChecks(): Promise<IntegrityCheckResult> {
    const checks = [
      ...(await this.checkForeignKeys()).checks,
      ...(await this.checkIndexes()).checks,
      ...(await this.checkDataConsistency()).checks,
      ...(await this.checkNullConstraints()).checks,
      ...(await this.checkDuplicateKeys()).checks,
      ...(await this.checkOrphanedRecords()).checks,
      ...(await this.checkSchemaVersion()).checks,
    ];

    const passed = checks.every((c) => c.passed);
    return { passed, checks };
  }

  /** Check foreign key constraints */
  private async checkForeignKeys(): Promise<IntegrityCheckResult> {
    const violations = this.db.prepare(`PRAGMA foreign_key_check`).all();
    const passed = violations.length === 0;

    return {
      passed,
      checks: [
        {
          name: 'Foreign Key Constraints',
          passed,
          details: passed ? 'All foreign keys valid' : `${violations.length} violations found`,
          severity: passed ? 'info' : 'critical',
        },
      ],
    };
  }

  /** Check required indexes */
  private async checkIndexes(): Promise<IntegrityCheckResult> {
    const requiredIndexes = [
      'idx_messages_session_id',
      'idx_messages_timestamp',
      'idx_trace_steps_session_id',
      'idx_trace_steps_timestamp',
      'idx_scheduled_tasks_next_run',
    ];

    const checks: IntegrityCheck[] = requiredIndexes.map((indexName) => {
      const exists = this.db
        .prepare(
          `
        SELECT name FROM sqlite_master WHERE type='index' AND name=?
      `
        )
        .get(indexName);

      return {
        name: `Index: ${indexName}`,
        passed: !!exists,
        details: exists ? 'Index exists' : 'Index missing',
        severity: exists ? 'info' : 'warning',
      };
    });

    return { passed: checks.every((c) => c.passed), checks };
  }

  /** Check data consistency */
  private async checkDataConsistency(): Promise<IntegrityCheckResult> {
    const checks: IntegrityCheck[] = [];

    // Sessions without messages (inactive)
    const orphanSessions = this.db
      .prepare(
        `
      SELECT s.id FROM sessions s
      LEFT JOIN messages m ON s.id = m.session_id
      WHERE m.id IS NULL AND s.status != 'completed'
    `
      )
      .all();

    checks.push({
      name: 'Sessions without messages',
      passed: orphanSessions.length === 0,
      details: `${orphanSessions.length} inactive sessions without messages`,
      severity: orphanSessions.length > 100 ? 'warning' : 'info',
    });

    // Empty titles
    const emptyTitles = this.db
      .prepare(
        `
      SELECT id FROM sessions WHERE title IS NULL OR title = ''
    `
      )
      .all();

    checks.push({
      name: 'Empty session titles',
      passed: emptyTitles.length === 0,
      details:
        emptyTitles.length === 0
          ? 'All sessions have titles'
          : `${emptyTitles.length} sessions with empty titles`,
      severity: emptyTitles.length > 0 ? 'warning' : 'info',
    });

    return { passed: checks.every((c) => c.passed), checks };
  }

  /** Check null constraints */
  private async checkNullConstraints(): Promise<IntegrityCheckResult> {
    const nullSessions = this.db
      .prepare(
        `
      SELECT id FROM sessions 
      WHERE title IS NULL OR title = '' OR status IS NULL OR status = ''
    `
      )
      .all();

    return {
      passed: nullSessions.length === 0,
      checks: [
        {
          name: 'Required fields in sessions',
          passed: nullSessions.length === 0,
          details:
            nullSessions.length === 0
              ? 'All required fields populated'
              : `${nullSessions.length} records with null required fields`,
          severity: nullSessions.length > 0 ? 'critical' : 'info',
        },
      ],
    };
  }

  /** Check duplicate keys */
  private async checkDuplicateKeys(): Promise<IntegrityCheckResult> {
    const tables = ['sessions', 'messages', 'trace_steps', 'scheduled_tasks'];

    const checks = await Promise.all(
      tables.map(async (table) => {
        const duplicates = this.db
          .prepare(
            `
        SELECT id, COUNT(*) as cnt FROM ${table} GROUP BY id HAVING cnt > 1
      `
          )
          .all();

        return {
          name: `Primary keys in ${table}`,
          passed: duplicates.length === 0,
          details: duplicates.length === 0 ? 'No duplicates' : `${duplicates.length} duplicates`,
          severity: 'critical' as const,
        };
      })
    );

    return { passed: checks.every((c) => c.passed), checks };
  }

  /** Check orphaned records */
  private async checkOrphanedRecords(): Promise<IntegrityCheckResult> {
    const orphanMessages = this.db
      .prepare(
        `
      SELECT m.id FROM messages m
      LEFT JOIN sessions s ON m.session_id = s.id
      WHERE s.id IS NULL
    `
      )
      .all();

    return {
      passed: orphanMessages.length === 0,
      checks: [
        {
          name: 'Orphaned messages',
          passed: orphanMessages.length === 0,
          details:
            orphanMessages.length === 0
              ? 'No orphaned records'
              : `${orphanMessages.length} orphaned messages`,
          severity: orphanMessages.length > 0 ? 'critical' : 'info',
        },
      ],
    };
  }

  /** Check schema version */
  private async checkSchemaVersion(): Promise<IntegrityCheckResult> {
    const version = this.db
      .prepare(
        `
      SELECT value FROM __migration_state WHERE key = 'schema_version'
    `
      )
      .get() as { value: string } | undefined;

    return {
      passed: !!version,
      checks: [
        {
          name: 'Schema version',
          passed: !!version,
          details: version ? `Version ${version.value}` : 'Version not recorded',
          severity: version ? 'info' : 'warning',
        },
      ],
    };
  }
}
