package expo.modules.medicationsync

import android.content.Intent
import android.net.Uri
import android.provider.Settings
import androidx.work.*
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.concurrent.TimeUnit

class MedicationSyncModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("MedicationSync")
    Events("onMedicationDone", "onSyncCompleted")

    AsyncFunction("setCredentials") { username: String, password: String, classId: String, className: String ->
      CredentialsStore.save(appContext.reactContext!!, username, password, classId, className)
    }

    AsyncFunction("clearCredentials") {
      CredentialsStore.clear(appContext.reactContext!!)
    }

    AsyncFunction("scheduleBackgroundSync") {
      val ctx = appContext.reactContext!!
      val req = PeriodicWorkRequestBuilder<MedicationSyncWorker>(30, TimeUnit.MINUTES)
        .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
        .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 10, TimeUnit.MINUTES)
        .build()
      WorkManager.getInstance(ctx).enqueueUniquePeriodicWork(
        "medication_sync", ExistingPeriodicWorkPolicy.UPDATE, req
      )
      true
    }

    AsyncFunction("cancelBackgroundSync") {
      WorkManager.getInstance(appContext.reactContext!!).cancelUniqueWork("medication_sync")
      true
    }

    AsyncFunction("runSyncNow") {
      val req = OneTimeWorkRequestBuilder<MedicationSyncWorker>().build()
      WorkManager.getInstance(appContext.reactContext!!).enqueue(req)
      true
    }

    AsyncFunction("scheduleAlarm") { params: Map<String, Any?> ->
      AlarmScheduler.schedule(appContext.reactContext!!, params)
    }

    AsyncFunction("cancelAlarm") { id: String ->
      AlarmScheduler.cancel(appContext.reactContext!!, id)
    }

    AsyncFunction("updateParsedTime") { id: String, newHhmm: String ->
      val ctx = appContext.reactContext!!
      MedicationDb.updateParsedTimeManual(ctx, id, newHhmm)
      val row = MedicationDb.getById(ctx, id) ?: return@AsyncFunction
      AlarmScheduler.cancel(ctx, id)
      val ts = KeywordRuleParser.hhmmToEpoch(row["date_medicated"] as String, newHhmm)
      if (ts != null && ts > System.currentTimeMillis()) {
        AlarmScheduler.schedule(ctx, mapOf(
          "id" to id,
          "triggerAtMillis" to ts.toDouble(),
          "childName" to row["child_name"],
          "medicineType" to row["medicine_type"],
          "dosage" to row["dosage"],
          "medicationTime" to row["original_time"],
          "specialNote" to (row["special_note"] ?: "")
        ))
      }
    }

    AsyncFunction("canScheduleExactAlarms") {
      AlarmScheduler.canScheduleExact(appContext.reactContext!!)
    }

    AsyncFunction("openExactAlarmSettings") {
      val ctx = appContext.reactContext!!
      val i = Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM).apply {
        data = Uri.parse("package:${ctx.packageName}")
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      ctx.startActivity(i)
    }
  }
}
