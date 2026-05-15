package com.vms.temi

import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.View
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.robotemi.sdk.Robot
import com.robotemi.sdk.listeners.OnDetectionStateChangedListener
import com.robotemi.sdk.listeners.OnRobotReadyListener
import com.vms.temi.api.VMSApiClient
import com.vms.temi.socket.TemiSocketManager
import com.vms.temi.temi.TemiManager
import com.vms.temi.ui.FaceState
import com.vms.temi.ui.QRScanActivity
import com.vms.temi.ui.TemiFaceView
import kotlinx.coroutines.launch
import java.util.Timer
import java.util.TimerTask

class MainActivity : AppCompatActivity(),
    OnRobotReadyListener,
    OnDetectionStateChangedListener {

    private val TAG = "TemiVMS_Main"
    private lateinit var robot: Robot
    private lateinit var tvStatus: TextView
    private lateinit var tvBattery: TextView
    private lateinit var temiFace: TemiFaceView
    private var heartbeatTimer: Timer? = null
    private var isReadyForScan = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        tvStatus  = findViewById(R.id.tvStatus)
        tvBattery = findViewById(R.id.tvBattery)
        temiFace  = findViewById(R.id.temiFace)

        robot = Robot.getInstance()

        findViewById<View>(R.id.btnScanQR).setOnClickListener { launchQRScan() }
    }

    override fun onStart() {
        super.onStart()
        robot.addOnRobotReadyListener(this)
        robot.addOnDetectionStateChangedListener(this)
        TemiManager.hideTopBar()
        startHeartbeat()
        TemiSocketManager.connect(this)
    }

    override fun onStop() {
        super.onStop()
        robot.removeOnRobotReadyListener(this)
        robot.removeOnDetectionStateChangedListener(this)
        heartbeatTimer?.cancel()
    }

    override fun onDestroy() {
        super.onDestroy()
        TemiSocketManager.disconnect()
    }

    override fun onRobotReady(isReady: Boolean) {
        if (!isReady) return
        Log.d(TAG, "Robot ready. Serial: ${BuildConfig.TEMI_SERIAL}")
        isReadyForScan = true
        TemiManager.setVolume(8)
        runOnUiThread {
            temiFace.faceState = FaceState.IDLE
            updateStatus("Ready — Scan your QR code")
        }

        Handler(Looper.getMainLooper()).postDelayed({
            TemiManager.speakWelcome()
            TemiManager.startDetection()
        }, 1000)

        lifecycleScope.launch {
            try {
                val locations = robot.locations
                if (locations.isNotEmpty()) {
                    VMSApiClient.syncLocations(BuildConfig.TEMI_SERIAL, locations)
                    Log.d(TAG, "Synced ${locations.size} locations: $locations")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to sync locations: ${e.message}")
            }
        }
    }

    override fun onDetectionStateChanged(state: Int) {
        when (state) {
            OnDetectionStateChangedListener.DETECTED -> {
                if (!isReadyForScan) return
                Log.d(TAG, "Person detected")
                isReadyForScan = false
                runOnUiThread {
                    temiFace.faceState = FaceState.GREETING
                    updateStatus("Visitor detected — Please scan QR code")
                }
                Handler(Looper.getMainLooper()).postDelayed({
                    TemiManager.speakScanPrompt()
                    Handler(Looper.getMainLooper()).postDelayed({ launchQRScan() }, 3000)
                }, 500)
            }
            OnDetectionStateChangedListener.LOST -> {
                Log.d(TAG, "Person lost")
                if (!isReadyForScan) {
                    Handler(Looper.getMainLooper()).postDelayed({
                        isReadyForScan = true
                        runOnUiThread {
                            temiFace.faceState = FaceState.IDLE
                            updateStatus("Ready — Scan your QR code")
                        }
                    }, 5000)
                }
            }
        }
    }

    private fun launchQRScan() {
        startActivityForResult(Intent(this, QRScanActivity::class.java), REQUEST_QR_SCAN)
        updateStatus("Scanning QR code…")
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == REQUEST_QR_SCAN) {
            Handler(Looper.getMainLooper()).postDelayed({
                isReadyForScan = true
                runOnUiThread {
                    temiFace.faceState = FaceState.IDLE
                    updateStatus("Ready — Scan your QR code")
                }
                TemiManager.startDetection()
            }, 10_000)
        }
    }

    private fun startHeartbeat() {
        heartbeatTimer = Timer()
        heartbeatTimer?.scheduleAtFixedRate(object : TimerTask() {
            override fun run() {
                lifecycleScope.launch {
                    VMSApiClient.sendHeartbeat(
                        serial = BuildConfig.TEMI_SERIAL,
                        status = "online",
                        task   = if (isReadyForScan) "waiting" else "scanning"
                    )
                    val battery = TemiManager.getBatteryLevel()
                    runOnUiThread {
                        if (battery >= 0) tvBattery.text = "Battery: $battery%"
                    }
                }
            }
        }, 0, HEARTBEAT_INTERVAL_MS)
    }

    private fun updateStatus(msg: String) = runOnUiThread { tvStatus.text = msg }

    companion object {
        private const val REQUEST_QR_SCAN       = 100
        private const val HEARTBEAT_INTERVAL_MS = 30_000L
    }
}
