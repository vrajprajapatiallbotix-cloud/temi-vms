package com.vms.temi.api

import com.vms.temi.api.models.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

object VMSApiClient {

    private lateinit var service: VMSApiService
    private lateinit var apiKey: String

    fun initialize(baseUrl: String, temiApiKey: String) {
        apiKey = temiApiKey
        val logging = HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BODY
        }
        val client = OkHttpClient.Builder()
            .addInterceptor(logging)
            .addInterceptor { chain ->
                val request = chain.request().newBuilder()
                    .addHeader("x-temi-api-key", temiApiKey)
                    .addHeader("Content-Type", "application/json")
                    .build()
                chain.proceed(request)
            }
            .connectTimeout(10, TimeUnit.SECONDS)
            .readTimeout(15, TimeUnit.SECONDS)
            .build()

        service = Retrofit.Builder()
            .baseUrl(if (baseUrl.endsWith("/")) baseUrl else "$baseUrl/")
            .client(client)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(VMSApiService::class.java)
    }

    suspend fun validateQR(token: String): QRValidateResponse = withContext(Dispatchers.IO) {
        try {
            val response = service.validateQR(QRValidateRequest(token))
            if (response.isSuccessful) {
                response.body() ?: QRValidateResponse(false, null, null, null, null, "Empty response")
            } else {
                QRValidateResponse(false, null, null, null, null, "Validation failed: ${response.code()}")
            }
        } catch (e: Exception) {
            QRValidateResponse(false, null, null, null, null, "Network error: ${e.message}", "NETWORK_ERROR")
        }
    }

    suspend fun syncLocations(serial: String, locations: List<String>) {
        withContext(Dispatchers.IO) {
            try {
                val response = service.syncLocations(LocationSyncRequest(serial, locations))
                val status = if (response.isSuccessful) "OK" else "HTTP ${response.code()}"
                android.util.Log.d("VMSApiClient", "Synced ${locations.size} locations [$status]: $locations")
            } catch (e: Exception) {
                android.util.Log.e("VMSApiClient", "Failed to sync locations: ${e.message}")
            }
        }
    }

    suspend fun sendHeartbeat(serial: String, status: String = "online", task: String? = null) {
        withContext(Dispatchers.IO) {
            try {
                service.sendHeartbeat(HeartbeatRequest(serial, status, task))
            } catch (_: Exception) {}
        }
    }

    suspend fun checkoutVisit(visitId: String) = withContext(Dispatchers.IO) {
        try { service.checkoutVisit(CheckoutRequest(visitId)) } catch (_: Exception) {}
    }

    suspend fun reportError(serial: String, errorType: String, visitId: String?, message: String) {
        withContext(Dispatchers.IO) {
            try {
                service.reportError(ErrorReportRequest(serial, errorType, visitId, message))
            } catch (_: Exception) {}
        }
    }
}
