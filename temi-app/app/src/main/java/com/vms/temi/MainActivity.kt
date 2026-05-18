package com.vms.temi

import android.animation.ObjectAnimator
import android.animation.PropertyValuesHolder
import android.animation.ValueAnimator
import android.content.Intent
import android.graphics.Color
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.View
import android.widget.Button
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
import com.vms.temi.ui.WalkInActivity
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.Timer
import java.util.TimerTask

class MainActivity : AppCompatActivity(),
    OnRobotReadyListener,
    OnDetectionStateChangedListener {

    private val TAG = "TemiVMS_Main"
    private lateinit var robot: Robot
    private lateinit var tvStatus: TextView
    private lateinit var tvBattery: TextView
    private lateinit var tvClock: TextView
    private lateinit var tvDate: TextView
    private lateinit var tvVisitCount: TextView
    private lateinit var tvConnectionStatus: TextView
    private lateinit var vConnectionDot: View
    private lateinit var temiFace: TemiFaceView
    private val mainHandler = Handler(Looper.getMainLooper())
    private var heartbeatTimer: Timer? = null
    private var isReadyForScan = false

    private val clockFmt = SimpleDateFormat("hh:mm a", Locale.getDefault())
    private val dateFmt  = SimpleDateFormat("EEEE, dd MMM yyyy", Locale.getDefault())
    private val clockRunnable = object : Runnable {
        override fun run() {
            val now = Date()
            tvClock.text = clockFmt.format(now)
            tvDate.text  = dateFmt.format(now)
            mainHandler.postDelayed(this, 1000)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        tvStatus           = findViewById(R.id.tvStatus)
        tvBattery          = findViewById(R.id.tvBattery)
        tvClock            = findViewById(R.id.tvClock)
        tvDate             = findViewById(R.id.tvDate)
        tvVisitCount       = findViewById(R.id.tvVisitCount)
        tvConnectionStatus = findViewById(R.id.tvConnectionStatus)
        vConnectionDot     = findViewById(R.id.vConnectionDot)
        temiFace           = findViewById(R.id.temiFace)

        tvVisitCount.text = visitCount.toString()

        val btnScanQR = findViewById<Button>(R.id.btnScanQR)
        btnScanQR.setOnClickListener { launchQRScan() }

        findViewById<Button>(R.id.btnWalkIn).setOnClickListener {
            startActivity(Intent(this, WalkInActivity::class.java))
        }

        // Gentle pulse animation on scan button
        val pulseX = PropertyValuesHolder.ofFloat("scaleX", 1f, 1.07f, 1f)
        val pulseY = PropertyValuesHolder.ofFloat("scaleY", 1f, 1.07f, 1f)
        ObjectAnimator.ofPropertyValuesHolder(btnScanQR, pulseX, pulseY).apply {
            duration    = 1800
            repeatCount = ValueAnimator.INFINITE
            repeatMode  = ValueAnimator.RESTART
        }.start()

        robot = Robot.getInstance()
    }

    override fun onStart() {
        super.onStart()
        robot.addOnRobotReadyListener(this)
        robot.addOnDetectionStateChangedListener(this)
        TemiManager.hideTopBar()
        mainHandler.post(clockRunnable)
        startHeartbeat()
        TemiSocketManager.connect(this)
    }

    override fun onStop() {
        super.onStop()
        robot.removeOnRobotReadyListener(this)
        robot.removeOnDetectionStateChangedListener(this)
        mainHandler.removeCallbacks(clockRunnable)
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
            if (resultCode == RESULT_OK) {
                visitCount++
                runOnUiThread { tvVisitCount.text = visitCount.toString() }
            }
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
                    val connected = VMSApiClient.sendHeartbeat(
                        serial = BuildConfig.TEMI_SERIAL,
                        status = "online",
                        task   = if (isReadyForScan) "waiting" else "scanning"
                    )
                    val battery = TemiManager.getBatteryLevel()
                    runOnUiThread {
                        if (battery >= 0) tvBattery.text = "Battery: $battery%"
                        if (connected) {
                            tvConnectionStatus.text = "● Connected"
                            vConnectionDot.setBackgroundColor(Color.parseColor("#22C55E"))
                        } else {
                            tvConnectionStatus.text = "● Offline"
                            vConnectionDot.setBackgroundColor(Color.parseColor("#EF4444"))
                        }
                    }
                }
            }
        }, 0, HEARTBEAT_INTERVAL_MS)
    }

    private fun updateStatus(msg: String) = runOnUiThread { tvStatus.text = msg }

    companion object {
        private const val REQUEST_QR_SCAN       = 100
        private const val HEARTBEAT_INTERVAL_MS = 30_000L
        var visitCount = 0
    }
}
