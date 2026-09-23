#!/usr/bin/env bash
# Türkçe Sözlük demo APK derleyicisi (aapt2 + javac --release 11 + d8 + zipalign + apksigner)
set -euo pipefail

KOK="$(cd "$(dirname "$0")" && pwd)"
BT=/home/enes/android-sdk/build-tools/34.0.0
APLAT=/home/enes/android-sdk/platforms/android-34/android.jar
STAGE="$(mktemp -d /tmp/apk-stage.XXXXXX)"
DISTS="$KOK/dists"
mkdir -p "$DISTS"

echo "[1/8] web varlıkları (göreli yollar) hazırlanıyor…"
mkdir -p "$STAGE/assets/web" "$STAGE/gen" "$STAGE/obj" "$STAGE/out"
cp public/index.html public/style.css public/app.js public/veri.js public/surum.json "$STAGE/assets/web/"
cp data/dictionary.json "$STAGE/assets/web/turkce-veri.json"
cp android/widget-secimler.json "$STAGE/assets/"
sed -E 's#(href|src)="/#\1="./#g' -i "$STAGE/assets/web/index.html"

echo "[2/8] aapt2 compile…"
"$BT/aapt2" compile --dir android/res -o "$STAGE/res.zip"

echo "[3/8] aapt2 link…"
"$BT/aapt2" link -o "$STAGE/base.apk" \
  -I "$APLAT" \
  --manifest android/AndroidManifest.xml \
  -R "$STAGE/res.zip" \
  --java "$STAGE/gen" \
  --auto-add-overlay

echo "[4/8] javac --release 11…"
javac --release 11 -classpath "$APLAT" -d "$STAGE/obj" \
  $(find android/java "$STAGE/gen" -name '*.java')

echo "[5/8] d8…"
"$BT/d8" --release --lib "$APLAT" --min-api 24 --output "$STAGE/out" \
  $(find "$STAGE/obj" -name '*.class')

echo "[6/8] apk birleştirme (dex + assets)…"
cp "$STAGE/base.apk" "$DISTS/unsigned.apk"
( cd "$STAGE/out" && zip -q "$DISTS/unsigned.apk" classes.dex )
( cd "$STAGE" && zip -qr "$DISTS/unsigned.apk" assets )

echo "[7/8] zipalign…"
"$BT/zipalign" -f 4 "$DISTS/unsigned.apk" "$DISTS/aligned.apk"

echo "[8/8] apksigner…"
"$BT/apksigner" sign \
  --ks android/tsozluk.keystore \
  --ks-key-alias tsozluk \
  --ks-pass pass:tsozluk123 \
  --key-pass pass:tsozluk123 \
  --out "$DISTS/tsozlukv1.apk" "$DISTS/aligned.apk"
rm -f "$DISTS/unsigned.apk" "$DISTS/aligned.apk"

"$BT/apksigner" verify --print-certs "$DISTS/tsozlukv1.apk"
rm -rf "$STAGE"
echo "tamam: $DISTS/tsozlukv1.apk"