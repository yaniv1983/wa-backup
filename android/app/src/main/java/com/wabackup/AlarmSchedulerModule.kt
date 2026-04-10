package com.wabackup

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import com.facebook.react.bridge.*
import java.util.Calendar

class AlarmSchedulerModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "AlarmScheduler"

    private val prefs by lazy {
        reactApplicationContext.getSharedPreferences("wa_backup_alarm", Context.MODE_PRIVATE)
    }

    @ReactMethod
    fun scheduleDaily(hour: Int, minute: Int, promise: Promise) {
        try {
            val calendar = Calendar.getInstance().apply {
                set(Calendar.HOUR_OF_DAY, hour)
                set(Calendar.MINUTE, minute)
                set(Calendar.SECOND, 0)
                set(Calendar.MILLISECOND, 0)
                // If time already passed today, schedule for tomorrow
                if (timeInMillis <= System.currentTimeMillis()) {
                    add(Calendar.DAY_OF_YEAR, 1)
                }
            }

            scheduleAlarmAt(reactApplicationContext, calendar.timeInMillis)

            // Save for rescheduling after reboot
            prefs.edit()
                .putInt("hour", hour)
                .putInt("minute", minute)
                .putBoolean("enabled", true)
                .apply()

            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ALARM_ERROR", "Failed to schedule alarm: ${e.message}")
        }
    }

    @ReactMethod
    fun cancel(promise: Promise) {
        try {
            val alarmManager = reactApplicationContext.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            val intent = Intent(reactApplicationContext, BackupAlarmReceiver::class.java)
            val pendingIntent = PendingIntent.getBroadcast(
                reactApplicationContext,
                1001,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            alarmManager.cancel(pendingIntent)

            prefs.edit().putBoolean("enabled", false).apply()

            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ALARM_ERROR", "Failed to cancel alarm: ${e.message}")
        }
    }

    @ReactMethod
    fun getScheduledTime(promise: Promise) {
        val enabled = prefs.getBoolean("enabled", false)
        if (!enabled) {
            promise.resolve(null)
            return
        }
        val map = Arguments.createMap()
        map.putInt("hour", prefs.getInt("hour", 3))
        map.putInt("minute", prefs.getInt("minute", 30))
        promise.resolve(map)
    }

    companion object {
        /**
         * Schedule alarm using setAlarmClock - this is exempt from ALL battery
         * restrictions including Doze, MIUI app standby, and OEM power saving.
         * It shows an alarm icon in the status bar which also signals to the OS
         * that this app has a legitimate reason to wake up.
         */
        fun scheduleAlarmAt(context: Context, triggerAtMillis: Long) {
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            val intent = Intent(context, BackupAlarmReceiver::class.java)
            val pendingIntent = PendingIntent.getBroadcast(
                context,
                1001,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            // setAlarmClock is the most reliable way to fire at an exact time.
            // It's exempt from Doze, app standby, and MIUI battery optimization.
            val showIntent = PendingIntent.getActivity(
                context,
                0,
                Intent(context, MainActivity::class.java),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            alarmManager.setAlarmClock(
                AlarmManager.AlarmClockInfo(triggerAtMillis, showIntent),
                pendingIntent
            )
        }
    }
}
