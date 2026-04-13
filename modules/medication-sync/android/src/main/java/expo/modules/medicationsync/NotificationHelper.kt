package expo.modules.medicationsync

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat

object NotificationHelper {
  private const val CHANNEL_ID = "medication_alerts_v1"
  private const val CHANNEL_NAME = "투약 알림"
  private const val CHANNEL_DESC = "학부모 투약의뢰서 알림"

  fun ensureChannel(ctx: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val ch = NotificationChannel(CHANNEL_ID, CHANNEL_NAME, NotificationManager.IMPORTANCE_HIGH).apply {
      description = CHANNEL_DESC
      enableVibration(true)
      enableLights(true)
      setShowBadge(true)
    }
    (ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).createNotificationChannel(ch)
  }

  fun show(
    ctx: Context, id: String, child: String, medType: String,
    dose: String, timeRaw: String, note: String
  ) {
    ensureChannel(ctx)

    // [투약 완료] 액션 → ActionReceiver
    val doneIntent = Intent(ctx, ActionReceiver::class.java).apply {
      action = "com.centralpark.daycare.medication.ACTION_DONE"
      putExtra("med_id", id)
      setPackage(ctx.packageName)  // 암묵적 브로드캐스트 차단 방어
    }
    val donePI = PendingIntent.getBroadcast(
      ctx, id.hashCode() + 1, doneIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    val title = "[투약 확인] $child 어린이"
    val body = buildString {
      append(medType); append(' ')
      append(dose); append(" - ")
      append(timeRaw)
      if (note.isNotBlank()) { append(" ("); append(note); append(')') }
    }

    // 앱 아이콘 리소스는 호스트 앱(com.centralpark.daycare)의 R 사용
    val smallIcon = ctx.applicationInfo.icon
      .takeIf { it != 0 }
      ?: android.R.drawable.ic_popup_reminder

    val action = NotificationCompat.Action.Builder(
      android.R.drawable.ic_menu_send, "투약 완료", donePI
    ).setAllowGeneratedReplies(false).build()

    val wearable = NotificationCompat.WearableExtender()
      .addAction(action)

    val notif = NotificationCompat.Builder(ctx, CHANNEL_ID)
      .setSmallIcon(smallIcon)
      .setContentTitle(title)
      .setContentText(body)
      .setStyle(NotificationCompat.BigTextStyle().bigText(body))
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setCategory(NotificationCompat.CATEGORY_REMINDER)
      .addAction(action)
      .extend(wearable)
      .setAutoCancel(true)
      .setOnlyAlertOnce(false)
      .build()

    NotificationManagerCompat.from(ctx).notify(id.hashCode(), notif)
  }
}
