package expo.modules.medicationsync

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class AlarmReceiver : BroadcastReceiver() {
  override fun onReceive(ctx: Context, intent: Intent) {
    val id = intent.getStringExtra("med_id") ?: return
    val child = intent.getStringExtra("med_child") ?: ""
    val type = intent.getStringExtra("med_type") ?: ""
    val dose = intent.getStringExtra("med_dose") ?: ""
    val timeRaw = intent.getStringExtra("med_time_raw") ?: ""
    val note = intent.getStringExtra("med_note") ?: ""
    NotificationHelper.show(ctx, id, child, type, dose, timeRaw, note)
  }
}
