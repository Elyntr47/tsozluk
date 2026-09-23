/* ------------------------------------------------------------------
   Türkçe Sözlük (demo) — istemci tarafı çekirdek (offline / APK)
   Sunucu mantığının birebir JS portu. Web sunucusunda pasif kalır;
   dosya/WebView modunda (file: veya TSOZUK_BRIDGE) aramaları buradan
   karşılar veri, bir kez JSON olarak çözülür.
   ---------------------------------------------------------------- */
(function () {
  'use strict';

  var TURKISH_ALPHABET = 'abcçdefgğhıijklmnoöprsştuüvyz';
  var S = null;
  var words = null;
  var normWords = null;
  var firstLetters = {};
  var HARF = null;
  var ISTAT = null;
  var BILGI = null;
  var TURLER = null;

  function normalize(s) {
    if (!s) return '';
    s = String(s).toLocaleLowerCase('tr');
    s = s.replace(/â/g, 'a').replace(/î/g, 'i').replace(/û/g, 'u');
    s = s.replace(/ğ/g, 'g').replace(/ş/g, 's').replace(/ı/g, 'i');
    s = s.replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ç/g, 'c');
    s = s.replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
    return s;
  }

  function ilkAnlam(e) {
    if (!e || !e.a || !e.a.length) return '';
    return e.a[0].m;
  }

  function pasif() {
    return window.TSOZUK_BRIDGE !== undefined ||
      window.TSOZUK_STATIC === 1 ||
      location.protocol === 'file:';
  }

  function yukle() {
    if (S) return Promise.resolve(S);
    return new Promise(function (res, rej) {
      function isle(ham) {
        S = ham;
        words = S.map(function (e) { return e.k; });
        normWords = words.map(normalize);
        firstLetters = {};
        for (var i = 0; i < words.length; i++) {
          var L = words[i][0].toLocaleLowerCase('tr');
          firstLetters[L] = (firstLetters[L] || 0) + 1;
        }
        HARF = {};
        for (var h = 0; h < TURKISH_ALPHABET.length; h++) {
          HARF[TURKISH_ALPHABET[h]] = firstLetters[TURKISH_ALPHABET[h]] || 0;
        }
        res(S);
      }
      if (window.TSOZUK_BRIDGE) {
        try { isle(JSON.parse(window.TSOZUK_BRIDGE.veriJson())); }
        catch (e) { rej(e); }
      } else {
        fetch('turkce-veri.json').then(function (r) { return r.json(); }).then(isle).catch(rej);
      }
    });
  }

  function exact(q) {
    var nq = normalize(q);
    if (!nq) return [];
    var raw = String(q).toLocaleLowerCase('tr');
    var hits = [];
    for (var i = 0; i < words.length; i++) {
      if (normWords[i] === nq || words[i].toLocaleLowerCase('tr') === raw) hits.push(S[i]);
    }
    return hits;
  }

  function suggest(q, limit) {
    limit = limit || 10;
    var nq = normalize(q);
    if (!nq) return [];
    var raw = String(q).toLocaleLowerCase('tr');
    var aday = [];
    var sira;
    for (var i = 0; i < normWords.length; i++) {
      var w = normWords[i];
      if (words[i].toLocaleLowerCase('tr').startsWith(raw)) sira = 0;
      else if (w.startsWith(nq)) sira = 1;
      else if (w.includes(nq)) sira = 2;
      else continue;
      aday.push([i, sira]);
    }
    aday.sort(function (a, b) { return a[1] - b[1] || a[0] - b[0]; });
    return aday.slice(0, limit).map(function (p) { return words[p[0]]; });
  }

  function suggestWithMeaning(q) {
    return suggest(q).map(function (w) {
      var i = words.indexOf(w);
      var a = '';
      if (i > -1) {
        a = ilkAnlam(S[i]);
        if (a.length > 90) a = a.slice(0, 87) + '…';
      }
      return { k: w, a: a };
    });
  }

  function komsu(q) {
    var nq = normalize(q);
    var i = normWords.indexOf(nq);
    if (i < 0) return { onceki: null, sonraki: null };
    return {
      onceki: i > 0 ? words[i - 1] : null,
      sonraki: i < words.length - 1 ? words[i + 1] : null,
    };
  }

  function levenshtein(a, b) {
    var m = a.length, n = b.length;
    if (!m) return n;
    if (!n) return m;
    var d = [];
    for (var i = 0; i <= m; i++) { d[i] = [i]; }
    for (var j = 0; j <= n; j++) { d[0][j] = j; }
    for (i = 1; i <= m; i++) {
      for (j = 1; j <= n; j++) {
        var c = a[i - 1] === b[j - 1] ? 0 : 1;
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
      }
    }
    return d[m][n];
  }

  function benzerOneri(q, sinir) {
    sinir = sinir || 6;
    var nq = normalize(q);
    var adaylar = [];
    for (var i = 0; i < normWords.length; i++) {
      var w = normWords[i];
      if (!w) continue;
      if (Math.abs(w.length - nq.length) > 2) continue;
      var m = levenshtein(w, nq);
      if (m >= 1 && m <= 2) adaylar.push([i, m]);
    }
    adaylar.sort(function (a, b) { return a[1] - b[1] || a[0] - b[0]; });
    return adaylar.slice(0, sinir).map(function (p) { return words[p[0]]; });
  }

  function desenAra(q, sinir) {
    sinir = sinir || 80;
    var p = String(q || '').toLocaleLowerCase('tr');
    if (!p) return [];
    var kalip = '^';
    var dort = true;
    for (var c = 0; c < p.length; c++) {
      var ch = p[c];
      if (ch === '?') kalip += '[a-zçğıöşüâîû]';
      else if (ch === '*') { kalip += '.*'; dort = false; }
      else { kalip += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&'); if (ch === ' ') dort = false; }
    }
    kalip += '$';
    var re = new RegExp(kalip);
    var sonuc = [];
    for (var i = 0; i < words.length; i++) {
      var w = words[i].toLocaleLowerCase('tr');
      if (!re.test(w)) continue;
      if (dort && !/^[a-zçğıöşüâîû]+$/.test(w)) continue;
      sonuc.push({ k: words[i], a: ilkAnlam(S[i]) });
      if (sonuc.length >= sinir) break;
    }
    return sonuc;
  }

  function istatistikTopla() {
    var B = { toplamKelime: S.length, toplamAnlam: 0, enUzun: null, enKisa: null, enCokAnlam: null, kokenler: {} };
    var minLen = Infinity, minW = '', maxLen = 0, maxW = '', maxA = 0, maxAW = '';
    for (var i = 0; i < S.length; i++) {
      var e = S[i];
      var uz = e.k.length;
      if (uz > maxLen) { maxLen = uz; maxW = e.k; }
      if (uz < minLen) { minLen = uz; minW = e.k; }
      if (e.a.length > maxA) { maxA = e.a.length; maxAW = e.k; }
      B.toplamAnlam += e.a.length;
      var dil = (e.l || '').trim();
      if (dil) {
        var ilk = dil.split(' ')[0];
        B.kokenler[ilk] = (B.kokenler[ilk] || 0) + 1;
      } else {
        B.kokenler['diğer'] = (B.kokenler['diğer'] || 0) + 1;
      }
    }
    B.enUzun = { k: maxW, uzunluk: maxLen };
    B.enKisa = { k: minW, uzunluk: minLen };
    B.enCokAnlam = { k: maxAW, anlam: maxA };
    B.ortalama = (B.toplamAnlam / B.toplamKelime).toFixed(1);
    B.kokenler = Object.keys(B.kokenler).map(function (dil) {
      return { dil: dil, adet: B.kokenler[dil], yuzde: Math.round((B.kokenler[dil] / S.length) * 1000) / 10 };
    }).sort(function (a, b) { return b.adet - a.adet; }).slice(0, 10);
    return B;
  }

  function testUret(adet) {
    if (!adet) adet = 5;
    var kaplar = [];
    var perde = 0;
    while (kaplar.length < adet && perde++ < 5000) {
      var i = Math.floor(Math.random() * S.length);
      if (!S[i].a.length) continue;
      if (kaplar.indexOf(i) > -1) continue;
      kaplar.push(i);
    }
    return kaplar.map(function (idx) {
      var e = S[idx];
      var anlam = e.a[Math.floor(Math.random() * e.a.length)].m || e.a[0].m;
      var sec = [e.k];
      var k = 0;
      while (sec.length < 4 && k++ < 300) {
        var j = Math.floor(Math.random() * S.length);
        var kd = S[j].k;
        if (kd !== e.k && sec.indexOf(kd) === -1) sec.push(kd);
      }
      sec.sort(function () { return Math.random() - 0.5; });
      return { anlam: anlam, secenekler: sec, dogru: e.k };
    });
  }

  function search(q, limit) {
    limit = limit || 20;
    var nq = normalize(q);
    if (!nq) return [];
    var exactHits = exact(q);
    var seen = {};
    exactHits.forEach(function (e) { seen[e.k] = 1; });
    var out = exactHits.slice();
    for (var i = 0; i < normWords.length && out.length < limit; i++) {
      var w = normWords[i];
      if (!w.includes(nq)) continue;
      var entry = S[i];
      if (seen[entry.k]) continue;
      seen[entry.k] = 1;
      out.push(entry);
    }
    return out;
  }

  function letterList(letter, offset, limit) {
    offset = offset || 0;
    limit = limit || 60;
    var nl = String(letter || '').toLocaleLowerCase('tr');
    if (!nl) return { words: [], total: 0, offset: offset, limit: limit };
    var res = [];
    var total = 0;
    for (var i = 0; i < words.length; i++) {
      var L = words[i][0].toLocaleLowerCase('tr');
      if (L === nl) {
        if (total >= offset && res.length < limit) res.push(words[i]);
        total++;
      }
    }
    return { words: res, total: total, offset: offset, limit: limit };
  }

  function apiArama(q) {
    return search(q, 30).map(function (e) {
      return {
        k: e.k, t: e.t, l: e.l,
        ilk: ilkAnlam(e),
        tur: e.a[0] && e.a[0].p,
        sayi: e.a.length,
      };
    });
  }

  /* ---- günün kelimesi (tarihe bağlı, deterministik) ---- */
  function gununKelimesi() {
    var d = new Date();
    var gun = Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 86400000);
    return S[((gun % S.length) + S.length) % S.length];
  }

  /* ---- gelişmiş filtre araması ---- */
  function filtreAra(p) {
    p = p || {};
    var bas = normalize(p.bas || '').replace(/ /g, '');
    var bit = normalize(p.bit || '').replace(/ /g, '');
    var icer = normalize(p.icer || '').replace(/ /g, '');
    var disla = (String(p.disla || '').toLocaleLowerCase('tr').match(/[a-zçğıöşüâîû]/g) || []);
    var kok = String(p.kok || '').trim().toLocaleLowerCase('tr');
    var tur = String(p.tur || '').trim().toLocaleLowerCase('tr');
    var uzmin = parseInt(p.uzmin || '0', 10) || 0;
    var uzmax = parseInt(p.uzmax || '999', 10) || 999;
    var sinir = Math.min(parseInt(p.l || '200', 10) || 200, 500);
    var sonuc = [];
    for (var i = 0; i < words.length && sonuc.length < sinir; i++) {
      var w = words[i];
      var uz = w.length;
      if (uzmin && uz < uzmin) continue;
      if (uzmax < 999 && uz > uzmax) continue;
      if (bas && w.indexOf(bas) !== 0) continue;
      if (bit && w.slice(-bit.length) !== bit) continue;
      if (icer && w.indexOf(icer) === -1) continue;
      if (disla.length) {
        var atla = false;
        for (var d = 0; d < disla.length; d++) {
          if (w.indexOf(disla[d]) !== -1) { atla = true; break; }
        }
        if (atla) continue;
      }
      var e = S[i];
      if (kok && String(e.l || '').toLocaleLowerCase('tr').indexOf(kok) !== 0) continue;
      if (tur) {
        var pt = e.a && e.a[0] && e.a[0].p;
        if (!pt || String(pt).toLocaleLowerCase('tr') !== tur) continue;
      }
      sonuc.push({ k: w, ilk: ilkAnlam(e), tur: e.a && e.a[0] && e.a[0].p, sayi: e.a.length, l: e.l });
    }
    return sonuc;
  }

  function turListesi() {
    if (TURLER) return TURLER;
    var m = {};
    S.forEach(function (e) {
      var p = e.a && e.a[0] && e.a[0].p;
      if (p) m[p] = (m[p] || 0) + 1;
    });
    TURLER = Object.keys(m).sort(function (a, b) { return m[b] - m[a]; }).slice(0, 20);
    return TURLER;
  }

  function kokenListesi() {
    if (!BILGI) BILGI = istatistikTopla();
    return {
      kokenler: BILGI.kokenler.slice(0, 15).map(function (x) { return x.dil; }),
      turler: turListesi(),
    };
  }

  function isle(url) {
    var yol = url.split('?')[0];
    var prm = {};
    (url.split('?')[1] || '').split('&').forEach(function (kv) {
      if (!kv) return;
      var i = kv.indexOf('=');
      var k = decodeURIComponent(kv.slice(0, i));
      var v = decodeURIComponent(kv.slice(i + 1));
      prm[k] = v;
    });
    return yukle().then(function () {
      switch (yol) {
        case '/api/oneri': return suggestWithMeaning(prm.q || '');
        case '/api/kayit': {
          var hits = exact(prm.q || '');
          return { bulgu: hits.length > 0, kayitlar: hits };
        }
        case '/api/ara': {
          var liste = apiArama(prm.q || '');
          return { sonuc: liste, oneri: liste.length ? [] : benzerOneri(prm.q || '') };
        }
        case '/api/desen': return desenAra(prm.q || '', parseInt(prm.l || '80', 10) || 80);
        case '/api/test': return testUret(parseInt(prm.n || '5', 10) || 5);
        case '/api/bilgi': {
          if (!BILGI) BILGI = istatistikTopla();
          return BILGI;
        }
        case '/api/harf': return letterList(prm.h || '', parseInt(prm.o || '0', 10) || 0, parseInt(prm.l || '60', 10) || 60);
        case '/api/harf-sayilari': return HARF;
        case '/api/ozet': {
          if (!ISTAT) {
            var top = 0;
            S.forEach(function (e) { top += e.a.length; });
            ISTAT = { kelime: words.length, anlam: top };
          }
          return { ist: ISTAT, harfs: HARF };
        }
        case '/api/rastgele': return S[Math.floor(Math.random() * S.length)];
        case '/api/istatistik': {
          if (!ISTAT) {
            var tp = 0;
            S.forEach(function (e) { tp += e.a.length; });
            ISTAT = { kelime: words.length, anlam: tp };
          }
          return ISTAT;
        }
        case '/api/komsu': return komsu(prm.q || '');
        case '/api/gunun': return gununKelimesi();
        case '/api/kokenler': return kokenListesi();
        case '/api/filtre': return filtreAra(prm);
        default: throw new Error('bilinmeyen istek: ' + yol);
      }
    });
  }

  if (pasif()) yukle().catch(function () {});

  window.Veri = { pasif: pasif, iste: isle };
})();