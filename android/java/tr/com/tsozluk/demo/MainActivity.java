package tr.com.tsozluk.demo;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.IOException;
import java.io.InputStream;

public class MainActivity extends Activity {

    private static final String ANA = "file:///android_asset/web/index.html";
    private WebView web;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setLoadWithOverviewMode(false);
        s.setUseWideViewPort(false);
        s.setSupportZoom(false);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setAllowFileAccessFromFileURLs(true);
        s.setAllowUniversalAccessFromFileURLs(true);

        web.setWebViewClient(new VarlikClient(this));

        web.addJavascriptInterface(new SozlukBridge(this), "TSOZUK_BRIDGE");
        setContentView(web);
        web.loadUrl(ANA);
    }

    private static class VarlikClient extends WebViewClient {
        private final MainActivity sayfa;

        VarlikClient(MainActivity sayfa) {
            this.sayfa = sayfa;
        }

        @Override
        public WebResourceResponse shouldInterceptRequest(WebView v, String url) {
            if (url.startsWith("file:///")) {
                String rel = url.substring("file:///".length());
                if (!rel.startsWith("android_asset/")) {
                    try {
                        InputStream in = sayfa.getAssets().open("web/" + rel);
                        return new WebResourceResponse(mime(rel), "utf-8", in);
                    } catch (IOException ignored) {
                    }
                }
            }
            return null;
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView v, String url) {
            if (url.startsWith("file://")) return false;
            try {
                sayfa.startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
            } catch (ActivityNotFoundException ignored) {
            }
            return true;
        }
    }

    private static String mime(String rel) {
        if (rel.endsWith(".css")) return "text/css";
        if (rel.endsWith(".html")) return "text/html";
        if (rel.endsWith(".json")) return "application/json";
        if (rel.endsWith(".js")) return "application/javascript";
        if (rel.endsWith(".svg")) return "image/svg+xml";
        if (rel.endsWith(".png")) return "image/png";
        return "application/octet-stream";
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) {
            web.goBack();
        } else {
            super.onBackPressed();
        }
    }
}