import RNFS from 'react-native-fs';
import {NativeModules} from 'react-native';
import {BackupFile} from '../types';

const {StorageModule} = NativeModules;

const WA_BUSINESS_PATHS = [
  '/storage/emulated/0/Android/media/com.whatsapp.w4b/WhatsApp Business/Databases',
  '/storage/emulated/0/WhatsApp Business/Databases',
  '/storage/emulated/0/Android/media/com.whatsapp.w4b/WhatsApp Business/Backups',
  '/data/data/com.whatsapp.w4b/databases',
  '/data/data/com.whatsapp.w4b/files/Backups',
];

const WA_PERSONAL_PATHS = [
  '/storage/emulated/0/Android/media/com.whatsapp/WhatsApp/Databases',
  '/storage/emulated/0/WhatsApp/Databases',
  '/storage/emulated/0/Android/media/com.whatsapp/WhatsApp/Backups',
  '/data/data/com.whatsapp/databases',
  '/data/data/com.whatsapp/files/Backups',
];

const DB_BACKUP_PATTERN = /^msgstore.*\.crypt\d+$/i;
const ANY_CRYPT_PATTERN = /\.crypt\d+$/i;
const SKIP_FILES = ['backup_settings.json.crypt15', 'backup_settings.json.crypt14'];

function isMainBackupFile(name: string): boolean {
  return DB_BACKUP_PATTERN.test(name);
}

function isBackupFile(name: string): boolean {
  if (SKIP_FILES.includes(name.toLowerCase())) return false;
  return ANY_CRYPT_PATTERN.test(name);
}

export async function findBackupFiles(
  useRoot: boolean = false,
  variant: 'business' | 'personal' | 'both' = 'business',
): Promise<BackupFile[]> {
  const files: BackupFile[] = [];

  const pathSets: Array<{paths: string[]; source: 'business' | 'personal'}> = [];
  if (variant === 'business' || variant === 'both') {
    pathSets.push({paths: WA_BUSINESS_PATHS, source: 'business'});
  }
  if (variant === 'personal' || variant === 'both') {
    pathSets.push({paths: WA_PERSONAL_PATHS, source: 'personal'});
  }

  for (const {paths, source} of pathSets) {
    for (const basePath of paths) {
      // Skip /data/ paths unless root mode
      if (basePath.startsWith('/data/') && !useRoot) continue;

      try {
        if (useRoot) {
          const items = await rootReadDir(basePath);
          for (const item of items) {
            if (!item.isDirectory && isBackupFile(item.name)) {
              let size = item.size;
              if (size === 0 || size < 1000) {
                try {
                  size = await StorageModule.rootGetFileSize(item.path);
                } catch {}
              }
              files.push({name: item.name, path: item.path, size, lastModified: Date.now(), source});
            }
          }
        } else {
          const exists = await RNFS.exists(basePath);
          if (!exists) continue;

          const items = await RNFS.readDir(basePath);
          for (const item of items) {
            if (item.isFile() && isBackupFile(item.name)) {
              files.push({
                name: item.name,
                path: item.path,
                size: item.size ?? 0,
                lastModified: new Date(item.mtime ?? 0).getTime(),
                source,
              });
            }
          }
        }
      } catch {
        continue;
      }
    }
  }

  // Prefer the live database (msgstore.db.crypt15 - no timestamp) over dated snapshots.
  // The live file is what WhatsApp continuously updates; dated files are old snapshots.
  files.sort((a, b) => {
    // Live DB files like "msgstore.db.crypt15" (no date in name) come first
    const aIsLive = /^msgstore\.db\.crypt\d+$/i.test(a.name) ? 1 : 0;
    const bIsLive = /^msgstore\.db\.crypt\d+$/i.test(b.name) ? 1 : 0;
    if (aIsLive !== bIsLive) return bIsLive - aIsLive;
    // Then prefer main backup files over other crypt files
    const aIsMain = isMainBackupFile(a.name) ? 1 : 0;
    const bIsMain = isMainBackupFile(b.name) ? 1 : 0;
    if (aIsMain !== bIsMain) return bIsMain - aIsMain;
    // Then by modification time (newest first)
    if (a.lastModified !== b.lastModified) return b.lastModified - a.lastModified;
    return b.size - a.size;
  });

  return files;
}

async function rootReadDir(dirPath: string): Promise<Array<{name: string; path: string; size: number; isDirectory: boolean}>> {
  try {
    const items = await StorageModule.rootListFiles(dirPath);
    return items.map((item: any) => ({
      name: item.name,
      path: item.path,
      size: item.size || 0,
      isDirectory: item.isDirectory,
    }));
  } catch {
    return [];
  }
}

export async function rootCopyToReadable(sourcePath: string): Promise<string> {
  const fileName = sourcePath.split('/').pop() || 'backup.crypt15';
  const destPath = `${RNFS.CachesDirectoryPath}/${fileName}`;
  await StorageModule.rootCopyFile(sourcePath, destPath);
  return destPath;
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
