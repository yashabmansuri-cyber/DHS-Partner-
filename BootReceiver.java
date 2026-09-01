package com.delhi.home.service.dhspartner;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

public class BootReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction()) && DhsPrefs.isOnline(context)) {
            Intent i=new Intent(context,BookingMonitorService.class).setAction(BookingMonitorService.ACTION_START);
            if(Build.VERSION.SDK_INT>=26) context.startForegroundService(i); else context.startService(i);
        }
    }
}
