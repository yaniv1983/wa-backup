export interface BackupFile {
  name: string;
  path: string;
  size: number;
  lastModified: number;
  source?: 'business' | 'personal';
}

export interface BackupRecord {
  id: string;
  fileName: string;
  fileSize: number;
  driveFileId: string;
  timestamp: number;
  status: 'completed' | 'failed' | 'in_progress';
  error?: string;
}

export interface UploadProgress {
  bytesUploaded: number;
  totalBytes: number;
  percentage: number;
}

export interface DriveFolder {
  id: string;
  name: string;
}

export interface BackupSettings {
  autoBackupEnabled: boolean;
  autoBackupInterval: 'daily' | 'weekly';
  autoBackupTime: string;
  wifiOnly: boolean;
  backupPath: string;
  useRoot: boolean;
  driveFolderId: string;
  driveFolderName: string;
  backupRetentionCount: number;
  whatsappVariant: 'business' | 'personal' | 'both';
}

export const DEFAULT_SETTINGS: BackupSettings = {
  autoBackupEnabled: false,
  autoBackupInterval: 'daily',
  autoBackupTime: '03:30',
  wifiOnly: true,
  backupPath: '/storage/emulated/0/Android/media/com.whatsapp.w4b/WhatsApp Business',
  useRoot: false,
  driveFolderId: '',
  driveFolderName: 'WA Business Backup',
  backupRetentionCount: 3,
  whatsappVariant: 'business',
};
