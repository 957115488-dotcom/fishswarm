/**
 * Rollback System
 * Automated rollback with decision tree
 */

import Database from 'better-sqlite3';
import { log, logError } from '../utils/logger';
import { MigrationRunner } from './migration-runner';
import { DatabaseBackup } from './backup';

export enum RollbackType {
  FAST = 'fast', // Quick rollback - switch connections
  STANDARD = 'standard', // Restore backup
  FULL = 'full', // Full restore with replay
}

export interface RollbackPlan {
  type: RollbackType;
  estimatedTime: number; // ms
  dataLoss: boolean;
  steps: RollbackStep[];
}

export interface RollbackStep {
  order: number;
  action: string;
  critical: boolean;
  rollbackAction?: string;
}

export interface RollbackResult {
  success: boolean;
  plan: RollbackPlan;
  executionResult?: {
    success: boolean;
    duration: number;
    error?: string;
  };
}

/** Generate rollback plan based on migration state */
export function generateRollbackPlan(
  targetVersion: number,
  currentVersion: number,
  hasDataChanges: boolean
): RollbackPlan {
  const steps: RollbackStep[] = [];

  // Step 1: Stop writes
  steps.push({
    order: 1,
    action: 'Block new writes',
    critical: true,
    rollbackAction: 'Resume writes',
  });

  if (hasDataChanges) {
    steps.push({
      order: 2,
      action: 'Verify data integrity',
      critical: true,
    });
  }

  // Determine rollback type
  if (targetVersion === currentVersion) {
    return {
      type: RollbackType.FAST,
      estimatedTime: 5000,
      dataLoss: false,
      steps,
    };
  } else if (currentVersion - targetVersion <= 2) {
    steps.push({
      order: 3,
      action: 'Restore database backup',
      critical: true,
      rollbackAction: 'Restore new backup',
    });
    return {
      type: RollbackType.STANDARD,
      estimatedTime: 300000,
      dataLoss: true,
      steps,
    };
  } else {
    steps.push({
      order: 3,
      action: 'Full database restore',
      critical: true,
    });
    steps.push({
      order: 4,
      action: 'Replay transaction logs',
      critical: false,
    });
    return {
      type: RollbackType.FULL,
      estimatedTime: 1800000,
      dataLoss: true,
      steps,
    };
  }
}

/** Rollback trigger conditions */
export const ROLLBACK_CONDITIONS = {
  // Auto-rollback triggers
  auto: {
    /** Migration fails completely */
    migrationFailed: true,
    /** Data corruption detected */
    dataCorruption: true,
    /** Critical integrity check fails */
    criticalIntegrityFail: true,
  },

  // Manual review triggers
  manual: {
    /** Performance degradation > 50% */
    performanceDegradation: false,
    /** Error rate > 1% */
    errorRateHigh: false,
    /** User complaints */
    userComplaints: false,
  },
};

export class AutoRollbackExecutor {
  private runner: MigrationRunner;

  constructor(_db: Database.Database, runner: MigrationRunner, _backup: DatabaseBackup) {
    this.runner = runner;
  }

  /** Execute rollback */
  async executeRollback(
    targetVersion: number,
    options: { auto?: boolean; force?: boolean; dryRun?: boolean } = {}
  ): Promise<RollbackResult> {
    const { auto = false, force = false, dryRun = false } = options;

    const currentVersion = this.runner.getCurrentVersion();
    const plan = generateRollbackPlan(targetVersion, currentVersion, true);

    // Dry run - return plan only
    if (dryRun) {
      return { success: true, plan };
    }

    // Non-auto mode needs confirmation
    if (!auto && !force) {
      log(`[Rollback] Manual confirmation required for ${plan.type} rollback`);
      return { success: false, plan };
    }

    // Check if auto-rollback is allowed
    if (!auto && !this.isRollbackAllowed(plan.type)) {
      logError(`[Rollback] Rollback type ${plan.type} requires manual approval`);
      return { success: false, plan };
    }

    log(`[Rollback] Executing ${plan.type} rollback to v${targetVersion}`);
    log(`[Rollback] Estimated time: ${plan.estimatedTime}ms`);

    const startTime = Date.now();

    try {
      const result = await this.runner.rollbackTo(targetVersion);
      const duration = Date.now() - startTime;

      if (result.success) {
        log(`[Rollback] ✓ Completed in ${duration}ms`);
      } else {
        logError(`[Rollback] ✗ Failed:`, result.errors);
      }

      return {
        success: result.success,
        plan,
        executionResult: {
          success: result.success,
          duration,
          error: result.errors.map((e) => e.error).join('; '),
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logError(`[Rollback] Execution error:`, errorMsg);

      return {
        success: false,
        plan,
        executionResult: {
          success: false,
          duration: Date.now() - startTime,
          error: errorMsg,
        },
      };
    }
  }

  private isRollbackAllowed(type: RollbackType): boolean {
    return type === RollbackType.FAST;
  }
}
