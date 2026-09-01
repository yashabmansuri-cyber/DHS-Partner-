package com.delhi.home.service.dhspartner;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Base64;

import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

final class DhsPrefs {
    private static final String PREF = "dhs_native";
    private static final String KEY_ALIAS = "dhs_partner_secret";
    private static final String EMAIL = "email";
    private static final String PASSWORD = "password";
    private static final String UID = "uid";
    private static final String ONLINE = "online";

    private DhsPrefs() {}

    static void saveCredentials(Context c, String email, String password, String uid) {
        SharedPreferences p = c.getSharedPreferences(PREF, Context.MODE_PRIVATE);
        String encrypted = encrypt(password == null ? "" : password);
        p.edit().putString(EMAIL, email == null ? "" : email)
                .putString(PASSWORD, encrypted)
                .putString(UID, uid == null ? "" : uid)
                .apply();
    }

    static String email(Context c) { return c.getSharedPreferences(PREF, 0).getString(EMAIL, ""); }
    static String uid(Context c) { return c.getSharedPreferences(PREF, 0).getString(UID, ""); }
    static String password(Context c) {
        String v = c.getSharedPreferences(PREF, 0).getString(PASSWORD, "");
        return decrypt(v);
    }
    static void setOnline(Context c, boolean online) {
        c.getSharedPreferences(PREF, 0).edit().putBoolean(ONLINE, online).apply();
    }
    static boolean isOnline(Context c) { return c.getSharedPreferences(PREF, 0).getBoolean(ONLINE, false); }
    static void clear(Context c) { c.getSharedPreferences(PREF, 0).edit().clear().apply(); }

    private static SecretKey getKey() throws Exception {
        KeyStore ks = KeyStore.getInstance("AndroidKeyStore");
        ks.load(null);
        if (ks.containsAlias(KEY_ALIAS)) return ((KeyStore.SecretKeyEntry) ks.getEntry(KEY_ALIAS, null)).getSecretKey();
        KeyGenerator kg = KeyGenerator.getInstance("AES", "AndroidKeyStore");
        kg.init(128);
        return kg.generateKey();
    }

    private static String encrypt(String plain) {
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, getKey());
            byte[] iv = cipher.getIV();
            byte[] data = cipher.doFinal(plain.getBytes(StandardCharsets.UTF_8));
            byte[] out = new byte[iv.length + data.length];
            System.arraycopy(iv, 0, out, 0, iv.length);
            System.arraycopy(data, 0, out, iv.length, data.length);
            return Base64.encodeToString(out, Base64.NO_WRAP);
        } catch (Exception e) { return ""; }
    }

    private static String decrypt(String encoded) {
        if (encoded == null || encoded.isEmpty()) return "";
        try {
            byte[] all = Base64.decode(encoded, Base64.NO_WRAP);
            byte[] iv = new byte[12];
            byte[] data = new byte[all.length - 12];
            System.arraycopy(all, 0, iv, 0, 12);
            System.arraycopy(all, 12, data, 0, data.length);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, getKey(), new GCMParameterSpec(128, iv));
            return new String(cipher.doFinal(data), StandardCharsets.UTF_8);
        } catch (Exception e) { return ""; }
    }
}
