package com.wabackup

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

class BackupTaskService : HeadlessJsTaskService() {
    private var wakeLock: PowerManager.WakeLock? = null

    override fun onCreate() {
        super.onCreate()
        // Acquire a wake lock to prevent the CPU from sleeping during backup
        val pm = getSystemService(POWER_SERVICE) as PowerManager
        wakeLock = pm.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "WaBackup::BackupTaskWakeLock"
        ).apply {
            acquire(45 * 60 * 1000L) // 45 minute max
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // Start as a foreground service with a notification so Android doesn't kill us
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                "wa-backup-service",
                "Backup Service",
                NotificationManager.IMPORTANCE_LOW
            )
            val nm = getSystemService(NotificationManager::class.java)
            nm.createNotificationChannel(channel)

            val notification = Notification.Builder(this, "wa-backup-service")
                .setContentTitle("WA Backup")
                .setContentText("Uploading backup to Google Drive...")
                .setSmallIcon(android.R.drawable.ic_menu_upload)
                .build()

            startForeground(2001, notification)
        }

        return super.onStartCommand(intent, flags, startId)
    }

    override fun getTaskConfig(intent: Intent): HeadlessJsTaskConfig? {
        val extras = intent.extras
        return HeadlessJsTaskConfig(
            "BackupHeadlessTask",
            extras?.let { Arguments.fromBundle(it) } ?: Arguments.createMap(),
            1800000, // 30 minute timeout
            true // allow in foreground
        )
    }

    override fun onDestroy() {
        wakeLock?.let {
            if (it.isHeld) it.release()
        }
        super.onDestroy()
    }
}
