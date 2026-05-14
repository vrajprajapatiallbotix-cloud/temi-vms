package com.vms.temi.socket

import android.content.Context
import android.content.Intent
import android.util.Log
import com.vms.temi.BuildConfig
import com.vms.temi.ui.VisitorDisplayActivity
import io.socket.client.IO
import io.socket.client.Socket
import org.json.JSONObject

object TemiSocketManager {

    private const val TAG = "TemiSocket"
    private var socket: Socket? = null

    fun connect(context: Context) {
        if (socket?.connected() == true) return

        val appContext = context.applicationContext
        val socketUrl = BuildConfig.VMS_API_BASE_URL.removeSuffix("/api").trimEnd('/')

        try {
            val opts = IO.Options.builder()
                .setReconnection(true)
                .setReconnectionDelay(3000)
                .setReconnectionDelayMax(10000)
                .build()

            socket = IO.socket(socketUrl, opts).apply {

                on(Socket.EVENT_CONNECT) {
                    Log.d(TAG, "Connected — joining temi:${BuildConfig.TEMI_SERIAL}")
                    emit("temi:join", JSONObject().put("serial", BuildConfig.TEMI_SERIAL))
                }

                on("temi:escort") { args ->
                    try {
                        val data = args[0] as JSONObject
                        val visitId        = data.optString("visitId")
                        val visitorName    = data.optString("visitorName", "Visitor")
                        val visitorCompany = data.optString("visitorCompany", "")
                        val hostName       = data.optString("hostName", "your host")
                        val hostDepartment = data.optString("hostDepartment", "")
                        val destination    = data.optString("destination", "reception")
                        val meetingRoom    = data.optString("meetingRoom", destination)
                        val instruction    = data.optString("instruction", "Please follow me")

                        Log.d(TAG, "Escort: $visitorName → $destination (host: $hostName)")

                        val intent = Intent(appContext, VisitorDisplayActivity::class.java).apply {
                            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                            putExtra(VisitorDisplayActivity.EXTRA_VISITOR_NAME, visitorName)
                            putExtra(VisitorDisplayActivity.EXTRA_VISITOR_COMPANY, visitorCompany)
                            putExtra(VisitorDisplayActivity.EXTRA_HOST_NAME, hostName)
                            putExtra(VisitorDisplayActivity.EXTRA_HOST_DEPARTMENT, hostDepartment)
                            putExtra(VisitorDisplayActivity.EXTRA_MEETING_ROOM, meetingRoom)
                            putExtra(VisitorDisplayActivity.EXTRA_VISIT_ID, visitId)
                            putExtra(VisitorDisplayActivity.EXTRA_DESTINATION, destination)
                            putExtra(VisitorDisplayActivity.EXTRA_NAV_INSTRUCTION, instruction)
                        }
                        appContext.startActivity(intent)
                    } catch (e: Exception) {
                        Log.e(TAG, "Escort handling error: ${e.message}")
                    }
                }

                on(Socket.EVENT_DISCONNECT) {
                    Log.w(TAG, "Socket disconnected — will reconnect automatically")
                }

                on(Socket.EVENT_CONNECT_ERROR) { args ->
                    Log.e(TAG, "Socket connect error: ${args.firstOrNull()}")
                }

                connect()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Socket init error: ${e.message}")
        }
    }

    fun disconnect() {
        socket?.disconnect()
        socket = null
    }
}
