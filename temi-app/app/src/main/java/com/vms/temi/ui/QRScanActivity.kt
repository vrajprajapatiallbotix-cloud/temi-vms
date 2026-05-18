package com.vms.temi.ui

import android.Manifest
import android.animation.ObjectAnimator
import android.animation.ValueAnimator
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.util.Size
import android.view.View
import android.view.animation.LinearInterpolator
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
    private lateinit var cameraExecutor: ExecutorService
    private val countdownHandler = Handler(Looper.getMainLooper())
    private var isProcessing = false
    private var hasScanned = false

    // Scanner created once and reused every frame
    private val barcodeScanner by lazy {
        val options = BarcodeScannerOptions.Builder()
            .setBarcodeFormats(Barcode.FORMAT_QR_CODE)
            .build()
        BarcodeScanning.getClient(options)
    }

    companion object {
        private const val REQUEST_CAMERA_PERMISSION = 101
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_qr_scan)

        previewView   = findViewById(R.id.previewView)
        tvInstruction = findViewById(R.id.tvInstruction)
        tvScanStatus  = findViewById(R.id.tvScanStatus)
        tvCountdown   = findViewById(R.id.tvCountdown)
        scanOverlay   = findViewById(R.id.scanOverlay)
        scanLine      = findViewById(R.id.scanLine)

        cameraExecutor = Executors.newSingleThreadExecutor()

        TemiManager.speakScanPrompt()

        // Start scan line animation after layout is measured
        scanLine.post { startScanLineAnim() }

        // 60-second countdown
        startCountdown()

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
            == PackageManager.PERMISSION_GRANTED
        ) {
            startCamera()
        } else {
            ActivityCompat.requestPermissions(
                this,
                arrayOf(Manifest.permission.CAMERA),
                REQUEST_CAMERA_PERMISSION
            )
        }
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == REQUEST_CAMERA_PERMISSION) {
            if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                Log.d(TAG, "Camera permission granted — starting camera")
                startCamera()
            } else {
                Log.e(TAG, "Camera permission denied")
                updateInstruction("Camera permission denied. Please grant camera access in Settings.")
                Handler(Looper.getMainLooper()).postDelayed({ finish() }, 4_000)
            }
        }
    }

    private fun startCamera() {
        val cameraProviderFuture = ProcessCameraProvider.getInstance(this)
        cameraProviderFuture.addListener({
            try {
                val cameraProvider = cameraProviderFuture.get()

                val preview = Preview.Builder().build().also {
                    it.setSurfaceProvider(previewView.surfaceProvider)
                }

                val imageAnalyzer = ImageAnalysis.Builder()
                    .setTargetResolution(Size(1280, 720))
                    .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                    .setOutputImageFormat(ImageAnalysis.OUTPUT_IMAGE_FORMAT_YUV_420_888)
                    .build()
                    .also { analysis ->
                        analysis.setAnalyzer(cameraExecutor) { imageProxy ->
                            if (!isProcessing && !hasScanned) {
                                processImage(imageProxy)
                            } else {
                                imageProxy.close()
                            }
                        }
                    }

                cameraProvider.unbindAll()

                // Temi V3 uses front camera — try front first, fall back to back
                val cameraSelector = if (cameraProvider.hasCamera(CameraSelector.DEFAULT_FRONT_CAMERA))
                    CameraSelector.DEFAULT_FRONT_CAMERA
                else
                    CameraSelector.DEFAULT_BACK_CAMERA

                cameraProvider.bindToLifecycle(this, cameraSelector, preview, imageAnalyzer)
                Log.d(TAG, "Camera started with selector: $cameraSelector")
                updateStatus("Camera ready — hold QR code in front")

            } catch (e: Exception) {
                Log.e(TAG, "Camera start failed: ${e.message}")
                updateInstruction("Camera failed to open: ${e.message}")
            }
        }, ContextCompat.getMainExecutor(this))
    }

    @androidx.annotation.OptIn(ExperimentalGetImage::class)
    private fun processImage(imageProxy: ImageProxy) {
        val mediaImage = imageProxy.image
        if (mediaImage == null) {
            imageProxy.close()
            return
        }

        isProcessing = true
        val image = InputImage.fromMediaImage(mediaImage, imageProxy.imageInfo.rotationDegrees)

        barcodeScanner.process(image)
            .addOnSuccessListener { barcodes ->
                if (barcodes.isNotEmpty()) {
                    Log.d(TAG, "Detected ${barcodes.size} barcode(s)")
                }
                for (barcode in barcodes) {
                    val raw = barcode.rawValue
                    Log.d(TAG, "Barcode format=${barcode.format} value=${raw?.take(40)}")
                    if (raw != null && !hasScanned) {
                        hasScanned = true
                        handleQRToken(raw)
                        return@addOnSuccessListener
                    }
                }
            }
            .addOnFailureListener { e ->
                Log.e(TAG, "Barcode scan failed: ${e.message}")
            }
            .addOnCompleteListener {
                isProcessing = false
                imageProxy.close()
            }
    }

    private fun handleQRToken(token: String) {
        Log.d(TAG, "QR scanned — validating token: ${token.take(30)}...")
        updateInstruction("Validating QR code...")
        updateStatus("Please wait...")
        TemiManager.speakValidating()

        lifecycleScope.launch {
            val result = VMSApiClient.validateQR(token)
            runOnUiThread {
                if (result.valid && result.visitor != null) {
                    onValidQR(result)
                } else {
                    onInvalidQR(result)
                }
            }
        }
    }

    private fun onValidQR(result: QRValidateResponse) {
        Log.d(TAG, "Valid QR — Visitor: ${result.visitor?.name}")
        val intent = Intent(this, VisitorDisplayActivity::class.java).apply {
            putExtra(VisitorDisplayActivity.EXTRA_VISITOR_NAME, result.visitor?.name)
            putExtra(VisitorDisplayActivity.EXTRA_VISITOR_COMPANY, result.visitor?.company)
            putExtra(VisitorDisplayActivity.EXTRA_HOST_NAME, result.host?.name)
            putExtra(VisitorDisplayActivity.EXTRA_HOST_DEPARTMENT, result.host?.department)
            putExtra(VisitorDisplayActivity.EXTRA_MEETING_ROOM, result.visit?.meetingRoom)
            putExtra(VisitorDisplayActivity.EXTRA_VISIT_ID, result.visit?.id)
            putExtra(VisitorDisplayActivity.EXTRA_DESTINATION, result.navigation?.destination)
            putExtra(VisitorDisplayActivity.EXTRA_NAV_INSTRUCTION, result.navigation?.instruction)
        }
        setResult(RESULT_OK)
        startActivity(intent)
        finish()
    }

    private fun onInvalidQR(result: QRValidateResponse) {
        Log.w(TAG, "Invalid QR: ${result.error} (code: ${result.code})")
        lifecycleScope.launch {
            VMSApiClient.reportError(
                serial = BuildConfig.TEMI_SERIAL,
                errorType = result.code ?: "QR_INVALID",
                visitId = null,
                message = result.error ?: "QR validation failed"
            )
        }
        TemiManager.speakQRError(result.code ?: "QR_INVALID")
        val intent = Intent(this, ErrorActivity::class.java).apply {
            putExtra(ErrorActivity.EXTRA_ERROR_CODE, result.code ?: "QR_INVALID")
            putExtra(ErrorActivity.EXTRA_ERROR_MESSAGE, result.error)
        }
        startActivity(intent)
        finish()
    }

    private fun startScanLineAnim() {
        ObjectAnimator.ofFloat(scanLine, "translationY", 0f, scanOverlay.height.toFloat()).apply {
            duration      = 2000
            repeatCount   = ValueAnimator.INFINITE
            repeatMode    = ValueAnimator.REVERSE
            interpolator  = LinearInterpolator()
        }.start()
    }

    private fun startCountdown() {
        var seconds = 60
        countdownHandler.post(object : Runnable {
            override fun run() {
                if (hasScanned) return
                tvCountdown.text = if (seconds > 0) "Auto-close in ${seconds}s" else ""
                if (seconds <= 0) {
                    if (!hasScanned) finish()
                    return
                }
                seconds--
                countdownHandler.postDelayed(this, 1000)
            }
        })
    }

    private fun updateInstruction(msg: String) {
        runOnUiThread { tvInstruction.text = msg }
    }

    private fun updateStatus(msg: String) {
        runOnUiThread { tvScanStatus.text = msg }
    }

    override fun onDestroy() {
        super.onDestroy()
        countdownHandler.removeCallbacksAndMessages(null)
        cameraExecutor.shutdown()
        barcodeScanner.close()
    }
}
