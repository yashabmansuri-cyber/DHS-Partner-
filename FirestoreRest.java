package com.delhi.home.service.dhspartner;

import android.util.Base64;
import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.HashMap;

final class FirestoreRest {
    static final String PROJECT = "dhs-delhi-home-service";
    static final String API_KEY = "AIzaSyDyVvKkMdVDfQZEWO4wPl7tPThrlmnqQ";
    static final String AUTH_URL = "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=" + API_KEY;
    static final String REFRESH_URL = "https://securetoken.googleapis.com/v1/token?key=" + API_KEY;
    static final String BASE = "https://firestore.googleapis.com/v1/projects/" + PROJECT + "/databases/(default)/documents/";

    private FirestoreRest() {}

    static JSONObject passwordLogin(String email, String password) throws Exception {
        JSONObject body = new JSONObject().put("email", email).put("password", password).put("returnSecureToken", true);
        return requestJson("POST", AUTH_URL, body.toString(), null);
    }

    static JSONObject refresh(String refreshToken) throws Exception {
        JSONObject body = new JSONObject().put("grant_type", "refresh_token").put("refresh_token", refreshToken);
        return requestJson("POST", REFRESH_URL, body.toString(), "application/x-www-form-urlencoded");
    }

    static List<Map<String, Object>> listDocuments(String collection, String bearer) throws Exception {
        String url = BASE + URLEncoder.encode(collection, "UTF-8") + "?pageSize=100";
        JSONObject root = requestJson("GET", url, null, bearer);
        List<Map<String, Object>> out = new ArrayList<>();
        JSONArray docs = root.optJSONArray("documents");
        if (docs == null) return out;
        for (int i = 0; i < docs.length(); i++) {
            JSONObject d = docs.optJSONObject(i);
            if (d == null) continue;
            Map<String,Object> m = new HashMap<>();
            String name = d.optString("name", "");
            int slash = name.lastIndexOf('/');
            m.put("id", slash >= 0 ? name.substring(slash + 1) : "");
            JSONObject fields = d.optJSONObject("fields");
            if (fields != null) mergeFields(m, fields);
            out.add(m);
        }
        return out;
    }


    static List<Map<String, Object>> queryDocuments(String collection, String field, String value, String bearer) throws Exception {
        String url = BASE + collection + ":runQuery";
        JSONObject valueObj = toFirestoreValue(value);
        JSONObject fieldFilter = new JSONObject().put("fieldFilter", new JSONObject()
                .put("field", new JSONObject().put("fieldPath", field))
                .put("op", "EQUAL")
                .put("value", valueObj));
        JSONObject structured = new JSONObject().put("from", new JSONArray().put(new JSONObject().put("collectionId", collection)))
                .put("where", fieldFilter).put("limit", 100);
        JSONObject body = new JSONObject().put("structuredQuery", structured);
        String raw = requestRaw("POST", url, body.toString(), bearer);
        List<Map<String,Object>> out = new ArrayList<>();
        String[] lines = raw.split("\\r?\\n");
        for(String line:lines){
            if(line.trim().isEmpty()) continue;
            JSONObject row=new JSONObject(line);
            JSONObject d=row.optJSONObject("document"); if(d==null) continue;
            Map<String,Object> m=new HashMap<>(); String name=d.optString("name",""); int slash=name.lastIndexOf('/'); m.put("id",slash>=0?name.substring(slash+1):"");
            JSONObject fields=d.optJSONObject("fields"); if(fields!=null) mergeFields(m,fields); out.add(m);
        }
        return out;
    }

    static void patchDocument(String collection, String id, Map<String,Object> values, String bearer) throws Exception {
        StringBuilder url = new StringBuilder(BASE).append(collection).append('/').append(URLEncoder.encode(id, "UTF-8"));
        boolean first = true;
        for (String key : values.keySet()) {
            url.append(first ? '?' : '&').append("updateMask.fieldPaths=").append(URLEncoder.encode(key, "UTF-8"));
            first = false;
        }
        JSONObject fields = new JSONObject();
        for (Map.Entry<String,Object> e : values.entrySet()) fields.put(e.getKey(), toFirestoreValue(e.getValue()));
        JSONObject body = new JSONObject().put("name", BASE + collection + "/" + id).put("fields", fields);
        requestJson("PATCH", url.toString(), body.toString(), bearer);
    }

    private static void mergeFields(Map<String,Object> out, JSONObject fields) throws Exception {
        Iterator<String> it = fields.keys();
        while (it.hasNext()) {
            String k = it.next();
            out.put(k, fromFirestoreValue(fields.optJSONObject(k)));
        }
    }

    private static Object fromFirestoreValue(JSONObject v) throws Exception {
        if (v == null) return null;
        if (v.has("stringValue")) return v.optString("stringValue", "");
        if (v.has("booleanValue")) return v.optBoolean("booleanValue", false);
        if (v.has("integerValue")) return v.optString("integerValue", "0");
        if (v.has("doubleValue")) return v.optDouble("doubleValue", 0d);
        if (v.has("timestampValue")) return v.optString("timestampValue", "");
        if (v.has("referenceValue")) return v.optString("referenceValue", "");
        if (v.has("nullValue")) return null;
        if (v.has("arrayValue")) return v.optJSONObject("arrayValue");
        if (v.has("mapValue")) return v.optJSONObject("mapValue");
        return "";
    }

    private static JSONObject toFirestoreValue(Object value) throws Exception {
        if (value == null) return new JSONObject().put("nullValue", JSONObject.NULL);
        if (value instanceof Boolean) return new JSONObject().put("booleanValue", value);
        if (value instanceof Integer || value instanceof Long) return new JSONObject().put("integerValue", String.valueOf(value));
        if (value instanceof Number) return new JSONObject().put("doubleValue", ((Number)value).doubleValue());
        return new JSONObject().put("stringValue", String.valueOf(value));
    }

    private static String requestRaw(String method, String urlString, String body, String authOrContentType) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(urlString).openConnection();
        c.setRequestMethod(method); c.setConnectTimeout(10000); c.setReadTimeout(15000); c.setUseCaches(false);
        c.setRequestProperty("Accept", "application/json");
        if (authOrContentType != null) {
            if (authOrContentType.startsWith("Bearer ")) c.setRequestProperty("Authorization", authOrContentType);
            else c.setRequestProperty("Content-Type", authOrContentType);
        }
        if (body != null) { c.setDoOutput(true); if (c.getRequestProperty("Content-Type") == null) c.setRequestProperty("Content-Type", "application/json; charset=UTF-8"); try(OutputStream os=c.getOutputStream()){os.write(body.getBytes(StandardCharsets.UTF_8));} }
        int code=c.getResponseCode(); InputStream is=code>=200&&code<300?c.getInputStream():c.getErrorStream(); StringBuilder sb=new StringBuilder();
        if(is!=null)try(BufferedReader br=new BufferedReader(new InputStreamReader(is,StandardCharsets.UTF_8))){String line;while((line=br.readLine())!=null)sb.append(line);}
        if(code<200||code>=300)throw new Exception("HTTP "+code+": "+sb); return sb.toString();
    }

    private static JSONObject requestJson(String method, String urlString, String body, String authOrContentType) throws Exception {
        String raw=requestRaw(method,urlString,body,authOrContentType); return raw.isEmpty()?new JSONObject():new JSONObject(raw);
    }
