# Privacy Policy

**WA Backup** — Last updated: March 23, 2026

## Overview

WA Backup is an open-source Android application that backs up WhatsApp database files from your device to your personal Google Drive account. Your privacy is important to us.

## Data Collection

**WA Backup does not collect, store, or transmit any personal data to the developer or any third party.**

The app operates entirely on your device and your personal Google Drive account. There are no analytics, tracking, telemetry, or advertising services.

## Data Access

The app accesses the following data on your device:

- **WhatsApp backup files** — The app reads encrypted WhatsApp database files (`.crypt14`, `.crypt15`) from your device storage for the sole purpose of uploading them to your Google Drive.
- **Google Account** — The app uses Google Sign-In to authenticate with your Google Drive. The app only requests access to Google Drive file storage (`drive` scope). It cannot read your email, contacts, or any other Google data.
- **Network status** — The app checks WiFi connectivity to support the "WiFi-only backup" feature.

## Data Storage

- **Backup files** are uploaded to a folder in **your personal Google Drive account**. The developer has no access to your Drive or your files.
- **App settings** (backup schedule, preferences) are stored locally on your device using AsyncStorage. They are never transmitted.
- **Backup history** (file names, timestamps, status) is stored locally on your device. It is never transmitted.

## Third-Party Services

The app uses Google Sign-In and Google Drive API to authenticate and upload files. Google's privacy policy applies to these services: https://policies.google.com/privacy

No other third-party services are used.

## Permissions

| Permission | Why It's Needed |
|------------|----------------|
| Storage access | Read WhatsApp backup files from your device |
| Internet | Upload backups to Google Drive |
| Notifications | Show upload progress and backup status |
| Background scheduling | Run automatic backups at scheduled times |
| Boot completed | Reschedule backups after device restart |

## Data Deletion

You can delete your data at any time:
- **Local data**: Clear the app's data in Android Settings, or uninstall the app
- **Drive backups**: Delete the backup folder from your Google Drive
- **Google access**: Revoke the app's access at https://myaccount.google.com/permissions

## Open Source

WA Backup is open source under the MIT license. You can inspect the full source code at https://github.com/yaniv1983/wa-backup to verify these privacy claims.

## Contact

If you have questions about this privacy policy, please open an issue at https://github.com/yaniv1983/wa-backup/issues.
