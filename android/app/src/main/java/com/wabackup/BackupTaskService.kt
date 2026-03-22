package com.wabackup

import android.content.Intent
import android.os.Bundle
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

class BackupTaskService : HeadlessJsTaskService() {
    override fun getTaskConfig(intent: Intent): HeadlessJsTaskConfig? {
        val extras = intent.extras
        return HeadlessJsTaskConfig(
            "BackupHeadlessTask",
            extras?.let { Arguments.fromBundle(it) } ?: Arguments.createMap(),
            1800000, // 30 minute timeout
            true // allow in foreground
        )
    }
}
