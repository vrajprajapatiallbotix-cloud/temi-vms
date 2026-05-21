package com.vms.temi.ui

import android.Manifest
import android.animation.ObjectAnimator
import android.animation.ValueAnimator
import android.app.AlertDialog
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.util.Log
import android.view.Surface
import android.view.View
import android.view.animation.LinearInterpolator
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.google.mlkit.vision.barcode.BarcodeScannerOptions
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.common.InputImage
import com.vms.temi.BuildConfig
import com.vms.temi.R
import com.vms.temi.api.VMSApiClient
import com.vms.temi.api.models.QRValidateResponse
import com.vms.temi.temi.TemiManager
import kotlinx.coroutines.launch
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

class QRScanActivity : AppCompatActivity() {

    private val TAG = "TemiVMS_QRScan"

    private lateinit var previewView: PreviewView
    private lateinit var tvInstruction: TextView
    private lateinit var tvScanStatus: TextView
    private lateinit var tvCountdown: TextView
    private lateinit var scanOverlay: View
    private lateinit var scanLine: View
    private lateinit var scanFlash: View
    private lateinit var btnTorch: Button
    private lateinit var btnManualEntry: Button

    private lateinit var cameraExecutor: ExecutorService
    private var cameraControl: CameraControl? = null
    private var torchEnabled = false

    private val countdownHandler = Handler(Looper.getMainLooper())
    private var isProcessing = false
    private var hasScanned = false

    private val barcodeScanner by lazy {
        BarcodeScanning.getClient(
            BarcodeScannerOptions.Builder()
                .setBarcodeFormats(Barcode.FORMAT_QR_CODE, Barcode.FORMAT_ALL_FORMATS)
                .build()
        )
    }

    companion object {
        private const val REQUEST_CAMERA_PERMISSION = 101
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_qr_scan)

        previewView     = findViewById(R.id.previewView)
        tvInstruction   = findViewById(R.id.tvInstruction)
        tvScanStatus    = findViewById(R.id.tvScanStatus)
        tvCountdown     = findViewById(R.id.tvCountdown)
        scanOverlay     = findViewById(R.id.scanOverlay)
        scanLine        = findViewById(R.id.scanLine)
        scanFlash       = findViewById(R.id.scanFlash)
        btnTorch        = findViewById(R.id.btnTorch)
        btnManualEntry  = findViewById(R.id.btnManualEntry)

        cameraExecutor = Executors.newSingleThreadExecutor()

        btnTorch.setOnClickListener { toggleTorch() }
        btnManualEntry.setOnClickListener { showManualEntryDialog() }

        TemiManager.speakScanPrompt()

