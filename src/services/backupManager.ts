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

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function performBackup(
  onProgress?: (progress: UploadProgress) => void,
): Promise<BackupRecord> {
  const settings = await getSettings();

  if (settings.wifiOnly) {
    const wifi = await isWifiConnected();
    if (!wifi) {
      throw new Error('WiFi not connected. Backup requires WiFi connection.');
    }
  }

  const files = await findBackupFiles(settings.useRoot, settings.whatsappVariant);
  if (files.length === 0) {
    throw new Error(
      'No WhatsApp backup files found. Make sure WhatsApp is installed and has created a local backup.',
    );
  }

  const latestFile = files[0];
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
        if (attempt < MAX_RETRIES - 1) {
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
    throw error;
  }
}
