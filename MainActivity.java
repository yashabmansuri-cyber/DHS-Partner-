package com.delhi.home.service.dhspartner;

import android.Manifest;
import android.app.Activity;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.webkit.JavascriptInterface;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.webkit.GeolocationPermissions;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceError;
import android.view.Window;
import android.view.WindowManager;

import java.util.ArrayList;
import java.util.List;

public class MainActivity extends Activity {
    private static volatile boolean visible = false;
    public static boolean isVisible() { return visible; }
    private static final int PERMISSION_REQUEST = 7001;
    private static final int FILE_REQUEST = 7002;
    private static final int CALL_PERMISSION_REQUEST = 7003;
    private WebView webView;
    private ValueCallback<Uri[]> fileCallback;


    private WebView printWebView;

    private class NativeBridge {
        @JavascriptInterface public void saveCredentials(String email, String password, String uid) {
            DhsPrefs.saveCredentials(MainActivity.this, email, password, uid);
        }
        @JavascriptInterface public void startBookingMonitor() {
            DhsPrefs.setOnline(MainActivity.this, true);
            Intent i = new Intent(MainActivity.this, BookingMonitorService.class).setAction(BookingMonitorService.ACTION_START);
            if (Build.VERSION.SDK_INT >= 26) startForegroundService(i); else startService(i);
        }
        @JavascriptInterface public void stopBookingMonitor() {
            DhsPrefs.setOnline(MainActivity.this, false);
            stopService(new Intent(MainActivity.this, BookingMonitorService.class).setAction(BookingMonitorService.ACTION_STOP));
        }
        @JavascriptInterface public void clearNativeSession() {
            DhsPrefs.clear(MainActivity.this);
            stopService(new Intent(MainActivity.this, BookingMonitorService.class).setAction(BookingMonitorService.ACTION_STOP));
        }
        @JavascriptInterface public void ensureAlertPermission() {
            if (Build.VERSION.SDK_INT >= 34) {
                try {
                    NotificationManagerCompatHelper.openFullScreenSettings(MainActivity.this);
                } catch (Exception ignored) {}
            }
        }
    }

