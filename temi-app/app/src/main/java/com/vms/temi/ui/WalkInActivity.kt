package com.vms.temi.ui

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.text.Editable
import android.text.TextWatcher
import android.util.Base64
import android.util.Log
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.vms.temi.R
import com.vms.temi.api.VMSApiClient
import com.vms.temi.api.models.EmployeeSearchResult
import com.vms.temi.api.models.WalkInRequest
import com.vms.temi.socket.TemiSocketManager
import com.vms.temi.temi.TemiManager
import kotlinx.coroutines.launch

class WalkInActivity : AppCompatActivity() {

    private val TAG = "TemiVMS_WalkIn"
    private val mainHandler = Handler(Looper.getMainLooper())

    private lateinit var viewFlipper: ViewFlipper
    private lateinit var tvStepIndicator: TextView
    private lateinit var tvFaceInstruction: TextView
    private lateinit var temiFace: TemiFaceView

    // Step 1
    private lateinit var etName: EditText
    private lateinit var etPhone: EditText
    private lateinit var etCompany: EditText

    // Step 2
    private lateinit var etSearch: EditText
    private lateinit var employeeListContainer: LinearLayout
    private var allEmployees: List<EmployeeSearchResult> = emptyList()
    private var selectedEmployee: EmployeeSearchResult? = null

    // Step 3
    private lateinit var waitingPanel: LinearLayout
    private lateinit var qrPanel: LinearLayout
    private lateinit var tvWaitingHost: TextView
    private lateinit var tvWaitingStatus: TextView
    private lateinit var tvWaitCountdown: TextView
    private lateinit var tvQrCountdown: TextView
    private lateinit var ivQrCode: ImageView

