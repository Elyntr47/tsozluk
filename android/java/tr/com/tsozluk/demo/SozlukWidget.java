package tr.com.tsozluk.demo;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;

/** Ana ekran kısayolu: dokununca uygulamada Yapay zekâ (#/ai) sayfası açılır. */
public class SozlukWidget extends AppWidgetProvider {

    @Override
    public void onUpdate(Context c, AppWidgetManager am, int[] ids) {
        for (int id : ids) guncelle(c, am, id);
    }

    private void guncelle(Context c, AppWidgetManager am, int id) {
        RemoteViews rv = new RemoteViews(c.getPackageName(), R.layout.widget);

        int genel = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        Intent ac = new Intent(c, MainActivity.class);
        ac.putExtra("hash", "#/ai");
        rv.setOnClickPendingIntent(R.id.widget_kok,
                PendingIntent.getActivity(c, 0, ac, genel));

        am.updateAppWidget(id, rv);
    }
}