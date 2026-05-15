package com.vms.temi.ui

import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.vms.temi.BuildConfig
import com.vms.temi.R
import com.vms.temi.api.VMSApiClient
import com.vms.temi.navigation.NavigationManager
import com.vms.temi.temi.TemiManager
import kotlinx.coroutines.launch

class VisitorDisplayActivity : AppCompatActivity() {

    private val TAG = "TemiVMS_Display"
    private lateinit var navManager: NavigationManager
    private lateinit var temiFace: TemiFaceView
    private lateinit var tvNavStatus: TextView
    private lateinit var tvInstruction: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_visitor_display)

        val visitorName    = intent.getStringExtra(EXTRA_VISITOR_NAME)    ?: "Visitor"
        val visitorCompany = intent.getStringExtra(EXTRA_VISITOR_COMPANY) ?: ""
        val hostName       = intent.getStringExtra(EXTRA_HOST_NAME)       ?: ""
        val hostDepartment = intent.getStringExtra(EXTRA_HOST_DEPARTMENT) ?: ""
        val meetingRoom    = intent.getStringExtra(EXTRA_MEETING_ROOM)    ?: ""
        val visitId        = intent.getStringExtra(EXTRA_VISIT_ID)
        val destination    = intent.getStringExtra(EXTRA_DESTINATION)     ?: ""
        val navInstruction = intent.getStringExtra(EXTRA_NAV_INSTRUCTION) ?: "Please follow me"

        // Bind views
        temiFace    = findViewById(R.id.temiFace)
        tvNavStatus = findViewById(R.id.tvNavStatus)
        tvInstruction = findViewById(R.id.tvInstruction)

        findViewById<TextView>(R.id.tvVisitorName).text    = visitorName
        findViewById<TextView>(R.id.tvVisitorCompany).text = visitorCompany.ifEmpty { "Guest" }
        findViewById<TextView>(R.id.tvHostName).text       = hostName
        findViewById<TextView>(R.id.tvHostDepartment).text = hostDepartment

        val roomDisplay = if (meetingRoom.isNotEmpty())
            meetingRoom.replace("_", " ").replaceFirstChar { it.uppercase() }
        else "Reception"
        findViewById<TextView>(R.id.tvMeetingRoom).text = roomDisplay

        tvInstruction.text = navInstruction

        // Start in greeting state
        temiFace.faceState = FaceState.GREETING
        tvNavStatus.text   = "● GREETING"

        navManager = NavigationManager()
        navManager.register()

        // Welcome speech, then navigate after 5s
        Handler(Looper.getMainLooper()).postDelayed({
            TemiManager.speakWelcomeVisitor(visitorName, hostName)
            Handler(Looper.getMainLooper()).postDelayed({
                startNavigation(destination, visitId, meetingRoom)
            }, 5000)
        }, 800)
    }

    private fun startNavigation(destination: String, visitId: String?, roomName: String) {
        val resolved = navManager.resolveLocation(destination)
        val speakName = (resolved ?: roomName.ifEmpty { destination }).replace("_", " ")
        Log.d(TAG, "Navigating — requested: $destination, resolved: $resolved")

        runOnUiThread {
            temiFace.faceState    = FaceState.NAVIGATING
            tvNavStatus.text      = "● NAVIGATING"
            tvInstruction.text    = "Please follow me to ${speakName.replaceFirstChar { it.uppercase() }}"
        }

        TemiManager.speakNavigation(speakName)

        navManager.navigateTo(
            destination = destination,
            onArrived = {
                Log.d(TAG, "Arrived!")
                runOnUiThread {
                    temiFace.faceState = FaceState.ARRIVED
                    tvNavStatus.text   = "● ARRIVED"
                    val display = roomName.ifEmpty { destination }
                        .replace("_", " ").replaceFirstChar { it.uppercase() }
                    tvInstruction.text = "We have arrived! Welcome."
                    TemiManager.speakWaitInstruction(display)
                }

                if (visitId != null) {
                    Handler(Looper.getMainLooper()).postDelayed({
                        lifecycleScope.launch { VMSApiClient.checkoutVisit(visitId) }
                    }, 30_000)
                }

                // Return home after 45 seconds
                Handler(Looper.getMainLooper()).postDelayed({
                    TemiManager.returnHome()
                    finish()
                }, 45_000)
            },
            onError = { errorMsg ->
                Log.e(TAG, "Nav error: $errorMsg")
                runOnUiThread {
                    temiFace.faceState = FaceState.IDLE
                    tvNavStatus.text   = "● ERROR"
                    val available = navManager.getAvailableLocations()
                    val speech = if (available.isEmpty())
                        "I'm sorry, I have no saved locations on my map. Please ask staff for assistance."
                    else
                        "I'm sorry, I could not find the destination. Please ask staff for assistance."
                    TemiManager.speak(speech)
                    tvInstruction.text = "Navigation error — please ask staff for help."
                }
                lifecycleScope.launch {
                    VMSApiClient.reportError(
                        serial    = BuildConfig.TEMI_SERIAL,
                        errorType = "NAVIGATION_ERROR",
                        visitId   = visitId,
                        message   = errorMsg
                    )
                }
                Handler(Looper.getMainLooper()).postDelayed({ finish() }, 12_000)
            }
        )
    }

    override fun onDestroy() {
        super.onDestroy()
        navManager.unregister()
    }

    companion object {
        const val EXTRA_VISITOR_NAME    = "visitor_name"
        const val EXTRA_VISITOR_COMPANY = "visitor_company"
        const val EXTRA_HOST_NAME       = "host_name"
        const val EXTRA_HOST_DEPARTMENT = "host_department"
        const val EXTRA_MEETING_ROOM    = "meeting_room"
        const val EXTRA_VISIT_ID        = "visit_id"
        const val EXTRA_DESTINATION     = "destination"
        const val EXTRA_NAV_INSTRUCTION = "nav_instruction"
    }
}
