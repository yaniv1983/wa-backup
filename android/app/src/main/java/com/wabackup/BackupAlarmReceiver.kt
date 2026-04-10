package com.wabackup

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import java.util.Calendar

class BackupAlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        // Start the headless JS task
        val serviceIntent = Intent(context, BackupTaskService::class.java)
        val extras = Bundle()
        extras.putString("task", "backup")
        serviceIntent.putExtras(extras)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(serviceIntent)
        } else {
            context.startService(serviceIntent)
        }

        // Reschedule for tomorrow
        rescheduleAlarm(context)
    }

    companion object {
        fun rescheduleAlarm(context: Context) {
            val prefs = context.getSharedPreferences("wa_backup_alarm", Context.MODE_PRIVATE)
            val enabled = prefs.getBoolean("enabled", false)
            if (!enabled) return

            val hour = prefs.getInt("hour", 3)
            val minute = prefs.getInt("minute", 30)

            val calendar = Calendar.getInstance().apply {
                set(Calendar.HOUR_OF_DAY, hour)
                set(Calendar.MINUTE, minute)
                set(Calendar.SECOND, 0)
                set(Calendar.MILLISECOND, 0)
                add(Calendar.DAY_OF_YEAR, 1)
            }

            AlarmSchedulerModule.scheduleAlarmAt(context, calendar.timeInMillis)
        }
    }
}
