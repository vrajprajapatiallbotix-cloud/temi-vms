package com.vms.temi.api.models

data class QRValidateRequest(val token: String)

data class QRValidateResponse(
    val valid: Boolean,
    val visitor: VisitorInfo?,
    val visit: VisitInfo?,
    val host: HostInfo?,
    val navigation: NavigationInfo?,
    val error: String? = null,
    val code: String? = null
)

data class VisitorInfo(
    val name: String,
    val company: String?,
    val photoUrl: String?
)

data class VisitInfo(
    val id: String,
    val purpose: String,
    val meetingRoom: String?,
    val type: String
)

data class HostInfo(
    val name: String,
    val department: String?,
    val deskLocation: String?
)

data class NavigationInfo(
    val destination: String,
    val instruction: String
)

data class HeartbeatRequest(
    val serial: String,
    val status: String = "online",
    val currentTask: String? = null
)

data class CheckoutRequest(val visitId: String)

data class ErrorReportRequest(
    val serial: String,
    val errorType: String,
    val visitId: String?,
    val message: String
)

data class LocationSyncRequest(val serial: String, val locations: List<String>)

data class GenericResponse(val ok: Boolean, val message: String? = null)

data class EmployeeSearchResult(
    val id: String,
    val name: String,
    val department: String?,
    @com.google.gson.annotations.SerializedName("desk_location") val deskLocation: String?
)

data class WalkInRequest(
    val visitorName: String,
    val visitorPhone: String? = null,
    val visitorCompany: String? = null,
    val purpose: String = "Walk-in visit",
    val employeeId: String
)

data class WalkInVisitData(val id: Long = 0)

data class WalkInResponse(
    val visit: WalkInVisitData? = null,
    val message: String? = null,
    val error: String? = null
)
