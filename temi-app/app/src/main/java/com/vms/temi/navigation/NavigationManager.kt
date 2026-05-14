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

    fun navigateTo(destination: String, onArrived: () -> Unit, onError: (String) -> Unit) {
        currentDestination = destination
        this.onArrived = onArrived
        this.onError = onError
        _state.value = NavigationState.NAVIGATING
        try {
            robot.goTo(destination)
            Log.d(TAG, "Started navigation to: $destination")
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
