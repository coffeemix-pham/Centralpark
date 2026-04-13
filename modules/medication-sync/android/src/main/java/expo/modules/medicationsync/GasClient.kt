package expo.modules.medicationsync

import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

object GasClient {
  // TODO: BuildConfig나 모듈 config로 추출 가능. 현재는 상수.
  private const val GAS_URL =
    "https://script.google.com/macros/s/AKfycbz_hmVyOXLV5PBVl9prvQxWLB-frMXTPA9pQgIg7uM_Tn2AojjYDRaC0tp5J4LcYmL3/exec"

  private val JSON = "application/json; charset=utf-8".toMediaType()
  private val client = OkHttpClient.Builder()
    .connectTimeout(15, TimeUnit.SECONDS)
    .readTimeout(30, TimeUnit.SECONDS)
    .build()

  data class MedItem(
    val medicine_type: String,
    val dosage: String,
    val medication_time: String,
    val symptoms: String?,
    val storage_method: String?,
    val special_note: String?
  )

  data class MedRecord(
    val child_name: String,
    val date_medicated: String,
    val belong_to_class: Int?,
    val class_name: String?,
    val items: List<MedItem>
  )

  fun fetchMedications(username: String, password: String): List<MedRecord> {
    val payload = JSONObject()
      .put("username", username)
      .put("password", password)
      .toString()
    val req = Request.Builder()
      .url(GAS_URL)
      .post(payload.toRequestBody(JSON))
      .build()
    client.newCall(req).execute().use { resp ->
      val text = resp.body?.string() ?: throw RuntimeException("empty_body")
      if (!resp.isSuccessful) throw RuntimeException("gas_http_${resp.code}:${text.take(200)}")
      val body = JSONObject(text)
      if (!body.optBoolean("ok", false)) {
        throw RuntimeException("gas_err:${body.optString("error")}:${body.optString("detail")}")
      }
      val arr: JSONArray = body.optJSONArray("results") ?: return emptyList()
      val out = ArrayList<MedRecord>(arr.length())
      for (i in 0 until arr.length()) {
        val r = arr.getJSONObject(i)
        val itemsArr = r.optJSONArray("items") ?: JSONArray()
        val items = ArrayList<MedItem>(itemsArr.length())
        for (j in 0 until itemsArr.length()) {
          val it = itemsArr.getJSONObject(j)
          items.add(
            MedItem(
              medicine_type = it.optString("medicine_type", ""),
              dosage = it.optString("dosage", ""),
              medication_time = it.optString("medication_time", ""),
              symptoms = it.optString("symptoms", null),
              storage_method = it.optString("storage_method", null),
              special_note = it.optString("special_note", null)
            )
          )
        }
        out.add(
          MedRecord(
            child_name = r.optString("child_name", ""),
            date_medicated = r.optString("date_medicated", ""),
            belong_to_class = if (r.isNull("belong_to_class")) null else r.optInt("belong_to_class"),
            class_name = if (r.isNull("class_name")) null else r.optString("class_name", null),
            items = items
          )
        )
      }
      return out
    }
  }
}
