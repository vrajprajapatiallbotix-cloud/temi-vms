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

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_visitor_display)

        val visitorName = intent.getStringExtra(EXTRA_VISITOR_NAME) ?: "Visitor"
        val visitorCompany = intent.getStringExtra(EXTRA_VISITOR_COMPANY) ?: ""
        val hostName = intent.getStringExtra(EXTRA_HOST_NAME) ?: ""
        val hostDepartment = intent.getStringExtra(EXTRA_HOST_DEPARTMENT) ?: ""
        val meetingRoom = intent.getStringExtra(EXTRA_MEETING_ROOM) ?: ""
        val visitId = intent.getStringExtra(EXTRA_VISIT_ID)
        val destination = intent.getStringExtra(EXTRA_DESTINATION) ?: "waiting_area"
        val navInstruction = intent.getStringExtra(EXTRA_NAV_INSTRUCTION) ?: "Please follow me"

        // Bind UI
        findViewById<TextView>(R.id.tvVisitorName).text = visitorName
        findViewById<TextView>(R.id.tvVisitorCompany).text = visitorCompany.ifEmpty { "Guest" }
        findViewById<TextView>(R.id.tvHostName).text = "Meeting: $hostName"
        findViewById<TextView>(R.id.tvHostDepartment).text = hostDepartment
        val roomDisplay = if (meetingRoom.isNotEmpty()) meetingRoom.replace("_", " ").replaceFirstChar { it.uppercase() } else "Reception"
        findViewById<TextView>(R.id.tvMeetingRoom).text = "Destination: $roomDisplay"
        findViewById<TextView>(R.id.tvInstruction).text = navInstruction

        navManager = NavigationManager()
        navManager.register()

        // Welcome and navigate after short delay
        Handler(Looper.getMainLooper()).postDelayed({
            TemiManager.speakWelcomeVisitor(visitorName, hostName)
            Handler(Looper.getMainLooper()).postDelayed({
                startNavigation(destination, visitId, meetingRoom)
            }, 5000)
        }, 1000)
    }

    private fun startNavigation(destination: String, visitId: String?, roomName: String) {
        Log.d(TAG, "Starting navigation to: $destination")
        TemiManager.speakNavigation(destination.replace("_", " "))

        navManager.navigateTo(
            destination = destination,
            onArrived = {
                Log.d(TAG, "Arrived at destination!")
                runOnUiThread {
                    val display = roomName.ifEmpty { destination }.replace("_", " ").replaceFirstChar { it.uppercase() }
                    TemiManager.speakWaitInstruction(display)
                    findViewById<TextView>(R.id.tvInstruction).text = "We have arrived! Please take a seat."

                    // Mark visit as completed after escort
                    if (visitId != null) {
                        lifecycleScope.launch {
                            Handler(Looper.getMainLooper()).postDelayed({
                                lifecycleScope.launch {
                                    VMSApiClient.checkoutVisit(visitId)
                                }
                            }, 30_000)
                        }
                    }

                    // Return to home base after 45 seconds
                    Handler(Looper.getMainLooper()).postDelayed({
                        TemiManager.returnHome()
                        finish()
                    }, 45_000)
                }
            },
            onError = { errorMsg ->
                Log.e(TAG, "Navigation error: $errorMsg")
                runOnUiThread {
                    TemiManager.speak("I apologize, I encountered a navigation issue. Please ask security for assistance.")
                    lifecycleScope.launch {
                        VMSApiClient.reportError(
                            serial = BuildConfig.TEMI_SERIAL,
                            errorType = "NAVIGATION_ERROR",
                            visitId = visitId,
                            message = errorMsg
                        )
                    }
                    Handler(Looper.getMainLooper()).postDelayed({ finish() }, 10_000)
                }
            }
        )
    }

    override fun onDestroy() {
        super.onDestroy()
        navManager.unregister()
    }

    companion object {
        const val EXTRA_VISITOR_NAME = "visitor_name"
        const val EXTRA_VISITOR_COMPANY = "visitor_company"
        const val EXTRA_HOST_NAME = "host_name"
        const val EXTRA_HOST_DEPARTMENT = "host_department"
        const val EXTRA_MEETING_ROOM = "meeting_room"
        const val EXTRA_VISIT_ID = "visit_id"
        const val EXTRA_DESTINATION = "destination"
        const val EXTRA_NAV_INSTRUCTION = "nav_instruction"
    }
}
