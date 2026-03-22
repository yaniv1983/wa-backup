# WA Backup

An Android app that automatically backs up WhatsApp (Business & Personal) encrypted database files to Google Drive with scheduled backups, progress notifications, and retention management.

## Features

- **Manual & Automatic Backup** - Back up on demand or schedule daily/weekly at a specific time
- **Google Drive Integration** - Uploads to a dedicated Drive folder with chunked, resumable uploads
- **WhatsApp Business & Personal** - Supports both variants (or both simultaneously)
- **Exact-Time Scheduling** - Uses Android AlarmManager for reliable daily backups, survives reboots
- **Progress Notifications** - Real-time upload progress bar in the notification shade
- **Backup Retention** - Automatically deletes old backups in Drive (configurable count)
- **WiFi-Only Mode** - Option to only back up when connected to WiFi
- **Root Mode** - Optional root access for direct database file access
- **Retry with Backoff** - Failed uploads retry up to 3 times with exponential backoff
- **Backup History** - View past backups with status, size, and timestamps

## Screenshots

| Home | History | Settings |
|------|---------|----------|
| Status overview, backup button, recent files | Past backup records with status | Schedule, retention, variant selection |

## Prerequisites

- Node.js 18+
- React Native CLI
- Android Studio with SDK 34
- JDK 17
- A Google Cloud project with the Google Drive API enabled

## Google Cloud Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Enable the **Google Drive API**
4. Go to **Credentials** > **Create Credentials** > **OAuth 2.0 Client ID**
5. Create a **Web application** client - copy the Client ID
6. Create an **Android** client:
   - Package name: `com.wabackup`
   - SHA-1: Get it by running:
     ```bash
     cd android && ./gradlew signingReport
     ```
7. Copy your Web Client ID into `.env`:
   ```
   WEB_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
   ```

## Installation

```bash
# Clone the repository
git clone https://github.com/your-username/wa-backup.git
cd wa-backup

# Install dependencies
npm install

# Set up your Google OAuth credentials
cp .env.example .env
# Edit .env with your WEB_CLIENT_ID

# Build and run on a connected device/emulator
npx react-native run-android
```

## Building a Release APK

```bash
cd android
./gradlew assembleRelease
```

The APK will be at `android/app/build/outputs/apk/release/app-release.apk`.

## Project Structure

```
src/
├── config.ts                    # Environment configuration
├── theme.ts                     # Colors, spacing, border radius
├── types/
│   └── index.ts                 # TypeScript interfaces & defaults
├── screens/
│   ├── HomeScreen.tsx           # Main screen - status, backup button, file list
│   ├── HistoryScreen.tsx        # Backup history with pull-to-refresh
│   └── SettingsScreen.tsx       # Schedule, storage, Drive, about settings
└── services/
    ├── alarmSchedulerService.ts # JS wrapper for native AlarmManager module
    ├── backgroundService.ts     # Start/stop background backup scheduling
    ├── backupManager.ts         # Core backup orchestration with retry logic
    ├── fileService.ts           # WhatsApp file discovery (business/personal)
    ├── googleDriveService.ts    # Google Sign-In, chunked upload, retention
    ├── headlessBackupTask.ts    # Headless JS task for background execution
    ├── networkService.ts        # WiFi connectivity checks
    ├── notificationService.ts   # Upload progress & status notifications
    └── permissionService.ts     # Android permission requests

android/.../java/com/wabackup/
├── MainActivity.kt
├── MainApplication.kt
├── AlarmSchedulerModule.kt      # Native AlarmManager exact scheduling
├── AlarmSchedulerPackage.kt     # React Native package registration
├── BackupAlarmReceiver.kt       # BroadcastReceiver for alarm events
├── BackupTaskService.kt         # HeadlessJsTaskService for background work
├── BootReceiver.kt              # Re-schedules alarms after device reboot
├── StorageModule.kt             # Native storage access (root/non-root)
└── StoragePackage.kt            # React Native package registration
```

## Permissions

| Permission | Purpose |
|------------|---------|
| `INTERNET` | Google Drive API communication |
| `READ_EXTERNAL_STORAGE` | Access WhatsApp backup files |
| `MANAGE_EXTERNAL_STORAGE` | Android 11+ scoped storage access |
| `POST_NOTIFICATIONS` | Upload progress & backup status (Android 13+) |
| `SCHEDULE_EXACT_ALARM` | Precise daily backup scheduling |
| `RECEIVE_BOOT_COMPLETED` | Reschedule alarms after reboot |
| `ACCESS_NETWORK_STATE` | WiFi-only backup check |
| `FOREGROUND_SERVICE` | Background backup execution |
| `WAKE_LOCK` | Keep device awake during backup |

## License

[MIT](LICENSE)