        scanLine.post { startScanLineAnim() }
        startCountdown()

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
            == PackageManager.PERMISSION_GRANTED
        ) {
            startCamera()
        } else {
            ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.CAMERA), REQUEST_CAMERA_PERMISSION)
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == REQUEST_CAMERA_PERMISSION) {
            if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                startCamera()
            } else {
                updateInstruction("Camera permission denied — use Enter Code instead")
            }
        }
    }

    private fun startCamera() {
        val cameraProviderFuture = ProcessCameraProvider.getInstance(this)
        cameraProviderFuture.addListener({
            try {
                val cameraProvider = cameraProviderFuture.get()

                // KEY FIX: get actual display rotation so CameraX corrects the frame orientation.
                // Temi is landscape-locked; without this, rotationDegrees returns 0 and
                // ML Kit sees a 90°-rotated frame that it cannot decode.
                val displayRotation = display?.rotation ?: Surface.ROTATION_0

                val preview = Preview.Builder()
                    .setTargetRotation(displayRotation)
                    .build()
                    .also { it.setSurfaceProvider(previewView.surfaceProvider) }

                val imageAnalyzer = ImageAnalysis.Builder()
                    .setTargetRotation(displayRotation)
                    .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                    .setOutputImageFormat(ImageAnalysis.OUTPUT_IMAGE_FORMAT_YUV_420_888)
                    .build()
                    .also { analysis ->
                        analysis.setAnalyzer(cameraExecutor) { imageProxy ->
                            if (!isProcessing && !hasScanned) processImage(imageProxy)
                            else imageProxy.close()
                        }
                    }

                cameraProvider.unbindAll()

                // Temi's visitor-facing camera is the front camera.
                // Fall back to back camera if front is unavailable.
                val selector = when {
                    cameraProvider.hasCamera(CameraSelector.DEFAULT_FRONT_CAMERA) ->
                        CameraSelector.DEFAULT_FRONT_CAMERA
                    cameraProvider.hasCamera(CameraSelector.DEFAULT_BACK_CAMERA) ->
                        CameraSelector.DEFAULT_BACK_CAMERA
                    else -> throw IllegalStateException("No camera available")
                }

                val camera = cameraProvider.bindToLifecycle(this, selector, preview, imageAnalyzer)
                cameraControl = camera.cameraControl
                Log.d(TAG, "Camera bound — rotation=$displayRotation selector=$selector")
                updateStatus("Ready — hold QR code inside the frame")

            } catch (e: Exception) {
                Log.e(TAG, "Camera start failed: ${e.message}")
                updateStatus("Camera failed — use Enter Code button")
                updateInstruction("Camera unavailable: ${e.message}")
            }
        }, ContextCompat.getMainExecutor(this))
    }

    @androidx.annotation.OptIn(ExperimentalGetImage::class)
    private fun processImage(imageProxy: ImageProxy) {
        val mediaImage = imageProxy.image
        if (mediaImage == null) { imageProxy.close(); return }

        isProcessing = true
        val image = InputImage.fromMediaImage(mediaImage, imageProxy.imageInfo.rotationDegrees)

        barcodeScanner.process(image)
            .addOnSuccessListener { barcodes ->
                val raw = barcodes.firstOrNull { !it.rawValue.isNullOrBlank() }?.rawValue
                if (raw != null && !hasScanned) {
                    hasScanned = true
                    flashScanFrame()
                    vibrate()
                    handleQRToken(raw)
                }
            }
            .addOnFailureListener { e -> Log.w(TAG, "Scan failed: ${e.message}") }
            .addOnCompleteListener {
                isProcessing = false
                imageProxy.close()
            }
    }

    private fun handleQRToken(token: String) {
        Log.d(TAG, "QR token: ${token.take(40)}")
        updateInstruction("QR detected — validating…")
        updateStatus("Please wait…")
        TemiManager.speakValidating()

        lifecycleScope.launch {
            val result = VMSApiClient.validateQR(token)
            runOnUiThread {
                if (result.valid && result.visitor != null) onValidQR(result)
                else onInvalidQR(result)
            }
        }
    }

    private fun onValidQR(result: QRValidateResponse) {
        setResult(RESULT_OK)
        startActivity(Intent(this, VisitorDisplayActivity::class.java).apply {
            putExtra(VisitorDisplayActivity.EXTRA_VISITOR_NAME,    result.visitor?.name)
            putExtra(VisitorDisplayActivity.EXTRA_VISITOR_COMPANY, result.visitor?.company)
            putExtra(VisitorDisplayActivity.EXTRA_HOST_NAME,       result.host?.name)
            putExtra(VisitorDisplayActivity.EXTRA_HOST_DEPARTMENT, result.host?.department)
            putExtra(VisitorDisplayActivity.EXTRA_MEETING_ROOM,    result.visit?.meetingRoom)
            putExtra(VisitorDisplayActivity.EXTRA_VISIT_ID,        result.visit?.id)
            putExtra(VisitorDisplayActivity.EXTRA_DESTINATION,     result.navigation?.destination)
            putExtra(VisitorDisplayActivity.EXTRA_NAV_INSTRUCTION, result.navigation?.instruction)
        })
        finish()
    }

    private fun onInvalidQR(result: QRValidateResponse) {
        Log.w(TAG, "Invalid QR: ${result.error} (${result.code})")
        TemiManager.speakQRError(result.code ?: "QR_INVALID")
        lifecycleScope.launch {
            VMSApiClient.reportError(BuildConfig.TEMI_SERIAL, result.code ?: "QR_INVALID", null, result.error ?: "")
        }
        startActivity(Intent(this, ErrorActivity::class.java).apply {
            putExtra(ErrorActivity.EXTRA_ERROR_CODE,    result.code ?: "QR_INVALID")
            putExtra(ErrorActivity.EXTRA_ERROR_MESSAGE, result.error)
        })
        finish()
    }

    // ── Torch ───────────────────────────────────────────────────────────────

    private fun toggleTorch() {
        torchEnabled = !torchEnabled
        cameraControl?.enableTorch(torchEnabled)
        btnTorch.text = if (torchEnabled) "💡 Torch ON" else "💡 Torch"
    }

    // ── Manual entry fallback ────────────────────────────────────────────────

    private fun showManualEntryDialog() {
        val input = EditText(this).apply {
            hint = "Paste or type QR token"
            setTextColor(0xFF000000.toInt())
            setPadding(40, 24, 40, 24)
        }
        AlertDialog.Builder(this)
            .setTitle("Enter QR Code Manually")
            .setMessage("Paste the token from your approval email:")
            .setView(input)
            .setPositiveButton("Validate") { _, _ ->
                val text = input.text.toString().trim()
                if (text.isNotBlank()) {
                    hasScanned = true
                    handleQRToken(text)
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    // ── Animations & feedback ────────────────────────────────────────────────

    private fun startScanLineAnim() {
        ObjectAnimator.ofFloat(scanLine, "translationY", 0f, scanOverlay.height.toFloat()).apply {
            duration     = 1800
            repeatCount  = ValueAnimator.INFINITE
            repeatMode   = ValueAnimator.REVERSE
            interpolator = LinearInterpolator()
        }.start()
    }

    private fun flashScanFrame() {
        runOnUiThread {
            scanFlash.alpha = 0.8f
            scanFlash.animate().alpha(0f).setDuration(500).start()
        }
    }

    private fun vibrate() {
        try {
            val v = getSystemService(VIBRATOR_SERVICE) as Vibrator
            v.vibrate(VibrationEffect.createOneShot(120, VibrationEffect.DEFAULT_AMPLITUDE))
        } catch (_: Exception) {}
    }

    private fun startCountdown() {
        var seconds = 60
        countdownHandler.post(object : Runnable {
            override fun run() {
                if (hasScanned) return
                tvCountdown.text = if (seconds > 0) "Auto-close in ${seconds}s" else ""
                if (seconds <= 0) { if (!hasScanned) finish(); return }
                seconds--
                countdownHandler.postDelayed(this, 1000)
            }
        })
    }

    private fun updateInstruction(msg: String) = runOnUiThread { tvInstruction.text = msg }
    private fun updateStatus(msg: String)      = runOnUiThread { tvScanStatus.text  = msg }

    override fun onDestroy() {
        super.onDestroy()
        countdownHandler.removeCallbacksAndMessages(null)
        cameraExecutor.shutdown()
        barcodeScanner.close()
    }
}
