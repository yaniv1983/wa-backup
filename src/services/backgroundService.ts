import {getSettings} from './backupManager';
import {scheduleBackup, cancelScheduledBackup} from './alarmSchedulerService';

export async function configureBackgroundBackup(): Promise<void> {
  const settings = await getSettings();
  const [hourStr, minuteStr] = settings.autoBackupTime.split(':');
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr, 10);
  await scheduleBackup(hour, minute);
}

export async function startBackgroundBackup(): Promise<void> {
  await configureBackgroundBackup();
}

export async function stopBackgroundBackup(): Promise<void> {
  await cancelScheduledBackup();
}

// Re-schedule alarm if auto backup is enabled.
// Call this on every app startup to ensure the alarm survives
// app updates, reinstalls, and MIUI battery optimization clearing alarms.
export async function ensureBackupScheduled(): Promise<void> {
  try {
    const settings = await getSettings();
    if (settings.autoBackupEnabled) {
      console.log('[WA-Backup] Auto backup enabled, ensuring alarm is scheduled');
      await configureBackgroundBackup();
    }
  } catch {
    // Silently fail - not critical for app startup
  }
}
