package expo.modules.medicationsync

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import java.security.MessageDigest
import java.text.SimpleDateFormat
import java.util.*

class MedicationSyncWorker(ctx: Context, params: WorkerParameters)
  : CoroutineWorker(ctx, params) {

  override suspend fun doWork(): Result {
    return try {
      val creds = CredentialsStore.load(applicationContext) ?: return Result.success()
      val targetClassId = creds.classId?.toIntOrNull()
      val targetClassName = creds.className

      val items = GasClient.fetchMedications(creds.username, creds.password)
      val rules = MedicationDb.loadKeywordRules(applicationContext)
      val today = SimpleDateFormat("yyyy-MM-dd", Locale.KOREA).format(Date())

      var kept = 0; var skipped = 0

      for (med in items) {
        // ───── 담당 반 필터 (유연한 비교) ─────
        val belongs = when {
          // 1. 전체 반 처리
          targetClassName == "전체 반" || targetClassName == "ALL" || targetClassName.isNullOrBlank() -> true
          
          // 2. ID 가 일치하는 경우
          targetClassId != null && med.belong_to_class != null && med.belong_to_class == targetClassId -> true
          
          // 3. 이름 유연한 비교 (예: "맑은반" == "맑은")
          !targetClassName.isNullOrBlank() && !med.class_name.isNullOrBlank() -> {
            val cleanTarget = targetClassName.replace("반", "").replace(" ", "")
            val cleanMed = med.class_name.replace("반", "").replace(" ", "")
            cleanMed.contains(cleanTarget) || cleanTarget.contains(cleanMed)
          }
          
          else -> false
        }
        if (!belongs) { skipped++; continue }
        kept++

        med.items.forEachIndexed { idx, item ->
          val id = sha1("${med.child_name}|${med.date_medicated}|${item.medicine_type}|$idx").substring(0, 16)
          val result = MedicationDb.upsertMedication(
            applicationContext,
            id = id,
            childName = med.child_name,
            classId = med.belong_to_class,
            className = med.class_name,
            dateMedicated = med.date_medicated,
            medicineType = item.medicine_type,
            dosage = item.dosage,
            originalTime = item.medication_time,
            symptoms = item.symptoms,
            storageMethod = item.storage_method,
            specialNote = item.special_note ?: "",
            resolveParsedTime = { original -> KeywordRuleParser.resolve(original, rules) }
          )

          // ───── 알람 예약 (오늘치 + parsed_time 있음 + 아직 미완료) ─────
          if (med.date_medicated == today && !result.parsedTime.isNullOrBlank() && result.status != "done") {
            val ts = KeywordRuleParser.hhmmToEpoch(med.date_medicated, result.parsedTime)
            if (ts != null && ts > System.currentTimeMillis()) {
              AlarmScheduler.schedule(
                applicationContext, mapOf(
                  "id" to id,
                  "triggerAtMillis" to ts.toDouble(),
                  "childName" to med.child_name,
                  "medicineType" to item.medicine_type,
                  "dosage" to item.dosage,
                  "medicationTime" to item.medication_time,
                  "specialNote" to (item.special_note ?: "")
                )
              )
            }
          }
          // parsed_time == null 이면 알람 미예약. DB pending 상태로 체크리스트 UI에만 표출.
        }
      }
      Result.success()
    } catch (e: Exception) {
      Result.retry()
    }
  }

  private fun sha1(s: String): String =
    MessageDigest.getInstance("SHA-1").digest(s.toByteArray())
      .joinToString("") { "%02x".format(it) }
}
