package services.twocam.sportscontrol;

import java.net.URI;
import java.util.Locale;

/** No admite credenciales en URL ni redirecciones de autoridad. */
public final class Endpoint {
    private Endpoint() { }
    public static String normalize(String value, boolean laboratory) {
        try {
            String raw = value.trim();
            if (!raw.contains("://")) raw = "http://" + raw;
            URI u = new URI(raw);
            String scheme = u.getScheme().toLowerCase(Locale.ROOT), host = u.getHost();
            if (host == null || u.getUserInfo() != null || u.getQuery() != null || u.getFragment() != null || (u.getPath() != null && !u.getPath().isEmpty() && !u.getPath().equals("/"))) throw new Exception();
            if (!scheme.equals("https") && !scheme.equals("http")) throw new Exception();
            if (u.getPort() == 0 || u.getPort() > 65535) throw new Exception();
            if (scheme.equals("http") && (!laboratory || !isLocal(host))) throw new IllegalArgumentException("HTTP solo está permitido para direcciones LAN en esta APK de prueba. Usa HTTPS para otros servidores.");
            return new URI(scheme, null, host, u.getPort(), null, null, null).toString();
        } catch (IllegalArgumentException e) { throw e; }
        catch (Exception e) { throw new IllegalArgumentException("Indica solo la dirección del servicio, por ejemplo http://192.168.1.20:8787"); }
    }
    private static boolean isLocal(String host) {
        if (host.equalsIgnoreCase("localhost") || host.toLowerCase(Locale.ROOT).endsWith(".local")) return true;
        String[] parts = host.split("\\.");
        if (parts.length != 4) return false;
        int[] ip = new int[4];
        try { for (int i = 0; i < 4; i++) { ip[i] = Integer.parseInt(parts[i]); if (ip[i] < 0 || ip[i] > 255) return false; } } catch (NumberFormatException e) { return false; }
        return ip[0] == 10 || ip[0] == 127 || (ip[0] == 192 && ip[1] == 168) || (ip[0] == 172 && ip[1] >= 16 && ip[1] <= 31) || (ip[0] == 169 && ip[1] == 254);
    }
}
