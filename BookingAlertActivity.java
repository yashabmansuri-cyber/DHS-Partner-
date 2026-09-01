package com.delhi.home.service.dhspartner;

import android.app.Activity;
import android.app.KeyguardManager;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Bundle;
import android.view.Gravity;
import android.view.Window;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

public class BookingAlertActivity extends Activity {
    private String bookingId;
    @Override protected void onCreate(Bundle b){super.onCreate(b); setupWindow(); build();}
    private void setupWindow(){
        Window w=getWindow();
        if(Build.VERSION.SDK_INT>=27) w.addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED|WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
        else w.addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED|WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD|WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
        w.setStatusBarColor(Color.rgb(6,27,70)); w.setNavigationBarColor(Color.rgb(6,27,70));
    }
    private void build(){
        bookingId=getIntent().getStringExtra(BookingMonitorService.EXTRA_BOOKING_ID);
        String customer=getIntent().getStringExtra("customer"); String service=getIntent().getStringExtra("service"); String address=getIntent().getStringExtra("address");
        LinearLayout root=new LinearLayout(this); root.setOrientation(LinearLayout.VERTICAL); root.setPadding(22,22,22,22); root.setGravity(Gravity.CENTER_HORIZONTAL); root.setBackgroundColor(Color.WHITE);
        TextView brand=t("DHS PARTNER",25,true); brand.setTextColor(Color.rgb(6,27,70)); root.addView(brand,new LinearLayout.LayoutParams(-1,60));
        TextView title=t("🔔  NEW BOOKING",22,true); title.setTextColor(Color.rgb(220,38,38)); root.addView(title,new LinearLayout.LayoutParams(-1,70));
        LinearLayout card=new LinearLayout(this); card.setOrientation(LinearLayout.VERTICAL); card.setPadding(18,18,18,18); GradientDrawable bg=new GradientDrawable(); bg.setColor(Color.rgb(244,248,255)); bg.setCornerRadius(28); card.setBackground(bg);
        card.addView(row("Customer",customer)); card.addView(row("Service",service)); card.addView(row("Address",address)); root.addView(card,new LinearLayout.LayoutParams(-1,-2));
        TextView timer=t("Please accept or reject this booking.",13,false); timer.setTextColor(Color.DKGRAY); timer.setPadding(0,18,0,14); root.addView(timer);
        LinearLayout buttons=new LinearLayout(this); buttons.setOrientation(LinearLayout.HORIZONTAL); buttons.setGravity(Gravity.CENTER); Button reject=btn("Reject",Color.rgb(220,38,38)); Button accept=btn("✓  ACCEPT",Color.rgb(18,169,74)); buttons.addView(reject,weight()); buttons.addView(accept,weight()); root.addView(buttons,new LinearLayout.LayoutParams(-1,64));
        reject.setOnClickListener(v->{sendAction(BookingMonitorService.ACTION_REJECT);}); accept.setOnClickListener(v->{sendAction(BookingMonitorService.ACTION_ACCEPT);}); setContentView(root);
    }
    private TextView row(String k,String v){TextView x=t(k+":  "+(v==null?"":v),15,false);x.setTextColor(Color.rgb(20,32,58));x.setPadding(0,6,0,6);return x;}
    private TextView t(String s,float size,boolean bold){TextView x=new TextView(this);x.setText(s==null?"":s);x.setTextSize(size);x.setGravity(Gravity.CENTER_VERTICAL);x.setTypeface(null,bold?android.graphics.Typeface.BOLD:android.graphics.Typeface.NORMAL);return x;}
    private Button btn(String s,int color){Button b=new Button(this);b.setText(s);b.setTextColor(Color.WHITE);GradientDrawable g=new GradientDrawable();g.setColor(color);g.setCornerRadius(18);b.setBackground(g);return b;}
    private LinearLayout.LayoutParams weight(){LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(0,-1,1);p.setMargins(6,0,6,0);return p;}
    private void sendAction(String action){
        Intent i=new Intent(this,BookingMonitorService.class).setAction(action).putExtra(BookingMonitorService.EXTRA_BOOKING_ID,bookingId); startService(i);
        Intent main=new Intent(this,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP); main.putExtra("bookingId",bookingId).putExtra("action",action); startActivity(main); finish();
    }
}
