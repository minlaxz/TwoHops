package com.nativetrusttunnel

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.VpnService as AndroidVpnService
import android.os.Handler
import android.os.Looper
import android.util.Log
import com.adguard.trusttunnel.AppNotifier
import com.adguard.trusttunnel.Logger
import com.adguard.trusttunnel.VpnService
import com.adguard.trusttunnel.log.NativeLogger
import com.adguard.trusttunnel.log.NativeLoggerLevel
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.facebook.react.module.annotations.ReactModule
import java.io.File
import java.time.Instant
import org.json.JSONObject

private const val REQUEST_VPN_PERMISSION = 1001
private const val EVENT_STATE = "vpn_state"
private const val EVENT_QUERY_LOG = "vpn_query_log"
private const val EVENT_CORE_LOG = "vpn_core_log"

// Core Logging (issue #136): the gate lives here so the core's chatter never
// crosses the bridge while OFF. Set from JS via setCoreLogging.
private object CoreLogging {
    @Volatile var enabled: Boolean = false
}

private fun coreLevel(level: String): NativeLoggerLevel = when (level.lowercase()) {
    "error" -> NativeLoggerLevel.ERROR
    "warn" -> NativeLoggerLevel.WARN
    "debug" -> NativeLoggerLevel.DEBUG
    "trace" -> NativeLoggerLevel.TRACE
    else -> NativeLoggerLevel.INFO
}

@ReactModule(name = NativeTrustTunnelModule.NAME)
class NativeTrustTunnelModule(reactContext: ReactApplicationContext) : NativeTrustTunnelSpec(reactContext) {
    private val vpnImpl = NativeVpnImpl(reactContext)
    private var pendingConfig: String? = null

    private val activityEventListener = object : BaseActivityEventListener() {
        override fun onActivityResult(
            activity: Activity,
            requestCode: Int,
            resultCode: Int,
            data: Intent?
        ) {
            if (requestCode == REQUEST_VPN_PERMISSION) {
                val config = pendingConfig
                pendingConfig = null
                if (config != null && resultCode == Activity.RESULT_OK) {
                    val ctx = activity ?: reactContext
                    vpnImpl.startPrepared(ctx, config)
                }
            }
        }
    }

    init {
        reactContext.addActivityEventListener(activityEventListener)
        // The AAR keeps one callback; re-registering on reload replaces it.
        // Fires on core threads: keep it cheap, hand off to the main looper.
        Logger.setCallback(object : Logger.Callback {
            override fun log(level: Logger.LogLevel, message: String) {
                if (!CoreLogging.enabled) {
                    return
                }
                val payload = JSONObject()
                    .put("level", level.name.lowercase())
                    .put("message", message)
                    .put("date", Instant.now().toString())
                    .toString()
                vpnImpl.emitEvent(EVENT_CORE_LOG, payload)
            }
        })
    }

    override fun start(serverName: String, config: String, promise: Promise) {
        val activity = currentActivity
        if (activity != null) {
            val prepare = AndroidVpnService.prepare(activity)
            if (prepare == null) {
                vpnImpl.startPrepared(activity, config)
            } else {
                pendingConfig = config
                activity.startActivityForResult(prepare, REQUEST_VPN_PERMISSION)
            }
        } else {
            val prepare = AndroidVpnService.prepare(reactApplicationContext)
            if (prepare == null) {
                vpnImpl.startPrepared(reactApplicationContext, config)
            } else {
                Log.w(NAME, "VPN permission required but no activity is available.")
            }
        }
        promise.resolve(null)
    }

    override fun stop(promise: Promise) {
        vpnImpl.stop()
        promise.resolve(null)
    }

    override fun updateConfiguration(serverName: String?, config: String?, promise: Promise) {
        // No-op on Android
        promise.resolve(null)
    }

    override fun getCurrentState(promise: Promise) {
        promise.resolve(vpnImpl.getCurrentState())
    }

    override fun setCoreLogging(enabled: Boolean, level: String, promise: Promise) {
        // OFF restores the library default (INFO, VpnClient.kt) for the file log.
        NativeLogger.defaultLogLevel = if (enabled) coreLevel(level) else NativeLoggerLevel.INFO
        CoreLogging.enabled = enabled
        promise.resolve(null)
    }

    companion object {
        const val NAME = "NativeTrustTunnel"
    }

    private inner class NativeVpnImpl(
        private val appContext: ReactApplicationContext
    ) : AppNotifier {
        private val main = Handler(Looper.getMainLooper())
        private var currentState: Int = 0

        init {
            ensureNetworkManager(appContext)
            val queryLogFile = File(appContext.filesDir, "query_log.dat")
            VpnService.setAppNotifier(queryLogFile, this)
        }

        fun startPrepared(ctx: Context, config: String) {
            Log.i(NAME, "startPrepared()")
            VpnService.start(ctx, config)
        }

        fun stop() {
            Log.i(NAME, "stop()")
            VpnService.stop(appContext)
        }

        fun getCurrentState(): Int = currentState

        override fun onStateChanged(state: Int) {
            Log.i(NAME, "onStateChanged($state)")
            currentState = state
            emitEvent(EVENT_STATE, state)
        }

        override fun onConnectionInfo(info: String) {
            emitEvent(EVENT_QUERY_LOG, info)
        }

        fun emitEvent(name: String, payload: Any) {
            if (Looper.myLooper() == Looper.getMainLooper()) {
                sendEvent(name, payload)
            } else {
                main.post { sendEvent(name, payload) }
            }
        }

        private fun sendEvent(name: String, payload: Any) {
            appContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(name, payload)
        }
    }
}

private fun ensureNetworkManager(context: Context) {
    if (NetworkManagerState.started) {
        return
    }
    NetworkManagerState.started = true
    VpnService.startNetworkManager(context)
}

private object NetworkManagerState {
    var started: Boolean = false
}
