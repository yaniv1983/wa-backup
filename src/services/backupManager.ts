import AsyncStorage from '@react-native-async-storage/async-storage';
import {BackupRecord, BackupSettings, DEFAULT_SETTINGS, UploadProgress} from '../types';
import {findBackupFiles, rootCopyToReadable} from './fileService';
import {isWifiConnected} from './networkService';
import {uploadFile, enforceRetention} from './googleDriveService';
import {showUploadProgress, showBackupComplete, cancelNotification} from './notificationService';

const HISTORY_KEY = '@wa_backup_history';
const SETTINGS_KEY = '@wa_backup_settings';
const MAX_RETRIES = 3;
const RETRY_DELAYS = [5000, 15000, 45000];
const STALE_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 hours

// Global lock to prevent concurrent backups
let backupInProgress = false;

function log(msg: string) {
  console.log(`[WA-Backup] ${msg}`);
}

export async function getSettings(): Promise<BackupSettings> {
  const raw = await AsyncStorage.getItem(SETTINGS_KEY);
  if (!raw) return DEFAULT_SETTINGS;
  return {...DEFAULT_SETTINGS, ...JSON.parse(raw)};
}

export async function saveSettings(settings: BackupSettings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export async function getBackupHistory(): Promise<BackupRecord[]> {
  const raw = await AsyncStorage.getItem(HISTORY_KEY);
  if (!raw) return [];
  return JSON.parse(raw);
}

async function saveBackupRecord(record: BackupRecord): Promise<void> {
  const history = await getBackupHistory();
  const existing = history.findIndex(r => r.id === record.id);
  if (existing >= 0) {
    history[existing] = record;
  } else {
    history.unshift(record);
  }
  await AsyncStorage.setItem(
    HISTORY_KEY,
    JSON.stringify(history.slice(0, 50)),
  );
}

// Mark stale "in_progress" records as failed (app was killed mid-backup)
export async function cleanupStaleRecords(): Promise<number> {
  const history = await getBackupHistory();
  const now = Date.now();
  let cleaned = 0;

  for (const record of history) {
    if (record.status === 'in_progress' && (now - record.timestamp) > STALE_TIMEOUT_MS) {
      record.status = 'failed';
      record.error = 'Backup was interrupted (app was stopped by the system)';
      cleaned++;
    }
  }

  if (cleaned > 0) {
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    log(`Cleaned up ${cleaned} stale backup records`);
  }
  return cleaned;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function isBackupRunning(): boolean {
  return backupInProgress;
}

export async function performBackup(
  onProgress?: (progress: UploadProgress) => void,
): Promise<BackupRecord> {
  if (backupInProgress) {
    throw new Error('A backup is already in progress.');
  }
  backupInProgress = true;

  try {
    return await _doBackup(onProgress);
  } finally {
    backupInProgress = false;
  }
}

async function _doBackup(
  onProgress?: (progress: UploadProgress) => void,
): Promise<BackupRecord> {
  const settings = await getSettings();

  log('Starting backup...');

  if (settings.wifiOnly) {
    const wifi = await isWifiConnected();
    if (!wifi) {
      log('WiFi not connected, aborting');
      throw new Error('WiFi not connected. Backup requires WiFi connection.');
    }
  }

  const files = await findBackupFiles(settings.useRoot, settings.whatsappVariant);
  log(`Found ${files.length} backup files`);
  if (files.length === 0) {
    throw new Error(
      'No WhatsApp backup files found. Make sure WhatsApp is installed and has created a local backup.',
    );
  }

  const latestFile = files[0];
  log(`Selected: ${latestFile.name} (${latestFile.size} bytes)`);

  // Skip if this exact file was already backed up successfully (same name + size)
  const history = await getBackupHistory();
  const lastSuccess = history.find(r => r.status === 'completed');
  if (lastSuccess && lastSuccess.fileName === latestFile.name && lastSuccess.fileSize === latestFile.size) {
    log('Skipping backup - file unchanged since last successful backup');
    const skipRecord: BackupRecord = {
      id: `backup_${Date.now()}`,
      fileName: latestFile.name,
      fileSize: latestFile.size,
      driveFileId: '',
      timestamp: Date.now(),
      status: 'skipped',
    };
    await saveBackupRecord(skipRecord);
    return skipRecord;
  }

  const recordId = `backup_${Date.now()}`;

  const record: BackupRecord = {
    id: recordId,
    fileName: latestFile.name,
    fileSize: latestFile.size,
    driveFileId: '',
    timestamp: Date.now(),
    status: 'in_progress',
  };

  await saveBackupRecord(record);

  try {
    let uploadPath = latestFile.path;
    if (settings.useRoot && latestFile.path.startsWith('/data/')) {
      uploadPath = await rootCopyToReadable(latestFile.path);
    }

    const progressCallback = (p: UploadProgress) => {
      onProgress?.(p);
      showUploadProgress(latestFile.name, p.bytesUploaded, p.totalBytes).catch(() => {});
    };

    // Retry logic with exponential backoff
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        log(`Upload attempt ${attempt + 1}/${MAX_RETRIES}`);
        const driveFileId = await uploadFile(
          uploadPath,
          `${latestFile.name}_${new Date().toISOString().slice(0, 10)}`,
          progressCallback,
          settings.driveFolderId || undefined,
          settings.driveFolderName || undefined,
        );

        record.driveFileId = driveFileId;
        record.status = 'completed';
        await saveBackupRecord(record);
        log('Backup completed successfully');

        // Enforce retention
        if (settings.backupRetentionCount > 0) {
          try {
            await enforceRetention(
              settings.backupRetentionCount,
              settings.driveFolderId || undefined,
              settings.driveFolderName || undefined,
            );
          } catch {
            // Don't fail the backup if retention cleanup fails
          }
        }

        await showBackupComplete(true);
        return record;
      } catch (e: any) {
        lastError = e;
        log(`Attempt ${attempt + 1} failed: ${e.message}`);
        if (attempt < MAX_RETRIES - 1) {
          log(`Retrying in ${RETRY_DELAYS[attempt] / 1000}s...`);
          await delay(RETRY_DELAYS[attempt]);
        }
      }
    }

    throw lastError || new Error('Upload failed after retries');
  } catch (error: any) {
    record.status = 'failed';
    record.error = error.message;
    await saveBackupRecord(record);
    await showBackupComplete(false, error.message);
    log(`Backup failed: ${error.message}`);
    throw error;
  }
}
