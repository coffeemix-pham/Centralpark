package expo.modules.medicationsync

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log

object AlarmScheduler {
  private const val TAG = "MedAlarmScheduler"
  private const val EXTRA_ID = "med_id"
  private const val EXTRA_CHILD = "med_child"
  private const val EXTRA_TYPE = "med_type"
  private const val EXTRA_DOSE = "med_dose"
  private const val EXTRA_TIME_RAW = "med_time_raw"
  private const val EXTRA_NOTE = "med_note"
  private const val ACTION_FIRE = "com.centralpark.daycare.medication.ACTION_FIRE"

  fun canScheduleExact(ctx: Context): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true
    val am = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    return am.canScheduleExactAlarms()
  }

  fun schedule(ctx: Context, params: Map<String, Any?>) {
    val id = params["id"] as? String ?: return
    val triggerAt = when (val v = params["triggerAtMillis"]) {
      is Number -> v.toLong()
      is String -> v.toLongOrNull() ?: return
      else -> return
    }
    if (triggerAt <= System.currentTimeMillis()) return

    val intent = Intent(ctx, AlarmReceiver::class.java).apply {
      action = ACTION_FIRE
      putExtra(EXTRA_ID, id)
      putExtra(EXTRA_CHILD, params["childName"] as? String ?: "")
      putExtra(EXTRA_TYPE, params["medicineType"] as? String ?: "")
      putExtra(EXTRA_DOSE, params["dosage"] as? String ?: "")
      putExtra(EXTRA_TIME_RAW, params["medicationTime"] as? String ?: "")
      putExtra(EXTRA_NOTE, params["specialNote"] as? String ?: "")
    }
    val pi = PendingIntent.getBroadcast(
      ctx, id.hashCode(), intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
    val am = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !am.canScheduleExactAlarms()) {
      Log.w(TAG, "Exact alarm permission not granted — falling back to inexact")
      am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pi)
      return
    }
    am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pi)
    Log.i(TAG, "Alarm scheduled id=$id at=$triggerAt")
  }

  fun cancel(ctx: Context, id: String) {
    val intent = Intent(ctx, AlarmReceiver::class.java).apply { action = ACTION_FIRE }
    val pi = PendingIntent.getBroadcast(
      ctx, id.hashCode(), intent,
      PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
    ) ?: return
    val am = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    am.cancel(pi)
    pi.cancel()
    Log.i(TAG, "Alarm cancelled id=$id")
  }
}
