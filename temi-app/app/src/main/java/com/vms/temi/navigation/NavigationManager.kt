package com.vms.temi.navigation

import android.util.Log
import com.robotemi.sdk.Robot
import com.robotemi.sdk.listeners.OnGoToLocationStatusChangedListener
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

enum class NavigationState { IDLE, NAVIGATING, ARRIVED, ERROR }

class NavigationManager : OnGoToLocationStatusChangedListener {

    private val TAG = "NavigationManager"
    private val robot: Robot by lazy { Robot.getInstance() }

    private val _state = MutableStateFlow(NavigationState.IDLE)
    val state: StateFlow<NavigationState> = _state

    private var currentDestination: String? = null
    private var onArrived: (() -> Unit)? = null
    private var onError: ((String) -> Unit)? = null

    fun register() {
        robot.addOnGoToLocationStatusChangedListener(this)
    }

    fun unregister() {
        robot.removeOnGoToLocationStatusChangedListener(this)
    }

    /** Returns all locations currently saved on Temi's map. */
    fun getAvailableLocations(): List<String> = try {
        robot.locations
    } catch (e: Exception) {
        Log.e(TAG, "Could not fetch locations: ${e.message}")
        emptyList()
    }

    /**
     * Resolves a requested destination against Temi's actual saved locations.
     * Priority: exact match → normalized match → partial/contains match → null.
     */
    fun resolveLocation(requested: String): String? {
        val available = getAvailableLocations()
        if (available.isEmpty()) {
            Log.w(TAG, "No locations saved on Temi map")
            return null
        }
        Log.d(TAG, "Available locations: $available")

        // 1. Exact match
        if (requested in available) return requested

        val normalize = { s: String -> s.lowercase().trim().replace(" ", "_") }
        val normReq = normalize(requested)

        // 2. Normalized exact match (spaces vs underscores, case)
        val normMatch = available.find { normalize(it) == normReq }
        if (normMatch != null) return normMatch

        // 3. Partial contains match (e.g. "meeting_a" matches "meeting_room_a")
        val containsMatch = available.find { normalize(it).contains(normReq) || normReq.contains(normalize(it)) }
        if (containsMatch != null) return containsMatch

        Log.w(TAG, "No location match found for '$requested' in $available")
        return null
    }

    fun navigateTo(destination: String, onArrived: () -> Unit, onError: (String) -> Unit) {
        this.onArrived = onArrived
        this.onError = onError

        val available = getAvailableLocations()

        // If destination is blank, go to home base as default
        if (destination.isBlank()) {
            val home = available.find { it.lowercase().contains("home") } ?: available.firstOrNull()
            if (home != null) {
                goTo(home, onArrived, onError)
            } else {
                onError("No locations saved on Temi's map.")
            }
            return
        }

        val resolved = resolveLocation(destination)
        if (resolved != null) {
            goTo(resolved, onArrived, onError)
            return
        }

        // No exact/fuzzy match — fall back to home base and warn
        Log.w(TAG, "'$destination' not matched in $available — falling back to home base")
        val home = available.find { it.lowercase().contains("home") } ?: available.firstOrNull()
        if (home != null) {
            Log.d(TAG, "Fallback navigation to: $home")
            goTo(home, onArrived, onError)
        } else {
            _state.value = NavigationState.ERROR
            onError("Location '$destination' not found and no fallback available.")
        }
    }

    private fun goTo(location: String, onArrived: () -> Unit, onError: (String) -> Unit) {
        currentDestination = location
        _state.value = NavigationState.NAVIGATING
        try {
            robot.goTo(location)
            Log.d(TAG, "Navigating to: $location")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start navigation: ${e.message}")
            _state.value = NavigationState.ERROR
            onError("Navigation failed: ${e.message}")
        }
    }

    fun stopNavigation() {
        try { robot.stopMovement() } catch (_: Exception) {}
        _state.value = NavigationState.IDLE
        currentDestination = null
    }

    override fun onGoToLocationStatusChanged(
        location: String,
        status: String,
        descriptionId: Int,
        description: String
    ) {
        Log.d(TAG, "Navigation status: $status for $location — $description")
        when (status) {
            OnGoToLocationStatusChangedListener.START -> {
                _state.value = NavigationState.NAVIGATING
            }
            OnGoToLocationStatusChangedListener.COMPLETE -> {
                _state.value = NavigationState.ARRIVED
                Log.d(TAG, "Arrived at: $location")
                onArrived?.invoke()
            }
            OnGoToLocationStatusChangedListener.ABORT -> {
                _state.value = NavigationState.ERROR
                Log.w(TAG, "Navigation aborted for: $location ($description)")
                onError?.invoke("Navigation aborted: $description")
            }
        }
    }
}
