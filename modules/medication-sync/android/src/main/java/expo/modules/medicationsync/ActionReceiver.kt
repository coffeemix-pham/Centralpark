package expo.modules.medicationsync

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.core.app.NotificationManagerCompat

class ActionReceiver : BroadcastReceiver() {
  override fun onReceive(ctx: Context, intent: Intent) {
    val id = intent.getStringExtra("med_id") ?: return
    try {
      // 1) DB는 React Context와 무관하게 항상 업데이트
      MedicationDb.markDone(ctx, id)
      // 2) 알림 제거
      NotificationManagerCompat.from(ctx).cancel(id.hashCode())
    } catch (e: Exception) {
      Log.e("MedActionReceiver", "markDone failed id=$id", e)
    }

    // 3) JS 이벤트 송신 — React 인스턴스가 살아있을 때만
    try {
      MedicationSyncEventBus.emitIfActive(ctx, "onMedicationDone", mapOf("id" to id))
    } catch (e: Exception) {
      // 앱이 kill 상태 등 → 조용히 무시. 사용자는 다음 포그라운드 진입 시 DB로부터 done 상태를 읽음.
      Log.d("MedActionReceiver", "JS emit skipped: ${e.message}")
    }
  }
}
