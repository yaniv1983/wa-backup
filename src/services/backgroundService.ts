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
