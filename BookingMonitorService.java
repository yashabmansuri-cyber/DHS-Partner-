package com.delhi.home.service.dhspartner;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.IBinder;
import android.os.Looper;
import android.os.SystemClock;
import android.provider.Settings;

import org.json.JSONObject;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class BookingMonitorService extends Service {
    public static final String ACTION_START = "dhs.START_MONITOR";
    public static final String ACTION_STOP = "dhs.STOP_MONITOR";
    public static final String ACTION_ACCEPT = "dhs.ACCEPT_BOOKING";
    public static final String ACTION_REJECT = "dhs.REJECT_BOOKING";
    public static final String EXTRA_BOOKING_ID = "bookingId";

    private static final int ONLINE_ID = 8101;
    private static final String ONLINE_CHANNEL = "dhs_online";
    private static final String BOOKING_CHANNEL = "dhs_booking_alerts";
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private volatile boolean running;
    private volatile String idToken = "";
    private volatile long tokenAt;
    private final java.util.HashSet<String> alerted = new java.util.HashSet<>();
    private LocationManager locationManager;

    @Override public void onCreate() {
        super.onCreate();
        createChannels();
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent == null ? ACTION_START : intent.getAction();
        if (ACTION_STOP.equals(action)) { stopMonitor(); return START_NOT_STICKY; }
        if (ACTION_ACCEPT.equals(action)) {
            String id = intent.getStringExtra(EXTRA_BOOKING_ID);
            if (id != null) executor.execute(() -> updateBooking(id, "ACCEPTED"));
            return START_STICKY;
        }
        if (ACTION_REJECT.equals(action)) {
            String id = intent.getStringExtra(EXTRA_BOOKING_ID);
            if (id != null) executor.execute(() -> updateBooking(id, "REJECTED"));
            return START_STICKY;
        }
        DhsPrefs.setOnline(this, true);
        startForeground(ONLINE_ID, buildOnlineNotification());
        startLocationUpdates();
        if (!running) { running = true; executor.execute(this::monitorLoop); }
        return START_STICKY;
    }

    private void monitorLoop() {
        while (running && DhsPrefs.isOnline(this)) {
            try {
                String email = DhsPrefs.email(this), password = DhsPrefs.password(this);
                if (email.isEmpty() || password.isEmpty()) { sleep(10000); continue; }
                if (idToken.isEmpty() || SystemClock.elapsedRealtime() - tokenAt > 45 * 60 * 1000L) {
                    JSONObject auth = FirestoreRest.passwordLogin(email, password);
                    idToken = auth.optString("idToken", "");
                    tokenAt = SystemClock.elapsedRealtime();
                }
                if (!idToken.isEmpty()) {
                    java.util.ArrayList<Map<String,Object>> docs = new java.util.ArrayList<>();
                    String uid=DhsPrefs.uid(this), email=DhsPrefs.email(this);
                    if(!uid.isEmpty()) {
                        addAllUnique(docs, FirestoreRest.queryDocuments("partnerJobs","workeruid",uid,"Bearer "+idToken));
                        addAllUnique(docs, FirestoreRest.queryDocuments("partnerJobs","partnerId",uid,"Bearer "+idToken));
                    }
                    if(!email.isEmpty()) {
                        addAllUnique(docs, FirestoreRest.queryDocuments("partnerJobs","workeremail",email,"Bearer "+idToken));
                        addAllUnique(docs, FirestoreRest.queryDocuments("partnerJobs","partnerEmail",email,"Bearer "+idToken));
                    }
                    for (Map<String,Object> d : docs) {
                        if (!DhsPrefs.isOnline(this)) break;
                        if (isAssignedAndNew(d)) {
                            String id = String.valueOf(d.get("id"));
                            if (!alerted.contains(id)) {
                                alerted.add(id);
                                if (!MainActivity.isVisible()) {
                                    showBookingAlert(id, text(d,"costumername","customerName","customer","Customer"), text(d,"service","serviceType","Service"), text(d,"costumerAddress","customerAddress","address","Address not available"));
                                }
                            }
                        }
                    }
                }
            } catch (Exception e) {
                if (String.valueOf(e.getMessage()).contains("401") || String.valueOf(e.getMessage()).contains("403")) idToken = "";
            }
            sleep(6000);
        }
        stopSelf();
    }

    private void addAllUnique(java.util.ArrayList<Map<String,Object>> out, List<Map<String,Object>> incoming){
        for(Map<String,Object> item:incoming){String id=String.valueOf(item.get("id"));boolean exists=false;for(Map<String,Object> old:out){if(String.valueOf(old.get("id")).equals(id)){exists=true;break;}}if(!exists)out.add(item);}
    }

    private boolean isAssignedAndNew(Map<String,Object> d) {
        String status = text(d,"partnerStatus","Stuts","bookingStatus","status","").toUpperCase();
        if (!("NEW".equals(status) || "PENDING_ACCEPT".equals(status) || status.isEmpty())) return false;
        String uid = DhsPrefs.uid(this).toLowerCase();
        String email = DhsPrefs.email(this).toLowerCase();
        String[] keys = {"workeruid","workerUid","partnerUid","partnerId","assignedPartnerId","assignedTo","workerid","partnerEmail","workeremail","assignedEmail","workerEmail"};
        for (String k : keys) {
            Object v = d.get(k);
            if (v != null) {
                String s = String.valueOf(v).toLowerCase();
                if ((!uid.isEmpty() && s.equals(uid)) || (!email.isEmpty() && s.equals(email))) return true;
            }
        }
        return Boolean.TRUE.equals(d.get("SentToPartner")) || Boolean.TRUE.equals(d.get("sentToPartner"));
    }

    private String text(Map<String,Object> d, String... keys) {
        String fallback = keys.length > 0 ? keys[keys.length - 1] : "";
        for (int i=0;i<keys.length-1;i++) { Object v=d.get(keys[i]); if(v!=null && !String.valueOf(v).isEmpty()) return String.valueOf(v); }
        return fallback;
    }

    private void showBookingAlert(String id, String customer, String service, String address) {
        Intent full = new Intent(this, BookingAlertActivity.class)
                .putExtra(EXTRA_BOOKING_ID,id).putExtra("customer",customer).putExtra("service",service).putExtra("address",address)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(this, id.hashCode(), full,
                PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0));
        Notification.Builder b = new Notification.Builder(this, BOOKING_CHANNEL)
                .setSmallIcon(com.delhi.home.service.dhspartner.R.drawable.ic_stat_dhs)
                .setContentTitle("🔔 NEW DHS BOOKING")
                .setContentText(customer + " • " + service)
                .setStyle(new Notification.BigTextStyle().bigText(customer + "\n" + service + "\n" + address))
                .setPriority(Notification.PRIORITY_MAX)
                .setCategory(Notification.CATEGORY_CALL)
                .setAutoCancel(true)
                .setOngoing(false)
                .setContentIntent(pi)
                .setFullScreenIntent(pi, true);
        NotificationManager nm=(NotificationManager)getSystemService(NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT < 33 || checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)==PackageManager.PERMISSION_GRANTED) nm.notify(9000 + Math.abs(id.hashCode()%500), b.build());
    }

    private Notification buildOnlineNotification() {
        Intent open=new Intent(this,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi=PendingIntent.getActivity(this,8102,open,PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT>=23?PendingIntent.FLAG_IMMUTABLE:0));
        return new Notification.Builder(this,ONLINE_CHANNEL)
                .setSmallIcon(R.drawable.ic_stat_dhs)
                .setContentTitle("DHS Partner • You're online")
                .setContentText("Waiting for new bookings")
                .setOngoing(true).setCategory(Notification.CATEGORY_SERVICE).setContentIntent(pi).build();
    }

    private void createChannels() {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm=getSystemService(NotificationManager.class);
        NotificationChannel online=new NotificationChannel(ONLINE_CHANNEL,"DHS Partner Online",NotificationManager.IMPORTANCE_LOW);
        online.setDescription("Shows that the partner is online and ready for bookings.");
        nm.createNotificationChannel(online);
        NotificationChannel booking=new NotificationChannel(BOOKING_CHANNEL,"DHS New Booking Alerts",NotificationManager.IMPORTANCE_HIGH);
        booking.setDescription("Loud sound and vibration for new DHS bookings.");
        android.net.Uri sound=android.net.Uri.parse("android.resource://"+getPackageName()+"/"+R.raw.dhs_booking_alert);
        android.media.AudioAttributes aa=new android.media.AudioAttributes.Builder().setUsage(android.media.AudioAttributes.USAGE_ALARM).setContentType(android.media.AudioAttributes.CONTENT_TYPE_SONIFICATION).build();
        booking.setSound(sound,aa); booking.enableVibration(true); booking.setVibrationPattern(new long[]{0,500,120,500,120,900,150,700}); booking.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        booking.setBypassDnd(true);
        nm.createNotificationChannel(booking);
    }

    private void updateBooking(String id, String status) {
        try {
            ensureToken();
            String bearer="Bearer "+idToken;
            Map<String,Object> patch=new HashMap<>();
            patch.put("Stuts",status); patch.put("partnerStatus",status); patch.put("bookingStatus",status); patch.put("workeruid",DhsPrefs.uid(this)); patch.put("partnerId",DhsPrefs.uid(this)); patch.put("workeremail",DhsPrefs.email(this)); patch.put("partnerEmail",DhsPrefs.email(this));
            FirestoreRest.patchDocument("partnerJobs",id,patch,bearer);
            try { FirestoreRest.patchDocument("bookings",id,patch,bearer); } catch(Exception ignored) {}
            ((NotificationManager)getSystemService(NOTIFICATION_SERVICE)).cancel(9000 + Math.abs(id.hashCode()%500));
        } catch(Exception ignored) {}
    }

    private void ensureToken() throws Exception {
        if (idToken.isEmpty() || SystemClock.elapsedRealtime()-tokenAt>45*60*1000L) {
            JSONObject auth=FirestoreRest.passwordLogin(DhsPrefs.email(this),DhsPrefs.password(this));
            idToken=auth.optString("idToken",""); tokenAt=SystemClock.elapsedRealtime();
        }
        if(idToken.isEmpty()) throw new Exception("No Firebase token");
    }

    private void startLocationUpdates() {
        try {
            if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)!=PackageManager.PERMISSION_GRANTED && checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION)!=PackageManager.PERMISSION_GRANTED) return;
            locationManager=(LocationManager)getSystemService(LOCATION_SERVICE);
            LocationListener listener=new LocationListener(){@Override public void onLocationChanged(Location location){} };
            if (locationManager!=null) locationManager.requestLocationUpdates(LocationManager.GPS_PROVIDER,10000,20,listener,Looper.getMainLooper());
        } catch(Exception ignored) {}
    }

    private void stopMonitor() {
        DhsPrefs.setOnline(this,false); running=false; stopForeground(true); stopSelf();
    }
    private void sleep(long ms){try{Thread.sleep(ms);}catch(InterruptedException e){Thread.currentThread().interrupt();}}
    @Override public void onDestroy(){running=false;try{if(locationManager!=null)locationManager.removeUpdates((LocationListener)null);}catch(Exception ignored){};executor.shutdownNow();super.onDestroy();}
    @Override public IBinder onBind(Intent intent){return null;}
}
