package com.vms.temi

import android.app.Application
import com.vms.temi.api.VMSApiClient

class TemiVMSApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        VMSApiClient.initialize(BuildConfig.VMS_API_BASE_URL, BuildConfig.TEMI_API_KEY)
    }
}
