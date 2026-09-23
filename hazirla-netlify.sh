#!/usr/bin/env bash
# Netlify için statik deploy klasörü üretir.
# Kullanım: bash hazirla-netlify.sh   (proje kökünde)
set -e

WS=$(cd "$(dirname "$0")" && pwd)
OUT="$WS/netlify-deploy"

rm -rf "$OUT"
mkdir -p "$OUT"

# statik mod bayrağı + classik dosyalar
cp "$WS/public/style.css" "$OUT/style.css"
cp "$WS/public/app.js" "$OUT/app.js"
cp "$WS/public/veri.js" "$OUT/veri.js"
cp "$WS/public/surum.json" "$OUT/surum.json"

# index.html'e "TSOZUK_STATIC" bayrağını veri katmanından önce ekle
node -e '
const fs = require("fs");
const src = fs.readFileSync("'"$WS"'/public/index.html", "utf8");
const bayrak = "<script>window.TSOZUK_STATIC=1;</script>\n";
const hedef = src.replace("<script src=\"/veri.js\"></script>i", "/veri.js");
const son = src.replace("<script src=\"/veri.js\">", bayrak + "<script src=\"/veri.js\">");
fs.writeFileSync("'"$OUT"'/index.html", son);
'

# çevrimdışı veri + APK indirme
cp "$WS/data/dictionary.json" "$OUT/turkce-veri.json"
cp "$WS/dists/tsozlukv1.apk" "$OUT/tsozlukv1.apk"

# /api/ai isteklerini Netlify Function'a ilet (200 = proxy/rewrite, POST korunur)
printf '%s\n' '/api/ai /.netlify/functions/ai 200' > "$OUT/_redirects"

echo "hazır: $OUT"
ls -la "$OUT"