import {performBackup} from './backupManager';

export default async function headlessBackupTask() {
  try {
    await performBackup();
  } catch (_error) {
    // Silently fail - will retry on next scheduled run
  }
}
