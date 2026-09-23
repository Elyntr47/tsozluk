package tr.com.tsozluk.demo;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;

/** Ana ekran widget'ı: rastgele bir kelime + anlamı; dokununca uygulama, ↻ ile yeni kelime. */
public class SozlukWidget extends AppWidgetProvider {

    public static final String YENI = "tr.com.tsozluk.demo.WIDGET_YENI";

    private static JSONArray secimler;

    private static synchronized JSONArray secimler(Context c) {
        if (secimler == null) {
            try (InputStream is = c.getAssets().open("widget-secimler.json")) {
                ByteArrayOutputStream b = new ByteArrayOutputStream();
                byte[] buf = new byte[16384];
                int n;
                while ((n = is.read(buf)) > 0) b.write(buf, 0, n);
                secimler = new JSONArray(b.toString("UTF-8"));
            } catch (Exception e) {
                secimler = new JSONArray();
            }
        }
        return secimler;
    }

    @Override
    public void onUpdate(Context c, AppWidgetManager am, int[] ids) {
        for (int id : ids) guncelle(c, am, id);
    }

    @Override
    public void onReceive(Context c, Intent i) {
        if (YENI.equals(i.getAction())) {
            AppWidgetManager am = AppWidgetManager.getInstance(c);
            int id = i.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
            if (id != AppWidgetManager.INVALID_APPWIDGET_ID) {
                guncelle(c, am, id);
            }
            return;
        }
        super.onReceive(c, i);
    }

    private void guncelle(Context c, AppWidgetManager am, int id) {
        RemoteViews rv = new RemoteViews(c.getPackageName(), R.layout.widget);
        JSONArray sec = secimler(c);
        if (sec.length() > 0) {
            try {
                JSONObject o = sec.getJSONObject((int) (Math.random() * sec.length()));
                rv.setTextViewText(R.id.w_kelime, o.getString("k"));
                rv.setTextViewText(R.id.w_anlam, o.getString("a"));
            } catch (Exception ignored) {
            }
        }

        int genel = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        Intent ac = new Intent(c, MainActivity.class);
        rv.setOnClickPendingIntent(R.id.widget_kok,
                PendingIntent.getActivity(c, 0, ac, genel));

        Intent yen = new Intent(c, SozlukWidget.class);
        yen.setAction(YENI);
        yen.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id);
        rv.setOnClickPendingIntent(R.id.w_yeni,
                PendingIntent.getBroadcast(c, id, yen, genel));

        am.updateAppWidget(id, rv);
    }

    public static void tumunuGuncelle(Context c) {
        AppWidgetManager am = AppWidgetManager.getInstance(c);
        int[] ids = am.getAppWidgetIds(new ComponentName(c, SozlukWidget.class));
        for (int id : ids) {
            ((SozlukWidget) new SozlukWidget()).guncelleLocal(c, am, id);
        }
    }

    private void guncelleLocal(Context c, AppWidgetManager am, int id) {
        guncelle(c, am, id);
    }
}