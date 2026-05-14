package com.vms.temi.ui

import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.View
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
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
    private lateinit var scanOverlay: View
    private lateinit var cameraExecutor: ExecutorService
    private var isProcessing = false
    private var hasScanned = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_qr_scan)

        previewView = findViewById(R.id.previewView)
        tvInstruction = findViewById(R.id.tvInstruction)
        tvScanStatus = findViewById(R.id.tvScanStatus)
        scanOverlay = findViewById(R.id.scanOverlay)

        cameraExecutor = Executors.newSingleThreadExecutor()
        startCamera()

        TemiManager.speakScanPrompt()

        // Auto-cancel after 60 seconds
        Handler(Looper.getMainLooper()).postDelayed({
            if (!hasScanned) {
                finish()
            }
        }, 60_000)
    }

    private fun startCamera() {
        val cameraProviderFuture = ProcessCameraProvider.getInstance(this)
        cameraProviderFuture.addListener({
            val cameraProvider = cameraProviderFuture.get()
            val preview = Preview.Builder().build().also {
                it.setSurfaceProvider(previewView.surfaceProvider)
            }

            val imageAnalyzer = ImageAnalysis.Builder()
                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
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

            try {
                cameraProvider.unbindAll()
                cameraProvider.bindToLifecycle(
                    this, CameraSelector.DEFAULT_BACK_CAMERA, preview, imageAnalyzer
                )
            } catch (e: Exception) {
                Log.e(TAG, "Camera bind error: ${e.message}")
            }
        }, ContextCompat.getMainExecutor(this))
    }

    @androidx.annotation.OptIn(ExperimentalGetImage::class)
    private fun processImage(imageProxy: ImageProxy) {
        val mediaImage = imageProxy.image ?: run { imageProxy.close(); return }
        val image = InputImage.fromMediaImage(mediaImage, imageProxy.imageInfo.rotationDegrees)
        val scanner = BarcodeScanning.getClient()

        isProcessing = true
        scanner.process(image)
            .addOnSuccessListener { barcodes ->
                for (barcode in barcodes) {
                    if (barcode.format == Barcode.FORMAT_QR_CODE) {
                        barcode.rawValue?.let { token ->
                            Log.d(TAG, "QR scanned: ${token.take(30)}...")
                            hasScanned = true
                            handleQRToken(token)
                            return@addOnSuccessListener
                        }
                    }
                }
            }
            .addOnCompleteListener {
                isProcessing = false
                imageProxy.close()
            }
    }

    private fun handleQRToken(token: String) {
        updateInstruction("Validating QR code...")
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

        val intent = Intent(this, ErrorActivity::class.java).apply {
            putExtra(ErrorActivity.EXTRA_ERROR_CODE, result.code ?: "QR_INVALID")
            putExtra(ErrorActivity.EXTRA_ERROR_MESSAGE, result.error)
        }
        TemiManager.speakQRError(result.code ?: "QR_INVALID")
        startActivity(intent)
        finish()
    }

    private fun updateInstruction(msg: String) {
        runOnUiThread { tvInstruction.text = msg }
    }

    override fun onDestroy() {
        super.onDestroy()
        cameraExecutor.shutdown()
    }
}
