package com.vms.temi.temi

import android.util.Log
import com.robotemi.sdk.Robot
import com.robotemi.sdk.TtsRequest
import com.robotemi.sdk.listeners.OnGoToLocationStatusChangedListener
import com.robotemi.sdk.listeners.OnRobotReadyListener

object TemiManager {

    private const val TAG = "TemiManager"
    private val robot: Robot by lazy { Robot.getInstance() }

    // --- TTS ---

    fun speak(text: String, showOnScreen: Boolean = true) {
        try {
            val req = TtsRequest.create(text, showOnScreen)
            robot.speak(req)
            Log.d(TAG, "Speaking: $text")
        } catch (e: Exception) {
            Log.e(TAG, "TTS error: ${e.message}")
        }
    }

    fun speakWelcome() = speak("Welcome! I am Temi, your visitor assistant. Please scan your QR code to check in.")

    fun speakScanPrompt() = speak("Please show your QR code to the camera. I will scan it for you.")

    fun speakValidating() = speak("Thank you. Please wait while I verify your QR code.")

    fun speakWelcomeVisitor(visitorName: String, hostName: String) =
        speak("Welcome, $visitorName! ${hostName} is expecting you. Please follow me to your destination.")

    fun speakNavigation(destination: String) =
        speak("I will escort you to $destination. Please follow me closely.")

    fun speakWaitInstruction(room: String) =
        speak("We have arrived at $room. Please take a seat and your host will be with you shortly.")

    fun speakQRError(errorCode: String) {
        val message = when (errorCode) {
            "QR_EXPIRED" -> "Your QR code has expired. Please contact reception for assistance."
            "QR_USED" -> "This QR code has already been used. Please speak to security."
            "VISIT_DECLINED" -> "I'm sorry, your visit request has been declined. Please contact the person you were visiting."
            "QR_INVALID" -> "I could not read this QR code. Please ensure it is valid."
            else -> "There was a problem with your QR code. Please ask for assistance at the security desk."
        }
        speak(message)
    }

    fun speakNetworkError() = speak("I am having trouble connecting to the server. Please wait a moment or ask for assistance.")

    // --- Navigation ---

    fun goToLocation(locationName: String) {
        try {
            // Map logical names to Temi-saved location names
            val temiLocation = mapLocationName(locationName)
            robot.goTo(temiLocation)
            Log.d(TAG, "Navigating to: $temiLocation (mapped from: $locationName)")
        } catch (e: Exception) {
            Log.e(TAG, "Navigation error: ${e.message}")
        }
    }

    private fun mapLocationName(name: String): String {
        return when (name.lowercase().replace(" ", "_")) {
            "meeting_room_a" -> "meeting_room_a"
            "meeting_room_b" -> "meeting_room_b"
            "meeting_room_c" -> "meeting_room_c"
            "conference_hall" -> "conference_hall"
            "waiting_area" -> "waiting_area"
            "reception" -> "reception"
            "home_base" -> "home base"
            else -> name
        }
    }

    fun stopMovement() {
        try { robot.stopMovement() } catch (e: Exception) { Log.e(TAG, "Stop error: ${e.message}") }
    }

    fun returnHome() {
        try { robot.goTo("home base") } catch (e: Exception) { Log.e(TAG, "Home error: ${e.message}") }
    }

    // --- Detection ---

    fun startDetection() {
        try {
            // Detection listener is registered in MainActivity; no explicit start needed for SDK 1.137.1
            Log.d(TAG, "Person detection active via OnDetectionStateChangedListener")
        } catch (e: Exception) {
            Log.e(TAG, "Detection error: ${e.message}")
        }
    }

    fun stopDetection() {
        // No-op for SDK 1.137.1 — detection stops when listener is removed in onStop
        Log.d(TAG, "Detection listener will be removed in onStop")
    }

    // --- Display ---

    fun hideTopBar() {
        try { robot.hideTopBar() } catch (_: Exception) {}
    }

    fun showTopBar() {
        try { robot.showTopBar() } catch (_: Exception) {}
    }

    // --- Battery ---

    fun getBatteryLevel(): Int {
        return try { robot.batteryData?.level ?: -1 } catch (_: Exception) { -1 }
    }

    // --- Volume ---

    fun setVolume(level: Int) {
        try { robot.setVolume(level.coerceIn(0, 10)) } catch (_: Exception) {}
    }
}
