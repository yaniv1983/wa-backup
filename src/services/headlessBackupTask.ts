import {performBackup, getSettings} from './backupManager';
import {configureGoogleSignIn} from './googleDriveService';

export default async function headlessBackupTask() {
  try {
    const settings = await getSettings();
    configureGoogleSignIn(settings.customWebClientId);
    await performBackup();
  } catch (_error) {
    // Silently fail - will retry on next scheduled run
  }
}
