package com.wabackup

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.Settings
import com.facebook.react.bridge.*
import java.io.BufferedReader
import java.io.File
import java.io.InputStreamReader

class StorageModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "StorageModule"

    @ReactMethod
    fun isExternalStorageManager(promise: Promise) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            promise.resolve(Environment.isExternalStorageManager())
        } else {
            // Below Android 11, this permission concept doesn't exist
            promise.resolve(true)
        }
    }

    @ReactMethod
    fun requestManageStoragePermission(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                val intent = Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION).apply {
                    data = Uri.parse("package:${reactApplicationContext.packageName}")
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                reactApplicationContext.startActivity(intent)
                promise.resolve(true)
            } else {
                promise.resolve(true)
            }
        } catch (e: Exception) {
            // Fallback to general storage settings
            try {
                val intent = Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                reactApplicationContext.startActivity(intent)
                promise.resolve(true)
            } catch (e2: Exception) {
                promise.reject("ERROR", "Could not open storage settings: ${e2.message}")
            }
        }
    }

    @ReactMethod
    fun hasRootAccess(promise: Promise) {
        try {
            val process = Runtime.getRuntime().exec(arrayOf("su", "-c", "id"))
            val reader = BufferedReader(InputStreamReader(process.inputStream))
            val output = reader.readLine() ?: ""
            val exitCode = process.waitFor()
            promise.resolve(exitCode == 0 && output.contains("uid=0"))
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun rootListFiles(dirPath: String, promise: Promise) {
        try {
            val process = Runtime.getRuntime().exec(arrayOf("su", "-c", "ls -la '$dirPath'"))
            val reader = BufferedReader(InputStreamReader(process.inputStream))
            val lines = reader.readLines()
            val exitCode = process.waitFor()

            if (exitCode != 0) {
                val errReader = BufferedReader(InputStreamReader(process.errorStream))
                val err = errReader.readText()
                promise.reject("ROOT_ERROR", "ls failed: $err")
                return
            }

            val result = Arguments.createArray()
            for (line in lines) {
                // Parse ls -la output: permissions links owner group size date time name
                val parts = line.trim().split("\\s+".toRegex())
                if (parts.size < 7) continue
                if (parts[0].startsWith("total")) continue

                val name = parts.drop(7).joinToString(" ")
                if (name == "." || name == "..") continue

                val map = Arguments.createMap()
                map.putString("name", name)
                map.putString("path", "$dirPath/$name")
                map.putBoolean("isDirectory", parts[0].startsWith("d"))

                // Try to get size
                try {
                    map.putDouble("size", parts[4].toDouble())
                } catch (_: Exception) {
                    map.putDouble("size", 0.0)
                }

                result.pushMap(map)
            }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("ROOT_ERROR", "Failed to list files: ${e.message}")
        }
    }

    @ReactMethod
    fun rootCopyFile(sourcePath: String, destPath: String, promise: Promise) {
        try {
            // Ensure dest directory exists
            val destDir = File(destPath).parent
            if (destDir != null) {
                File(destDir).mkdirs()
            }

            val process = Runtime.getRuntime().exec(arrayOf("su", "-c", "cp '$sourcePath' '$destPath' && chmod 644 '$destPath'"))
            val exitCode = process.waitFor()

            if (exitCode == 0) {
                promise.resolve(destPath)
            } else {
                val errReader = BufferedReader(InputStreamReader(process.errorStream))
                val err = errReader.readText()
                promise.reject("ROOT_ERROR", "Copy failed: $err")
            }
        } catch (e: Exception) {
            promise.reject("ROOT_ERROR", "Failed to copy file: ${e.message}")
        }
    }

    @ReactMethod
    fun rootGetFileSize(filePath: String, promise: Promise) {
        try {
            val process = Runtime.getRuntime().exec(arrayOf("su", "-c", "stat -c '%s' '$filePath'"))
            val reader = BufferedReader(InputStreamReader(process.inputStream))
            val output = reader.readLine()?.trim() ?: "0"
            val exitCode = process.waitFor()

            if (exitCode == 0) {
                promise.resolve(output.toDouble())
            } else {
                promise.reject("ROOT_ERROR", "stat failed")
            }
        } catch (e: Exception) {
            promise.reject("ROOT_ERROR", "Failed to get file size: ${e.message}")
        }
    }
}
