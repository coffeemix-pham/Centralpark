package expo.modules.medicationsync

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

object CredentialsStore {
  private const val PREF_NAME = "medsync_creds"
  private const val KEY_ID = "username"
  private const val KEY_PW = "password"
  private const val KEY_CLASS_ID = "class_id"
  private const val KEY_CLASS_NAME = "class_name"

  private fun prefs(ctx: Context) =
    EncryptedSharedPreferences.create(
      ctx, PREF_NAME,
      MasterKey.Builder(ctx).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(),
      EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
      EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )

  data class Creds(
    val username: String,
    val password: String,
    val classId: String?,
    val className: String?
  )

  fun save(ctx: Context, username: String, password: String, classId: String, className: String) {
    prefs(ctx).edit()
      .putString(KEY_ID, username)
      .putString(KEY_PW, password)
      .putString(KEY_CLASS_ID, classId)
      .putString(KEY_CLASS_NAME, className)
      .apply()
  }

  fun load(ctx: Context): Creds? {
    val p = prefs(ctx)
    val u = p.getString(KEY_ID, null) ?: return null
    val w = p.getString(KEY_PW, null) ?: return null
    return Creds(u, w, p.getString(KEY_CLASS_ID, null), p.getString(KEY_CLASS_NAME, null))
  }

  fun clear(ctx: Context) { prefs(ctx).edit().clear().apply() }
}
