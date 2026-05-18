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

    fun speakWelcome() = speak("Welcome to Nanta Tech Limited! I am Temi, your visitor assistant. Please scan your QR code to check in.")

    fun speakScanPrompt() = speak("Please show your QR code to the camera. I will scan it for you.")

    fun speakValidating() = speak("Thank you. Please wait while I verify your QR code.")

    fun speakWelcomeVisitor(visitorName: String, hostName: String) =
        speak("Welcome, $visitorName! ${hostName} is expecting you. Please follow me to your destination.")

    fun speakNavigation(destination: String) =
        speak("I will escort you to $destination. Please follow me closely.")

    fun speakWaitInstruction(room: String) =
        speak("We have arrived at $room. Please take a seat and your host will be with you shortly.")

    fun speakWalkInGreeting() = speak("Hello! I can register you as a walk-in visitor. Please fill in your details.")

    fun speakWalkInWaiting(hostName: String) = speak("Thank you! I have notified $hostName of your arrival. Please wait for their approval.")

    fun speakWalkInApproved() = speak("Great news! Your visit has been approved. Please scan the QR code on my screen to check in.")

    fun speakWalkInTimeout() = speak("I'm sorry, the request has timed out. Please ask reception for assistance.")

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

    fun stopMovement() {
        try { robot.stopMovement() } catch (e: Exception) { Log.e(TAG, "Stop error: ${e.message}") }
    }

    fun returnHome() {
        try {
            val locations = robot.locations
            // Find a "home" location by name, fall back to first saved location
            val home = locations.find { it.lowercase().contains("home") }
                ?: locations.firstOrNull()
            if (home != null) {
                robot.goTo(home)
                Log.d(TAG, "Returning home to: $home")
            } else {
                Log.w(TAG, "No locations on map — cannot return home")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Home error: ${e.message}")
        }
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