    private val searchHandler = Handler(Looper.getMainLooper())
    private val searchRunnable = Runnable { filterEmployees(etSearch.text.toString()) }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_walk_in)

        viewFlipper      = findViewById(R.id.viewFlipper)
        tvStepIndicator  = findViewById(R.id.tvStepIndicator)
        tvFaceInstruction = findViewById(R.id.tvFaceInstruction)
        temiFace         = findViewById(R.id.temiFace)
        etName           = findViewById(R.id.etName)
        etPhone          = findViewById(R.id.etPhone)
        etCompany        = findViewById(R.id.etCompany)
        etSearch         = findViewById(R.id.etSearch)
        employeeListContainer = findViewById(R.id.employeeListContainer)
        waitingPanel     = findViewById(R.id.waitingPanel)
        qrPanel          = findViewById(R.id.qrPanel)
        tvWaitingHost    = findViewById(R.id.tvWaitingHost)
        tvWaitingStatus  = findViewById(R.id.tvWaitingStatus)
        tvWaitCountdown  = findViewById(R.id.tvWaitCountdown)
        tvQrCountdown    = findViewById(R.id.tvQrCountdown)
        ivQrCode         = findViewById(R.id.ivQrCode)

        temiFace.faceState = FaceState.GREETING
        TemiManager.speakWalkInGreeting()

        // Preload all employees
        lifecycleScope.launch {
            allEmployees = VMSApiClient.searchEmployees("")
            renderEmployeeList(allEmployees)
        }

        // Search debounce
        etSearch.addTextChangedListener(object : TextWatcher {
            override fun afterTextChanged(s: Editable?) {
                searchHandler.removeCallbacks(searchRunnable)
                searchHandler.postDelayed(searchRunnable, 300)
            }
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
        })

        // Step 1 → 2
        findViewById<Button>(R.id.btnNext).setOnClickListener {
            val name = etName.text.toString().trim()
            if (name.isEmpty()) {
                etName.error = "Name is required"
                etName.requestFocus()
                return@setOnClickListener
            }
            goToStep(2)
        }

        // Step 2 back
        findViewById<Button>(R.id.btnBack).setOnClickListener { goToStep(1) }

        // Cancel waiting
        findViewById<Button>(R.id.btnCancel).setOnClickListener { finish() }
    }

    private fun goToStep(step: Int) {
        viewFlipper.displayedChild = step - 1
        when (step) {
            1 -> {
                tvStepIndicator.text = "Step 1 of 2"
                tvFaceInstruction.text = "Let me help you\ncheck in today!"
            }
            2 -> {
                tvStepIndicator.text = "Step 2 of 2"
                tvFaceInstruction.text = "Who are you\nhere to visit?"
                filterEmployees(etSearch.text.toString())
            }
            3 -> {
                tvStepIndicator.text = "Waiting…"
                tvFaceInstruction.text = "Notifying your\nhost right now!"
            }
        }
    }

    private fun filterEmployees(query: String) {
        val filtered = if (query.isBlank()) allEmployees
        else allEmployees.filter {
            it.name.contains(query, ignoreCase = true) ||
            (it.department?.contains(query, ignoreCase = true) == true)
        }
        renderEmployeeList(filtered)
    }

    private fun renderEmployeeList(employees: List<EmployeeSearchResult>) {
        employeeListContainer.removeAllViews()
        if (employees.isEmpty()) {
            val empty = TextView(this).apply {
                text = "No results found"
                textSize = 13f
                setTextColor(Color.parseColor("#5a0000"))
                setPadding(0, 24, 0, 0)
                gravity = Gravity.CENTER
            }
            employeeListContainer.addView(empty)
            return
        }
        employees.forEach { emp ->
            // Row container
            val row = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(0, 14, 0, 14)
                isClickable = true
                isFocusable = true
                setBackgroundColor(Color.TRANSPARENT)
                setOnClickListener { selectEmployee(emp) }
            }

            val nameView = TextView(this).apply {
                text = emp.name
                textSize = 15f
                setTextColor(Color.WHITE)
                setTypeface(null, android.graphics.Typeface.BOLD)
            }

            val detailParts = listOfNotNull(emp.deskLocation, emp.department)
            val detailView = TextView(this).apply {
                text = detailParts.joinToString("  ·  ")
                textSize = 12f
                setTextColor(Color.parseColor("#FF7777"))
                setPadding(0, 3, 0, 0)
            }

            row.addView(nameView)
            row.addView(detailView)
            employeeListContainer.addView(row)

            // Divider
            val divider = View(this).apply {
                layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 1).apply {
                    topMargin = 0
                }
                setBackgroundColor(Color.parseColor("#200000"))
            }
            employeeListContainer.addView(divider)
        }
    }

    private fun selectEmployee(emp: EmployeeSearchResult) {
        selectedEmployee = emp
        goToStep(3)

        val visitorName    = etName.text.toString().trim()
        val visitorPhone   = etPhone.text.toString().trim().ifEmpty { null }
        val visitorCompany = etCompany.text.toString().trim().ifEmpty { null }

        tvWaitingHost.text   = emp.name
        tvWaitingStatus.text = "Notifying ${emp.name}…"
        waitingPanel.visibility = View.VISIBLE
        qrPanel.visibility      = View.GONE

        TemiManager.speakWalkInWaiting(emp.name)

        lifecycleScope.launch {
            val response = VMSApiClient.submitWalkIn(
                WalkInRequest(
                    visitorName    = visitorName,
                    visitorPhone   = visitorPhone,
                    visitorCompany = visitorCompany,
                    employeeId     = emp.id
                )
            )

            runOnUiThread {
                if (response?.visit != null) {
                    val visitId = response.visit.id.toString()
                    Log.d(TAG, "Walk-in submitted — visitId: $visitId")
                    tvWaitingStatus.text = "Request sent! Waiting for ${emp.name} to approve…"

                    // Join the visit room so we receive visit:approved_qr
                    TemiSocketManager.joinVisitRoom(visitId)

                    // Register QR callback
                    TemiSocketManager.onQRApproved = { qrImage ->
                        runOnUiThread { showApprovedQR(qrImage) }
                    }

                    // 3-minute timeout countdown
                    startWaitCountdown(180)
                } else {
                    Log.e(TAG, "Walk-in submission failed")
                    tvWaitingStatus.text = "Failed to send request. Please try again or ask reception."
                    TemiManager.speak("I'm sorry, there was a problem sending your request. Please ask reception for help.")
                    mainHandler.postDelayed({ finish() }, 10_000)
                }
            }
        }
    }

    private fun showApprovedQR(base64QrImage: String) {
        Log.d(TAG, "Showing approved QR")
        waitingPanel.visibility = View.GONE
        qrPanel.visibility      = View.VISIBLE

        mainHandler.removeCallbacksAndMessages(null)

        val bitmap = decodeQRImage(base64QrImage)
        if (bitmap != null) {
            ivQrCode.setImageBitmap(bitmap)
        }

        TemiManager.speakWalkInApproved()

        // Auto-close after 90 seconds so visitor can go scan the physical QR reader
        var seconds = 90
        mainHandler.post(object : Runnable {
            override fun run() {
                if (seconds <= 0) { finish(); return }
                tvQrCountdown.text = "Screen closes in ${seconds}s"
                seconds--
                mainHandler.postDelayed(this, 1000)
            }
        })
    }

    private fun startWaitCountdown(totalSeconds: Int) {
        var seconds = totalSeconds
        mainHandler.post(object : Runnable {
            override fun run() {
                if (seconds <= 0) {
                    tvWaitCountdown.text = ""
                    tvWaitingStatus.text = "Request timed out. Please ask reception."
                    TemiManager.speakWalkInTimeout()
                    mainHandler.postDelayed({ finish() }, 8_000)
                    return
                }
                val mins = seconds / 60
                val secs = seconds % 60
                tvWaitCountdown.text = "Auto-cancel in %d:%02d".format(mins, secs)
                seconds--
                mainHandler.postDelayed(this, 1000)
            }
        })
    }

    private fun decodeQRImage(base64: String): Bitmap? {
        return try {
            val clean = if (base64.contains(",")) base64.substringAfter(",") else base64
            val bytes = Base64.decode(clean, Base64.DEFAULT)
            BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
        } catch (e: Exception) {
            Log.e(TAG, "QR image decode failed: ${e.message}")
            null
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        searchHandler.removeCallbacksAndMessages(null)
        mainHandler.removeCallbacksAndMessages(null)
        TemiSocketManager.onQRApproved = null
    }
}
