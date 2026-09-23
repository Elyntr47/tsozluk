package tr.com.tsozluk.demo;

import android.content.Context;
import android.webkit.JavascriptInterface;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;

/** Sözlük verisini (turkce-veri.json) web görünümüne tek seferde veren köprü. */
public class SozlukBridge {

    private final Context ctx;
    private String json;

    public SozlukBridge(Context ctx) {
        this.ctx = ctx;
    }

    @JavascriptInterface
    public String veriJson() {
        if (json == null) {
            try (InputStream is = ctx.getAssets().open("web/turkce-veri.json")) {
                ByteArrayOutputStream b = new ByteArrayOutputStream();
                byte[] buf = new byte[65536];
                int n;
                while ((n = is.read(buf)) > 0) b.write(buf, 0, n);
                json = b.toString("UTF-8");
            } catch (IOException e) {
                json = "[]";
            }
        }
        return json;
    }
}