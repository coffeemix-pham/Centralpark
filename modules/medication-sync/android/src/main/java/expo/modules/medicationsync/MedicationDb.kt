package expo.modules.medicationsync

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteDatabaseLockedException
import java.io.File

object MedicationDb {
  private const val DB_NAME = "centralpark.db"
  private const val MAX_RETRY = 5
  private const val RETRY_DELAY_MS = 100L

  /**
   * expo-sqlite 저장 경로 탐색 (SDK 버전 간 호환):
   *  1) ctx.getDatabasePath("centralpark.db")  — databases/ (최신 expo-sqlite)
   *  2) filesDir/SQLite/centralpark.db         — 레거시/폴백
   * 둘 다 없으면 1) 경로로 새로 생성 (databases/ 우선).
   */
  private fun dbPath(ctx: Context): File {
    val primary = ctx.getDatabasePath(DB_NAME)
    if (primary.exists()) return primary
    val legacy = File(File(ctx.filesDir, "SQLite").apply { if (!exists()) mkdirs() }, DB_NAME)
    if (legacy.exists()) return legacy
    // 최초 생성: databases/ 디렉토리 보장
    primary.parentFile?.mkdirs()
    return primary
  }

  private fun open(ctx: Context): SQLiteDatabase {
    val db = SQLiteDatabase.openOrCreateDatabase(dbPath(ctx), null)
    db.enableWriteAheadLogging()
    // PRAGMA setters that return a row must go through rawQuery —
    // execSQL rejects any statement producing a result set.
    db.rawQuery("PRAGMA synchronous=NORMAL", null).close()
    db.rawQuery("PRAGMA busy_timeout=2000", null).close()
    return db
  }

  private fun <T> withRetry(block: () -> T): T {
    var last: Exception? = null
    repeat(MAX_RETRY) { i ->
      try { return block() }
      catch (e: SQLiteDatabaseLockedException) { last = e; Thread.sleep(RETRY_DELAY_MS * (i + 1)) }
    }
    throw last ?: RuntimeException("db_retry_exhausted")
  }

  data class UpsertResult(val id: String, val wasManualEdited: Boolean, val parsedTime: String?, val status: String)

  /**
   * classFilter를 통과한 row만 upsert. is_manual_edited=1이면 parsed_time 보존.
   * keywordMatch는 KeywordRuleParser에서 주입.
   */
  fun upsertMedication(
    ctx: Context,
    id: String, childName: String,
    classId: Int?, className: String?,
    dateMedicated: String, medicineType: String, dosage: String,
    originalTime: String, symptoms: String?, storageMethod: String?,
    specialNote: String,
    resolveParsedTime: (String) -> String?
  ): UpsertResult = withRetry {
    val db = open(ctx)
    db.use {
      val cur = it.rawQuery(
        "SELECT parsed_time, is_manual_edited, status FROM medications WHERE id=?",
        arrayOf(id)
      )
      var existingParsed: String? = null
      var manual = false
      var status = "pending"
      if (cur.moveToFirst()) {
        existingParsed = cur.getString(0)
        manual = cur.getInt(1) == 1
        status = cur.getString(2) ?: "pending"
      }
      cur.close()

      val parsedTime = if (manual) existingParsed else resolveParsedTime(originalTime)
      val now = System.currentTimeMillis()
      val cv = ContentValues().apply {
        put("id", id)
        put("child_name", childName)
        put("class_id", classId)
        put("class_name", className)
        put("date_medicated", dateMedicated)
        put("medicine_type", medicineType)
        put("dosage", dosage)
        put("original_time", originalTime)
        put("parsed_time", parsedTime)
        put("is_manual_edited", if (manual) 1 else 0)
        put("symptoms", symptoms)
        put("storage_method", storageMethod)
        put("special_note", specialNote)
        put("status", status)
        put("alarm_scheduled", 0)
        put("created_at", now)
        put("updated_at", now)
      }
      it.insertWithOnConflict("medications", null, cv, SQLiteDatabase.CONFLICT_REPLACE)
      UpsertResult(id, manual, parsedTime, status)
    }
  }

  fun updateParsedTimeManual(ctx: Context, id: String, newHhmm: String) = withRetry {
    val db = open(ctx)
    db.use {
      val cv = ContentValues().apply {
        put("parsed_time", newHhmm)
        put("is_manual_edited", 1)
        put("updated_at", System.currentTimeMillis())
      }
      it.update("medications", cv, "id=?", arrayOf(id))
    }
  }

  fun markDone(ctx: Context, id: String) = withRetry {
    val db = open(ctx)
    db.use {
      val cv = ContentValues().apply {
        put("status", "done")
        put("done_at", System.currentTimeMillis())
        put("updated_at", System.currentTimeMillis())
      }
      it.update("medications", cv, "id=?", arrayOf(id))
    }
  }

  fun getById(ctx: Context, id: String): Map<String, Any?>? = withRetry {
    val db = open(ctx)
    db.use {
      val c = it.rawQuery("SELECT * FROM medications WHERE id=?", arrayOf(id))
      if (!c.moveToFirst()) { c.close(); return@use null }
      val m = mutableMapOf<String, Any?>()
      for (i in 0 until c.columnCount) m[c.getColumnName(i)] = c.getString(i)
      c.close()
      m
    }
  }

  fun loadKeywordRules(ctx: Context): List<Pair<String, String>> = withRetry {
    val db = open(ctx)
    db.use {
      val out = mutableListOf<Pair<String, String>>()
      val c = it.rawQuery(
        "SELECT keyword, time_hhmm FROM keyword_rules ORDER BY priority DESC, length(keyword) DESC",
        null
      )
      while (c.moveToNext()) out.add(c.getString(0) to c.getString(1))
      c.close()
      out
    }
  }
}
