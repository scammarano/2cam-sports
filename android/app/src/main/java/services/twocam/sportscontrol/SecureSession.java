package services.twocam.sportscontrol;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

final class SecureSession {
    private static final String ALIAS = "2cam.sports.control.session.v1";
    private final SharedPreferences prefs;
    SecureSession(Context context) { prefs = context.getSharedPreferences("private-session", Context.MODE_PRIVATE); }
    private SecretKey key() throws Exception {
        KeyStore ks = KeyStore.getInstance("AndroidKeyStore"); ks.load(null);
        if (ks.containsAlias(ALIAS)) return ((KeyStore.SecretKeyEntry) ks.getEntry(ALIAS, null)).getSecretKey();
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());
        return generator.generateKey();
    }
    void save(String json) throws Exception {
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.ENCRYPT_MODE, key());
        String iv = Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP);
        String ciphertext = Base64.encodeToString(cipher.doFinal(json.getBytes(StandardCharsets.UTF_8)), Base64.NO_WRAP);
        if (!prefs.edit().putString("iv", iv).putString("ciphertext", ciphertext).commit()) throw new Exception("No se pudo guardar el enlace cifrado.");
    }
    String load() throws Exception {
        String iv = prefs.getString("iv", null), text = prefs.getString("ciphertext", null);
        if (iv == null || text == null) return null;
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, Base64.decode(iv, Base64.NO_WRAP)));
        return new String(cipher.doFinal(Base64.decode(text, Base64.NO_WRAP)), StandardCharsets.UTF_8);
    }
    void clear() { prefs.edit().clear().commit(); }
}
