package com.vms.temi.ui

import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.widget.Button
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import com.vms.temi.R
import com.vms.temi.temi.TemiManager

class ErrorActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_error)

        val errorCode = intent.getStringExtra(EXTRA_ERROR_CODE) ?: "UNKNOWN"
        val errorMessage = intent.getStringExtra(EXTRA_ERROR_MESSAGE) ?: "An error occurred"

        val tvTitle = findViewById<TextView>(R.id.tvErrorTitle)
        val tvMessage = findViewById<TextView>(R.id.tvErrorMessage)
        val tvHelp = findViewById<TextView>(R.id.tvErrorHelp)
        val btnRetry = findViewById<Button>(R.id.btnRetry)
        val btnAssistance = findViewById<Button>(R.id.btnRequestAssistance)

        tvMessage.text = errorMessage

        when (errorCode) {
            "QR_EXPIRED" -> {
                tvTitle.text = "QR Code Expired"
                tvHelp.text = "Please ask your host to generate a new QR code, or register at the security desk."
            }
            "QR_USED" -> {
                tvTitle.text = "QR Code Already Used"
                tvHelp.text = "This QR code has already been used. If you believe this is an error, please contact security."
            }
            "VISIT_DECLINED" -> {
                tvTitle.text = "Visit Declined"
                tvHelp.text = "Your visit request was declined. Please contact the person you intended to visit."
            }
            "QR_INVALID", "QR_NOT_FOUND" -> {
                tvTitle.text = "Invalid QR Code"
                tvHelp.text = "The QR code could not be verified. Please ensure you have the correct code."
            }
            "NETWORK_ERROR" -> {
                tvTitle.text = "Connection Error"
                tvHelp.text = "Unable to connect to the server. Please wait and try again, or ask for assistance."
            }
            else -> {
                tvTitle.text = "Access Error"
                tvHelp.text = "Please speak to security for assistance."
            }
        }

        btnRetry.setOnClickListener {
            finish() // Returns to QRScanActivity flow
        }

        btnAssistance.setOnClickListener {
            TemiManager.speak("Calling for assistance. Please wait.")
            // In a real deployment, trigger a security alert notification here
        }

        // Auto-dismiss after 30 seconds
        Handler(Looper.getMainLooper()).postDelayed({ finish() }, 30_000)
    }

    companion object {
        const val EXTRA_ERROR_CODE = "error_code"
        const val EXTRA_ERROR_MESSAGE = "error_message"
    }
}
