package expo.modules.medicationsync

import android.content.Context
import com.facebook.react.ReactApplication
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.modules.core.DeviceEventManagerModule

object MedicationSyncEventBus {
  /**
   * React 인스턴스가 생성되어 있고 컨텍스트가 살아있을 때만 DeviceEventEmitter로 emit.
   * 앱이 Killed/Background no-context 상태면 silent no-op.
   */
  fun emitIfActive(ctx: Context, eventName: String, payload: Map<String, Any?>) {
    val app = ctx.applicationContext as? ReactApplication ?: return
    val host = app.reactNativeHost
    // hasInstance: ReactInstanceManager가 초기화되어 있는가
    if (!host.hasInstance()) return
    val rim = host.reactInstanceManager
    val reactContext: ReactContext = rim.currentReactContext ?: return
    if (!reactContext.hasActiveReactInstance()) return
    val writable = Arguments.createMap().apply {
      payload.forEach { (k, v) ->
        when (v) {
          is String -> putString(k, v)
          is Int -> putInt(k, v)
          is Double -> putDouble(k, v)
          is Boolean -> putBoolean(k, v)
          null -> putNull(k)
          else -> putString(k, v.toString())
        }
      }
    }
    reactContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit(eventName, writable)
  }
}
