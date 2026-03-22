import notifee, {AndroidImportance, AndroidCategory} from '@notifee/react-native';

const PROGRESS_CHANNEL = 'wa-backup-progress';
const STATUS_CHANNEL = 'wa-backup-status';
const PROGRESS_NOTIFICATION_ID = 'backup-progress';

let channelsCreated = false;

async function ensureChannels() {
  if (channelsCreated) return;
  await notifee.createChannel({
    id: PROGRESS_CHANNEL,
    name: 'Backup Progress',
    importance: AndroidImportance.LOW,
  });
  await notifee.createChannel({
    id: STATUS_CHANNEL,
    name: 'Backup Status',
    importance: AndroidImportance.HIGH,
  });
  channelsCreated = true;
}

export async function showUploadProgress(
  fileName: string,
  bytesUploaded: number,
  totalBytes: number,
) {
  await ensureChannels();
  const percentage = Math.round((bytesUploaded / totalBytes) * 100);
  const uploadedMB = (bytesUploaded / (1024 * 1024)).toFixed(1);
  const totalMB = (totalBytes / (1024 * 1024)).toFixed(1);

  await notifee.displayNotification({
    id: PROGRESS_NOTIFICATION_ID,
    title: 'Uploading backup',
    body: `${fileName} - ${percentage}% (${uploadedMB} / ${totalMB} MB)`,
    android: {
      channelId: PROGRESS_CHANNEL,
      category: AndroidCategory.PROGRESS,
      ongoing: true,
      onlyAlertOnce: true,
      progress: {
        max: totalBytes,
        current: bytesUploaded,
      },
      smallIcon: 'ic_launcher',
      asForegroundService: true,
    },
  });
}

export async function showBackupComplete(success: boolean, message?: string) {
  await ensureChannels();
  // Cancel progress notification
  await notifee.cancelNotification(PROGRESS_NOTIFICATION_ID);

  await notifee.displayNotification({
    title: success ? 'Backup Complete' : 'Backup Failed',
    body: success
      ? message || 'WhatsApp backup uploaded to Google Drive'
      : message || 'Failed to upload backup',
    android: {
      channelId: STATUS_CHANNEL,
      smallIcon: 'ic_launcher',
      autoCancel: true,
      timeoutAfter: 10000,
    },
  });
}

export async function cancelNotification() {
  await notifee.cancelNotification(PROGRESS_NOTIFICATION_ID);
}
