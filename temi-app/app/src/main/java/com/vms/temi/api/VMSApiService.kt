package com.vms.temi.api

import com.vms.temi.api.models.*
import retrofit2.Response
import retrofit2.http.*

interface VMSApiService {

    @POST("qr/validate")
    suspend fun validateQR(@Body request: QRValidateRequest): Response<QRValidateResponse>

    @POST("temi/heartbeat")
    suspend fun sendHeartbeat(@Body request: HeartbeatRequest): Response<GenericResponse>

    @GET("temi/config/{serial}")
    suspend fun getConfig(@Path("serial") serial: String): Response<Any>

    @POST("temi/locations/sync")
    suspend fun syncLocations(@Body request: LocationSyncRequest): Response<GenericResponse>

    @POST("temi/checkout")
    suspend fun checkoutVisit(@Body request: CheckoutRequest): Response<GenericResponse>

    @POST("temi/error")
    suspend fun reportError(@Body request: ErrorReportRequest): Response<GenericResponse>

    @GET("visitor/employees/search")
    suspend fun searchEmployees(@retrofit2.http.Query("q") q: String): Response<List<EmployeeSearchResult>>

    @POST("visitor/impromptu")
    suspend fun submitWalkIn(@Body request: WalkInRequest): Response<WalkInResponse>

    @POST("otp/verify")
    suspend fun verifyOTP(@Body request: OTPVerifyRequest): Response<OTPVerifyResponse>
}