    private static final class NotificationManagerCompatHelper {
        static void openFullScreenSettings(Activity activity) {
            if (Build.VERSION.SDK_INT < 34) return;
            android.app.NotificationManager nm = activity.getSystemService(android.app.NotificationManager.class);
            if (nm != null && !nm.canUseFullScreenIntent()) {
                Intent i = new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT,
                        Uri.parse("package:" + activity.getPackageName()));
                activity.startActivity(i);
            }
        }
    }

    private class PrintBridge {
        @JavascriptInterface
        public void printBill(String invoiceHtml) {
            runOnUiThread(() -> {
                if (invoiceHtml == null || invoiceHtml.trim().isEmpty()) return;
                try {
                    if (printWebView != null) {
                        try { printWebView.stopLoading(); } catch (Exception ignored) {}
                        printWebView.destroy();
                    }

                    printWebView = new WebView(MainActivity.this);
                    WebSettings ps = printWebView.getSettings();
                    ps.setJavaScriptEnabled(false);
                    ps.setDomStorageEnabled(false);
                    ps.setAllowFileAccess(true);
                    ps.setAllowContentAccess(true);
                    ps.setDefaultFontSize(16);
                    printWebView.setBackgroundColor(android.graphics.Color.WHITE);
                    android.view.ViewParent parent = webView.getParent();
                    if (parent instanceof android.view.ViewGroup) {
                        try {
                            ((android.view.ViewGroup) parent).addView(printWebView,
                                    new android.widget.FrameLayout.LayoutParams(1, 1));
                        } catch (Exception ignored) {}
                    }

                    // JavaScript sends a complete isolated HTML document containing
                    // the invoice markup AND its real invoice CSS. Do not replace it
                    // with invoice.outerHTML alone: that strips the CSS and can make
                    // Android's print renderer capture a blank page.
                    final String printHtml = invoiceHtml;

                    printWebView.setWebViewClient(new WebViewClient() {
                        @Override public void onPageFinished(WebView view, String url) {
                            // Give local images (QR/signature/stamp) time to decode before Android snapshots the page.
                            view.postDelayed(() -> startNativePrint(), 1000);
                        }
                    });
                    printWebView.loadDataWithBaseURL(
                            "file:///android_asset/", printHtml, "text/html", "UTF-8", null);
                } catch (Exception e) {
                    if (webView != null) webView.evaluateJavascript(
                            "if(window.toast) toast('Print error: ' + " + jsQuote(e.getMessage()) + ");", null);
                }
            });
        }
    }

    private void startNativePrint() {
        if (printWebView == null) return;
        try {
            PrintManager printManager = (PrintManager) getSystemService(PRINT_SERVICE);
            PrintDocumentAdapter adapter = printWebView.createPrintDocumentAdapter("DHS-Bill");
            PrintAttributes attributes = new PrintAttributes.Builder()
                    .setMediaSize(PrintAttributes.MediaSize.ISO_A4)
                    .setResolution(new PrintAttributes.Resolution("dhs", "DHS", 300, 300))
                    .setMinMargins(PrintAttributes.Margins.NO_MARGINS)
                    .build();
            printManager.print("DHS Bill", adapter, attributes);
        } catch (Exception e) {
            if (webView != null) webView.evaluateJavascript(
                    "if(window.toast) toast('Print error: ' + " + jsQuote(e.getMessage()) + ");", null);
        }
    }

    private String jsQuote(String value) {
        if (value == null) value = "Print failed";
        return "'" + value.replace("\\", "\\\\").replace("'", "\\'").replace("\n", " ") + "'";
    }

    @Override protected void onResume() { super.onResume(); visible = true; }
    @Override protected void onPause() { visible = false; super.onPause(); }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Window w = getWindow();
        w.setStatusBarColor(android.graphics.Color.rgb(6, 27, 70));
        w.setNavigationBarColor(android.graphics.Color.rgb(6, 27, 70));
        w.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        webView = new WebView(this);
        android.widget.FrameLayout root = new android.widget.FrameLayout(this);
        root.setLayoutParams(new android.view.ViewGroup.LayoutParams(-1, -1));
        root.addView(webView, new android.widget.FrameLayout.LayoutParams(-1, -1));
        setContentView(root);
        setupWebView();
        requestRuntimePermissions();
        webView.loadUrl("file:///android_asset/index.html");
    }

    private boolean handleSpecialUrl(String url) {
        if (url == null) return false;
        if (url.startsWith("tel:")) {
            try {
                Uri uri = Uri.parse(url);
                if (Build.VERSION.SDK_INT >= 23 && checkSelfPermission(Manifest.permission.CALL_PHONE) != PackageManager.PERMISSION_GRANTED) {
                    requestPermissions(new String[]{Manifest.permission.CALL_PHONE}, CALL_PERMISSION_REQUEST);
                    return true;
                }
                Intent intent = new Intent(Intent.ACTION_CALL, uri);
                startActivity(intent);
            } catch (SecurityException e) {
                try { startActivity(new Intent(Intent.ACTION_DIAL, Uri.parse(url))); } catch (Exception ignored) {}
            } catch (Exception e) {
                try { startActivity(new Intent(Intent.ACTION_DIAL, Uri.parse(url))); } catch (Exception ignored) {}
            }
            return true;
        }
        return false;
    }

    private void setupWebView() {
        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            s.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        }
        webView.addJavascriptInterface(new PrintBridge(), "Android");
        webView.addJavascriptInterface(new NativeBridge(), "AndroidDhs");
        webView.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return handleSpecialUrl(request.getUrl().toString());
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return handleSpecialUrl(url);
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("*/*");
                intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                startActivityForResult(Intent.createChooser(intent, "Choose file"), FILE_REQUEST);
                return true;
            }

            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                callback.invoke(origin, true, false);
            }
        });
        webView.setOverScrollMode(WebView.OVER_SCROLL_NEVER);
    }

    private void requestRuntimePermissions() {
        List<String> needed = new ArrayList<>();
        if (Build.VERSION.SDK_INT >= 23) {
            if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED)
                needed.add(Manifest.permission.ACCESS_FINE_LOCATION);
            if (checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED)
                needed.add(Manifest.permission.CAMERA);
            if (checkSelfPermission(Manifest.permission.CALL_PHONE) != PackageManager.PERMISSION_GRANTED)
                needed.add(Manifest.permission.CALL_PHONE);
        }
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED)
            needed.add(Manifest.permission.POST_NOTIFICATIONS);
        if (!needed.isEmpty()) requestPermissions(needed.toArray(new String[0]), PERMISSION_REQUEST);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILE_REQUEST && fileCallback != null) {
            Uri[] result = null;
            if (resultCode == RESULT_OK && data != null) {
                if (data.getClipData() != null) {
                    int count = data.getClipData().getItemCount();
                    result = new Uri[count];
                    for (int i = 0; i < count; i++) result[i] = data.getClipData().getItemAt(i).getUri();
                } else if (data.getData() != null) {
                    result = new Uri[]{data.getData()};
                }
            }
            fileCallback.onReceiveValue(result);
            fileCallback = null;
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override protected void onDestroy() {
        if (fileCallback != null) fileCallback.onReceiveValue(null);
        if (webView != null) webView.destroy();
        super.onDestroy();
    }
}
