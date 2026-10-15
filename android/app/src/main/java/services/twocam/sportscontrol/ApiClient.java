package services.twocam.sportscontrol;

import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

final class ApiClient {
    static final class Failure extends Exception {
        final int status;
        Failure(int status, String message) { super(message); this.status = status; }
    }
    static String request(String base, String path, String token, JSONObject body, String key) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(base + "/api/v1" + path).openConnection();
        c.setConnectTimeout(4000); c.setReadTimeout(4000); c.setInstanceFollowRedirects(false); c.setUseCaches(false);
        c.setRequestProperty("Accept", "application/json");
        if (token != null && !token.isEmpty()) c.setRequestProperty("Authorization", "Bearer " + token);
        if (key != null) c.setRequestProperty("Idempotency-Key", key);
        try {
            if (body != null) {
                c.setRequestMethod("POST"); c.setDoOutput(true); c.setRequestProperty("Content-Type", "application/json");
                byte[] data = body.toString().getBytes(StandardCharsets.UTF_8); c.setFixedLengthStreamingMode(data.length);
                try (java.io.OutputStream out = c.getOutputStream()) { out.write(data); }
            }
            int status = c.getResponseCode();
            String raw;
            InputStream source = status >= 400 ? c.getErrorStream() : c.getInputStream();
            if (source == null) throw new Failure(status, "El servicio no devolvió datos.");
            try (InputStream in = source; ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                byte[] buffer = new byte[4096]; int n;
                while ((n = in.read(buffer)) != -1) { out.write(buffer, 0, n); if (out.size() > 1048576) throw new Failure(502, "Respuesta demasiado grande."); }
                raw = out.toString(StandardCharsets.UTF_8.name());
            }
            if (status < 200 || status >= 300) {
                String message = "No se pudo completar la operación (" + status + ").";
                try { message = new JSONObject(raw).optString("error", message); } catch (Exception ignored) { }
                throw new Failure(status, message);
            }
            return raw;
        } finally { c.disconnect(); }
    }
}
