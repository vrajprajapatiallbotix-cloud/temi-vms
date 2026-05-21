package com.vms.temi.ui

import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.text.Editable
import android.text.TextWatcher
import android.view.View
import android.view.inputmethod.EditorInfo
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.vms.temi.R
import com.vms.temi.api.VMSApiClient
import com.vms.temi.temi.TemiManager
import kotlinx.coroutines.launch

class OTPInputActivity : AppCompatActivity() {

    private val TAG = "TemiVMS_OTP"

    private lateinit var stepEmail: LinearLayout
    private lateinit var stepOtp: LinearLayout
    private lateinit var stepValidating: LinearLayout
    private lateinit var etEmail: EditText
    private lateinit var tvEmailDisplay: TextView
    private lateinit var tvOTPError: TextView
    private lateinit var tvCountdown: TextView
    private lateinit var btnEmailContinue: Button
    private lateinit var btnVerify: Button
    private lateinit var btnBackToEmail: Button

    private val otpFields: Array<EditText?> = arrayOfNulls(6)
    private var currentEmail = ""

    private val countdownHandler = Handler(Looper.getMainLooper())

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_otp_input)

        stepEmail      = findViewById(R.id.stepEmail)
        stepOtp        = findViewById(R.id.stepOTP)
        stepValidating = findViewById(R.id.stepValidating)
        etEmail        = findViewById(R.id.etEmail)
        tvEmailDisplay = findViewById(R.id.tvEmailDisplay)
        tvOTPError     = findViewById(R.id.tvOTPError)
        tvCountdown    = findViewById(R.id.tvCountdown)
        btnEmailContinue = findViewById(R.id.btnEmailContinue)
        btnVerify        = findViewById(R.id.btnVerify)
        btnBackToEmail   = findViewById(R.id.btnBackToEmail)

        otpFields[0] = findViewById(R.id.otp1)
        otpFields[1] = findViewById(R.id.otp2)
        otpFields[2] = findViewById(R.id.otp3)
        otpFields[3] = findViewById(R.id.otp4)
        otpFields[4] = findViewById(R.id.otp5)
        otpFields[5] = findViewById(R.id.otp6)

        TemiManager.speakOTPPrompt()

        setupOTPFields()

        btnEmailContinue.setOnClickListener {
            val email = etEmail.text.toString().trim()
            if (email.isEmpty() || !android.util.Patterns.EMAIL_ADDRESS.matcher(email).matches()) {
                Toast.makeText(this, "Please enter a valid email address", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            currentEmail = email
            tvEmailDisplay.text = "OTP sent to: $email"
            showStep(2)
            otpFields[0]?.requestFocus()
        }

        btnVerify.setOnClickListener { verifyOTP() }

        btnBackToEmail.setOnClickListener {
            clearOTPFields()
            showStep(1)
        }

        startCountdown(90)
    }

    private fun setupOTPFields() {
        otpFields.forEachIndexed { idx, field ->
            field?.addTextChangedListener(object : TextWatcher {
                override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
                override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
                override fun afterTextChanged(s: Editable?) {
                    if (s?.length == 1) {
                        if (idx < 5) otpFields[idx + 1]?.requestFocus()
                        else if (allFilled()) verifyOTP() // auto-submit on last digit
                    }
                }
            })
            field?.setOnKeyListener { _, keyCode, event ->
                if (keyCode == android.view.KeyEvent.KEYCODE_DEL &&
                    event.action == android.view.KeyEvent.ACTION_DOWN &&
                    field.text.isEmpty() && idx > 0
                ) {
                    otpFields[idx - 1]?.requestFocus()
                    otpFields[idx - 1]?.text?.clear()
                    true
                } else false
            }
        }
    }

    private fun allFilled() = otpFields.all { it?.text?.length == 1 }

    private fun clearOTPFields() = otpFields.forEach { it?.text?.clear() }

    private fun getOTPCode() = otpFields.joinToString("") { it?.text.toString() }

    private fun verifyOTP() {
        val code = getOTPCode()
        if (code.length != 6) {
            tvOTPError.text = "Please enter all 6 digits"
            tvOTPError.visibility = View.VISIBLE
            return
        }
        showStep(3)
        lifecycleScope.launch {
            val result = VMSApiClient.verifyOTP(currentEmail, code)
            runOnUiThread {
                if (result.valid && result.visit != null) {
                    onOTPSuccess(result.visit)
                } else {
                    onOTPError(result.message ?: "Invalid OTP")
                }
            }
        }
    }

    private fun onOTPSuccess(visit: com.vms.temi.api.models.OTPVisitInfo) {
        val destination = visit.destination ?: visit.meetingRoom ?: visit.hostName ?: "your destination"
        TemiManager.speakOTPSuccess(visit.visitorName ?: "Visitor", destination)
        setResult(RESULT_OK)

        startActivity(Intent(this, VisitorDisplayActivity::class.java).apply {
            putExtra(VisitorDisplayActivity.EXTRA_VISITOR_NAME,    visit.visitorName)
            putExtra(VisitorDisplayActivity.EXTRA_VISITOR_COMPANY, visit.visitorCompany)
            putExtra(VisitorDisplayActivity.EXTRA_HOST_NAME,       visit.hostName)
            putExtra(VisitorDisplayActivity.EXTRA_HOST_DEPARTMENT, visit.hostDepartment)
            putExtra(VisitorDisplayActivity.EXTRA_MEETING_ROOM,    visit.meetingRoom)
            putExtra(VisitorDisplayActivity.EXTRA_VISIT_ID,        visit.id.toString())
            putExtra(VisitorDisplayActivity.EXTRA_DESTINATION,     destination)
        })
        finish()
    }

    private fun onOTPError(message: String) {
        clearOTPFields()
        showStep(2)
        tvOTPError.text = message
        tvOTPError.visibility = View.VISIBLE
        otpFields[0]?.requestFocus()
        TemiManager.speak("Incorrect OTP. Please try again.")
    }

    private fun showStep(step: Int) {
        stepEmail.visibility      = if (step == 1) View.VISIBLE else View.GONE
        stepOtp.visibility        = if (step == 2) View.VISIBLE else View.GONE
        stepValidating.visibility = if (step == 3) View.VISIBLE else View.GONE
        if (step != 2) tvOTPError.visibility = View.GONE
    }

    private fun startCountdown(seconds: Int) {
        var remaining = seconds
        countdownHandler.post(object : Runnable {
            override fun run() {
                tvCountdown.text = if (remaining > 0) "Auto-close in ${remaining}s" else ""
                if (remaining <= 0) { finish(); return }
                remaining--
                countdownHandler.postDelayed(this, 1000)
            }
        })
    }

    override fun onDestroy() {
        super.onDestroy()
        countdownHandler.removeCallbacksAndMessages(null)
    }
}
