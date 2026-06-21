/**
 * Database Backup System
 * Automated backups with version management
 */

import { join, dirname } from 'path';
import { createHash } from 'crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  unlinkSync,
  readFileSync,
  writeFileSync,
  openSync,
  readSync,
  closeSync,
} from 'fs';
import { log, logError, logWarn } from '../utils/logger';

export interface BackupMetadata {
  version: number;
  createdAt: number;
  size: number;
  reason: string;
  checksum: string;
}

const SQLITE_HEADER = Buffer.from('SQLite format 3\0', 'utf8');

export class DatabaseBackup {
  private backupDir: string;
  private maxBackups = 10;
  private dbPath: string;

  constructor(userDataPath: string, dbPath: string) {
    this.dbPath = dbPath;
    this.backupDir = join(dirname(userDataPath), 'backups');
    this.ensureBackupDir();
  }

  getDbPath(): string {
    return this.dbPath;
  }

  private ensureBackupDir(): void {
    if (!existsSync(this.backupDir)) {
      mkdirSync(this.backupDir, { recursive: true });
    }
  }

  private computeChecksum(filePath: string): string {
    const content = readFileSync(filePath);
    return createHash('sha256').update(content).digest('hex');
  }

  /** Create a backup before migration/rollback */
  createBackup(reason: string): string {
    const timestamp = Date.now();
    const version = this.getCurrentSchemaVersion();
    const backupFileName = `fishswarm-v${version}-${timestamp}.db`;
    const backupPath = join(this.backupDir, backupFileName);

    try {
      // Copy main database file
      copyFileSync(this.dbPath, backupPath);

      // Copy WAL file if exists
      const walPath = this.dbPath + '-wal';
      if (existsSync(walPath)) {
        copyFileSync(walPath, backupPath + '-wal');
      }

      // Copy SHM file if exists
      const shmPath = this.dbPath + '-shm';
      if (existsSync(shmPath)) {
        copyFileSync(shmPath, backupPath + '-shm');
      }

      // Create metadata file
      const stats = statSync(backupPath);
      const metadata: BackupMetadata = {
        version,
        createdAt: timestamp,
        size: stats.size,
        reason,
        checksum: this.computeChecksum(backupPath),
      };

      const metaPath = backupPath + '.meta.json';
      writeFileSync(metaPath, JSON.stringify(metadata, null, 2));

      log(`[Backup] Created: ${backupPath} (${reason})`);

      // Cleanup old backups
      this.cleanupOldBackups();

      return backupPath;
    } catch (error) {
      logError(`[Backup] Failed to create backup:`, error);
      throw error;
    }
  }

  /** Restore from a backup */
  restoreBackup(backupPath: string): void {
    if (!existsSync(backupPath)) {
      throw new Error(`Backup not found: ${backupPath}`);
    }

    // Validate backup
    this.validateBackup(backupPath);

    // Emergency backup of current state
    const emergencyBackup = this.dbPath + `.emergency-${Date.now()}`;
    if (existsSync(this.dbPath)) {
      copyFileSync(this.dbPath, emergencyBackup);
      log(`[Backup] Emergency backup: ${emergencyBackup}`);
    }

    // Restore main database
    copyFileSync(backupPath, this.dbPath);

    // Restore WAL
    const walBackup = backupPath + '-wal';
    if (existsSync(walBackup)) {
      copyFileSync(walBackup, this.dbPath + '-wal');
    }

    // Restore SHM
    const shmBackup = backupPath + '-shm';
    if (existsSync(shmBackup)) {
      copyFileSync(shmBackup, this.dbPath + '-shm');
    }

    log(`[Backup] Restored from: ${backupPath}`);
  }

  /** List all backups */
  listBackups(): Array<{ path: string; metadata: BackupMetadata }> {
    if (!existsSync(this.backupDir)) return [];

    return readdirSync(this.backupDir)
      .filter((f) => f.endsWith('.db'))
      .map((f) => {
        const filePath = join(this.backupDir, f);
        const metaPath = filePath + '.meta.json';

        let metadata: BackupMetadata;
        if (existsSync(metaPath)) {
          metadata = JSON.parse(readFileSync(metaPath, 'utf-8'));
        } else {
          const stats = statSync(filePath);
          metadata = {
            version: 0,
            createdAt: stats.mtimeMs,
            size: stats.size,
            reason: 'unknown',
            checksum: '',
          };
        }

        return { path: filePath, metadata };
      })
      .sort((a, b) => b.metadata.createdAt - a.metadata.createdAt);
  }

  /** Get latest backup */
  getLatestBackup(): string | null {
    const backups = this.listBackups();
    return backups[0]?.path ?? null;
  }

  /** Validate backup file */
  private validateBackup(backupPath: string): boolean {
    const stats = statSync(backupPath);
    if (stats.size === 0) {
      throw new Error('Backup file is empty');
    }

    // Verify SQLite header
    const fd = openSync(backupPath, 'r');
    const buffer = Buffer.alloc(16);
    readSync(fd, buffer, 0, 16, 0);
    closeSync(fd);

    if (!buffer.equals(SQLITE_HEADER)) {
      throw new Error('Invalid SQLite backup file');
    }

    return true;
  }

  /** Cleanup old backups */
  private cleanupOldBackups(): void {
    const backups = this.listBackups();
    if (backups.length <= this.maxBackups) return;

    const toDelete = backups.slice(this.maxBackups);
    for (const backup of toDelete) {
      try {
        unlinkSync(backup.path);
        const metaPath = backup.path + '.meta.json';
        if (existsSync(metaPath)) {
          unlinkSync(metaPath);
        }
        // Clean WAL/SHM
        if (existsSync(backup.path + '-wal')) unlinkSync(backup.path + '-wal');
        if (existsSync(backup.path + '-shm')) unlinkSync(backup.path + '-shm');

        log(`[Backup] Cleaned up: ${backup.path}`);
      } catch (error) {
        logWarn(`[Backup] Failed to cleanup: ${backup.path}`);
      }
    }
  }

  private getCurrentSchemaVersion(): number {
    return 0; // Simplified - would read from migration state
  }
}
