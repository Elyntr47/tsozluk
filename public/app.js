/* ------------------------------------------------------------------
   Türkçe Sözlük (demo) — uygulama
   Basit tutmaya çalıştım; çoğu şey tek sayfada akıyor.
   ---------------------------------------------------------------- */

(function () {
  'use strict';

  var SURUM = { ad: 'v1.0.11', kod: 111 };
  var APK_ADI = 'tsozlukv1.apk';
  var TEMALAR = {
    acik:  { ad: 'Aydınlık', mbg: '#fffefa', ornek: '#f6f6f4', vurgu: '#0e7a6a' },
    zeytin:{ ad: 'Zeytin', mbg: '#f7f7ee', ornek: '#ccd6a8', vurgu: '#5f7330' },
    kahve: { ad: 'Kahve', mbg: '#f8f2ea', ornek: '#e2cbb6', vurgu: '#8a5334' },
    gul:   { ad: 'Gül', mbg: '#fdf5f6', ornek: '#f2c3d0', vurgu: '#c0476b' },
    buz:   { ad: 'Buz Mavisi', mbg: '#f2f7fc', ornek: '#bcd7ef', vurgu: '#2e7bc4' },
    gumus: { ad: 'Gümüş', mbg: '#f4f5f6', ornek: '#c9cdd2', vurgu: '#5b6673' },
    koyu:  { ad: 'Koyu', mbg: '#12161d', ornek: '#233043', vurgu: '#3fc3ae' },
    orman: { ad: 'Orman', mbg: '#0d1512', ornek: '#1e3a2c', vurgu: '#5fd08a' },
    mor:   { ad: 'Mor Gece', mbg: '#140f22', ornek: '#32266b', vurgu: '#b48cff' },
    gunbat:{ ad: 'Gün Batımı', mbg: '#1a1210', ornek: '#4a2417', vurgu: '#ff9d5c' },
    siyah: { ad: 'Siyah & Gri', mbg: '#0a0a0c', ornek: '#24272c', vurgu: '#a8b3bd' },
    gece:  { ad: 'Gece Mavisi', mbg: '#0a1120', ornek: '#0f2242', vurgu: '#5b9dff' }
  };

  function ayarOku(key, dflt) {
    try { var v = localStorage.getItem('tsozluk:' + key); return v === null ? dflt : v; }
    catch (e) { return dflt; }
  }
  function ayarYaz(key, val) {
    try { localStorage.setItem('tsozluk:' + key, val); } catch (e) {}
  }

  var TEMA_SIRA = ['acik', 'zeytin', 'kahve', 'gul', 'buz', 'gumus', 'koyu', 'orman', 'mor', 'gunbat', 'siyah', 'gece'];
  function temaSanat(t) { return TEMALAR[t] ? t : 'acik'; }
  function temaOku() {
    try {
      var t = localStorage.getItem('tsozluk:tema');
      if (t) return temaSanat(t);
      return (localStorage.getItem('tsozluk:mod') === 'koyu') ? 'koyu' : 'acik';
    } catch (e) { return 'acik'; }
  }
  function sistemTemaAktif() { return ayarOku('sistemTema', '0') === '1'; }
  function autoTema() {
    try { return (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'koyu' : 'acik'; }
    catch (e) { return 'acik'; }
  }
  function temaKur(t) {
    t = temaSanat(t || temaOku());
    var el = document.documentElement;
    Object.keys(TEMALAR).forEach(function (k) { if (k !== 'acik') el.classList.remove(k); });
    if (t !== 'acik') el.classList.add(t);
    el.setAttribute('data-tema', t);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', TEMALAR[t].mbg);
    return t;
  }
  function temaUygulaAkilli() { temaKur(sistemTemaAktif() ? autoTema() : temaOku()); }

  try { temaUygulaAkilli(); } catch (e) {}
  try {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    var mqFn = function () { if (sistemTemaAktif()) temaKur(autoTema()); };
    if (mq.addEventListener) mq.addEventListener('change', mqFn); else if (mq.addListener) mq.addListener(mqFn);
  } catch (e) {}

  var $app = document.getElementById('app');
  var $input = document.getElementById('searchInput');
  var $btn = document.getElementById('searchBtn');
  var $clear = document.getElementById('searchClear');
  var $suggest = document.getElementById('suggest');
  var $sonOneri = document.getElementById('sonOneri');

  var oneriTimer = null;
  var aktifSicak = -1;
  var oneriler = [];

  /* ---- küçük yardımcılar ---- */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

function getJSON(url) {
  if (window.Veri && window.Veri.pasif()) return window.Veri.iste(url);
  return fetch(url).then(function (r) { return r.json(); });
}

  function vurgula(metin, q) {
    var a = esc(metin);
    var b = esc(q);
    if (!b) return a;
    return a.replace(new RegExp('(' + b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'), '<mark>$1</mark>');
  }

  /* ---- sonraki/önceki yönünü alma (localStorage) ---- */
  function oku(anahtar) {
    try { return JSON.parse(localStorage.getItem('tsozluk:' + anahtar) || '[]'); }
    catch (e) { return []; }
  }
  function yaz(anahtar, deger) {
    try { localStorage.setItem('tsozluk:' + anahtar, JSON.stringify(deger)); } catch (e) {}
  }

  function favoriler() { return oku('fav'); }
  function sonAramalar() { return oku('son'); }

  function favoriEkle(kelime) {
    var f = favoriler();
    if (f.indexOf(kelime) === -1) f.unshift(kelime);
    yaz('fav', f);
  }
  function favoriSil(kelime) {
    yaz('fav', favoriler().filter(function (k) { return k !== kelime; }));
  }
  function favoriMi(kelime) { return favoriler().indexOf(kelime) !== -1; }

  function sonAra(kelime) {
    var s = sonAramalar().filter(function (k) { return k !== kelime; });
    s.unshift(kelime);
    yaz('son', s.slice(0, 8));
  }

  try { gozdenGecir(); } catch (e) {}

  /* ---- notlar (görev listeleri, yapılacaklar / yapıldı) ---- */
  function notlar() { return oku('notlar'); }
  function notlarYaz(l) { yaz('notlar', l); }
  function notBul(ad) {
    return notlar().filter(function (x) { return x.ad === ad; })[0] || null;
  }
  function gozdenGecir() {
    try {
      if (localStorage.getItem('tsozluk:defterler')) {
        var eski = JSON.parse(localStorage.getItem('tsozluk:defterler'));
        if (eski && eski.length && !notlar().length) {
          notlarYaz(eski.map(function (d) {
            return {
              ad: d.ad,
              maddeler: (d.kelimeler || []).map(function (w) { return { m: w.k, y: 1 }; })
            };
          }));
          localStorage.removeItem('tsozluk:defterler');
        } else if (!eski || !eski.length) {
          localStorage.removeItem('tsozluk:defterler');
        }
      }
    } catch (e) {}
  }
  function notEkle(ad) {
    ad = String(ad || '').trim();
    if (!ad) return null;
    if (notBul(ad)) return ad;
    var l = notlar();
    l.push({ ad: ad, maddeler: [] });
    notlarYaz(l);
    return ad;
  }
  function notMaddeEkle(ad, m) {
    m = String(m || '').trim();
    if (!m) return;
    var l = notlar();
    var d = l.filter(function (x) { return x.ad === ad; })[0];
    if (!d) return;
    d.maddeler.push({ m: m, y: 0 });
    notlarYaz(l);
  }
  function notMaddeDurum(ad, sira, y) {
    var l = notlar();
    var d = l.filter(function (x) { return x.ad === ad; })[0];
    if (!d || !d.maddeler[sira]) return;
    d.maddeler[sira].y = y ? 1 : 0;
    notlarYaz(l);
  }
  function notMaddeSil(ad, sira) {
    var l = notlar();
    var d = l.filter(function (x) { return x.ad === ad; })[0];
    if (!d) return;
    d.maddeler.splice(sira, 1);
    notlarYaz(l);
  }
  function notTamamlananlariSil(ad) {
    var l = notlar();
    var d = l.filter(function (x) { return x.ad === ad; })[0];
    if (!d) return;
    d.maddeler = d.maddeler.filter(function (x) { return !x.y; });
    notlarYaz(l);
  }
  function notSil(ad) {
    notlarYaz(notlar().filter(function (x) { return x.ad !== ad; }));
  }

  /* ---- ikonlar (elin yazdığı kadar) ---- */
  var YILDIZ = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M12 2.8l2.8 5.8 6.4 1-4.6 4.5 1.1 6.4L12 17.6 6.3 20.5l1.1-6.4-4.6-4.5 6.4-1z"/></svg>';
  var NOT_IKON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="3.5" width="16" height="17.5" rx="2.5"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>';

  /* ----
   * Rota
   * - */
  var temaBtn = document.getElementById('temaBtn');
  function temaDegistir() {
    ayarYaz('sistemTema', '0');
    var idx = TEMA_SIRA.indexOf(temaOku());
    var yeni = TEMA_SIRA[(idx + 1) % TEMA_SIRA.length];
    temaKur(yeni);
    ayarYaz('tema', yeni);
  }
  if (temaBtn) temaBtn.addEventListener('click', temaDegistir);
  try {
    var ve = document.getElementById('versiyonEtiketi');
    if (ve) ve.textContent = SURUM.ad;
  } catch (e) {}

  /* ---- sayfa yönlendirme ---- */
  function parseHash() {
    var h = location.hash.replace(/^#\//, '') || '';
    if (!h) return { sayfa: 'anayasa' };
    var parcalar = h.split('/');
    if (parcalar[0] === 'kelime') return { sayfa: 'kelime', q: decodeURIComponent(parcalar[1] || '') };
    if (parcalar[0] === 'ara') return { sayfa: 'ara', q: decodeURIComponent(parcalar[1] || '') };
    if (parcalar[0] === 'harf') return { sayfa: 'harf', h: decodeURIComponent(parcalar[1] || ''), o: parseInt(parcalar[2] || '0', 10) };
    if (parcalar[0] === 'rastgele') return { sayfa: 'rastgele' };
    if (parcalar[0] === 'harfler') return { sayfa: 'harfler' };
    if (parcalar[0] === 'hakkimda') return { sayfa: 'hakkimda' };
    if (parcalar[0] === 'desen') return { sayfa: 'desen', q: decodeURIComponent(parcalar[1] || '') };
    if (parcalar[0] === 'test') return { sayfa: 'test' };
    if (parcalar[0] === 'istatistik') return { sayfa: 'istatistik' };
    if (parcalar[0] === 'filtre') return { sayfa: 'filtre' };
    if (parcalar[0] === 'notlar') {
      if (parcalar[1]) return { sayfa: 'notListe', ad: decodeURIComponent(parcalar[1]) };
      return { sayfa: 'notlar' };
    }
    if (parcalar[0] === 'defter') return { sayfa: 'notlar' };
    if (parcalar[0] === 'ai' || parcalar[0].indexOf('ai?') === 0) return { sayfa: 'ai' };
    if (parcalar[0] === 'ayarlar') return { sayfa: 'ayarlar' };
    return { sayfa: 'anayasa' };
  }

  function route() {
    var r = parseHash();
    window.scrollTo(0, 0);
    if (window.location.hash.indexOf('#/defter') === 0) {
      try { history.replaceState(null, '', window.location.pathname + '#/notlar'); } catch (e) {}
    }
    if (r.sayfa === 'kelime') return renderKelime(r.q);
    if (r.sayfa === 'ara') return renderAra(r.q);
    if (r.sayfa === 'harf') return renderHarf(r.h, r.o);
    if (r.sayfa === 'rastgele') return renderRastgele();
    if (r.sayfa === 'harfler') return renderHarfler();
    if (r.sayfa === 'hakkimda') return renderHakkinda();
    if (r.sayfa === 'desen') return renderDesen(r.q);
    if (r.sayfa === 'test') return renderTest();
    if (r.sayfa === 'istatistik') return renderIstatistik();
    if (r.sayfa === 'filtre') return renderFiltre();
    if (r.sayfa === 'notlar') return renderNotlar();
    if (r.sayfa === 'notListe') return renderNotListesi(r.ad);
    if (r.sayfa === 'ai') return renderAi();
    if (r.sayfa === 'ayarlar') return renderAyarlar();
    document.title = 'Türkçe Sözlük — Demo';
    return renderAnayasa();
  }

  function yukleniyor(mesaj) {
    $app.innerHTML = '<div class="spinner">' + esc(mesaj || 'Yükleniyor…') + '</div>';
  }

  function geriSatir() {
    return '<div class="back-row"><button class="back-link" onclick="history.back()">&lsaquo; geri</button></div>';
  }

  /* ---------- Ana sayfa ---------- */
  function apkTespit() {
    return window.TSOZUK_BRIDGE !== undefined || location.protocol === 'file:';
  }

  function apkButonu() {
    if (apkTespit()) {
      return '<p class="hint">Şu an mobil uygulamanın içindesiniz. Ana ekrana uzun basın → Aletler → Türkçe Sözlük ile widget ekleyebilirsiniz.</p>';
    }
    return '<a class="btn" href="/' + APK_ADI + '" download="turkce-sozluk.apk">APK İndir &middot; ~4,1 MB</a>';
  }

  function gununHtml(g) {
    var tel = g.t ? ' [' + esc(g.t) + ']' : '';
    var lisan = g.l ? '<span class="badge origin">' + esc(g.l) + '</span>' : '';
    var anlam = (g.a && g.a.length) ? esc(g.a[0].m) : '';
    var ornek = '';
    if (g.a && g.a[0] && g.a[0].o && g.a[0].o[0]) {
      ornek = g.a[0].o[0].split('\u0001')[1] || g.a[0].o[0];
    }
    return '<div class="card gunun-card">' +
      '<div class="gunun-ust"><span class="badge">Günün kelimesi</span>' +
      '<a class="back-link" href="#/rastgele" title="Rastgele başka bir kelime">&harr; başka</a></div>' +
      '<a class="gunun-word" href="#/kelime/' + encodeURIComponent(g.k) + '">' + esc(g.k) + tel + '</a>' +
      '<p class="gunun-anlam">' + anlam + '</p>' +
      (ornek ? '<p class="example">&ldquo;' + esc(ornek) + '&rdquo;</p>' : '') +
      '<div class="gunun-alt">' + lisan +
      '<a class="back-link" href="#/kelime/' + encodeURIComponent(g.k) + '">tamamına bak &rsaquo;</a></div>' +
      '</div>';
  }

  function renderAnayasa() {
    yukleniyor('Hazırlanıyor…');
    Promise.all([getJSON('/api/ozet'), getJSON('/api/gunun')]).then(function (r) {
      var s = r[0], gunun = r[1];
      var ist = s.ist, harfs = s.harfs;
      document.title = 'Türkçe Sözlük — Demo';

      var tim = '';
      for (var a in harfs) {
        if (Object.prototype.hasOwnProperty.call(harfs, a)) {
          tim += '<a class="letter-tile" href="#/harf/' + encodeURIComponent(a) + '">' +
                 '<span class="harf">' + esc(a.toLocaleUpperCase('tr')) + '</span>' +
                 '<small>' + harfs[a].toLocaleString('tr-TR') + '</small></a>';
        }
      }

      var son = sonAramalar();
      var sonHtml = son.length
        ? '<div class="chip-row" id="sonChip">' +
          son.map(function (k) { return '<a class="chip" href="#/kelime/' + encodeURIComponent(k) + '">' + esc(k) + '</a>'; }).join('') +
          '<button class="chip-clear" id="sonTemizle" title="temizle">&times;</button></div>'
        : '<p class="hint">Şu an yok. Aradığınız kelimeler burada kalır.</p>';

      var fav = favoriler();
      var favHtml = fav.length
        ? '<div class="chip-row"><strong style="color:var(--amber)">' + YILDIZ + '</strong>' +
          fav.map(function (k) { return '<a class="chip" href="#/kelime/' + encodeURIComponent(k) + '">' + esc(k) + '</a>'; }).join('') +
          '</div>'
        : '<p class="hint">Kelime sayfasındaki yıldıza basınca favorilerinize eklenir.</p>';

      $app.innerHTML =
        '<div class="hero">' +
        '<h1>Türkçe <em>Sözlük</em></h1>' +
        '<p class="tagline">Günlük dilde geçen Türkçe kelimelerin anlamını, kökenini ve örnek kullanımlarını bulabilirsiniz.</p>' +
        '<div class="stat-row">' +
        '<span class="stat"><b>' + ist.kelime.toLocaleString('tr-TR') + '</b> madde</span>' +
        '<span class="stat"><b>' + ist.anlam.toLocaleString('tr-TR') + '</b> anlam</span>' +
        '<span class="stat"><em class="betik">demo sürümdür, hatalar olabilir</em></span>' +
        '</div>' +
        '<div class="hero-chips">' +
        '<span class="hc-etiket">deneyin:</span>' +
        ['sevgi', 'umut', 'yıldız', 'gönül', 'kitap'].map(function (k) {
          return '<a class="hc-chip" href="#/kelime/' + encodeURIComponent(k) + '">' + esc(k) + '</a>';
        }).join('') +
        '</div>' +
        '</div>' +

        '<section class="home-section" id="bolum-gunun">' + gununHtml(gunun) + '</section>' +

        '<section class="home-section" id="bolum-apk">' +
        '<h2>Telefona kur</h2>' +
        '<p class="hint">Android için hazır uygulama. Kurulunca sözlük çevrimdışı çalışır; ana ekrana kelime aleti (widget) ekleyebilirsiniz. Bilinmeyen kaynak izni istenebilir.</p>' +
        apkButonu() +
        '</section>' +

        '<section class="home-section" id="bolum-son">' +
        '<h2>Son aramalarım</h2>' + sonHtml +
        '</section>' +

        '<section class="home-section" id="bolum-fav">' +
        '<h2>Favorilerim</h2>' + favHtml +
        '</section>' +

        '<section class="home-section" id="bolum-desen">' +
        '<h2>Bulmaca araması</h2>' +
        '<p class="hint">Bilmediğiniz harfler için <b>&#63;</b> (tek harf) ya da <b>&#42;</b> (her sayıda harf) koyun; bildiğiniz harfleri yerine yazın.</p>' +
        '<form id="desenForm" class="desen-form">' +
        '<input id="desenInp" class="desen-input" placeholder="ör. k?t?p, a??k, *çe" autocomplete="off" spellcheck="false">' +
        '<button type="submit" class="btn">Bul</button></form>' +
        '<div class="chip-row">' +
        '<button type="button" class="chip demo" data-desen="k?t?p">k?t?p</button>' +
        '<button type="button" class="chip demo" data-desen="a??k">a??k</button>' +
        '<button type="button" class="chip demo" data-desen="*çe">*çe</button>' +
        '</div>' +
        '<p class="hint"><a href="#/filtre">Ayrıntılı filtrelerle arama yapın &rsaquo;</a></p>' +
        '</section>' +

        '<section class="home-section" id="bolum-harf">' +
        '<h2>Başlangıç harfine göre</h2>' +
        '<div class="letter-grid">' + tim + '</div>' +
        '</section>';

      var st = document.getElementById('sonTemizle');
      if (st) st.onclick = function () { yaz('son', []); renderAnayasa(); };

      var df = document.getElementById('desenForm');
      if (df) df.onsubmit = function (ev) {
        ev.preventDefault();
        var v = df.querySelector('input').value.trim();
        if (v) location.hash = '#/desen/' + encodeURIComponent(v);
      };
      document.querySelectorAll('.chip.demo').forEach(function (b) {
        b.onclick = function () {
          location.hash = '#/desen/' + encodeURIComponent(b.getAttribute('data-desen'));
        };
      });
    }).catch(function () {
      $app.innerHTML = '<div class="card not-found"><p class="hint">Sunucuya ulaşılamadı.</p></div>';
    });
  }

  /* ---------- Kelime sayfası ---------- */
  function anlamSatirlari(b, baslangic) {
    return b.map(function (a, i) {
      var ornekler = (a.o && a.o.length) ? a.o.map(function (orn) {
        var p = orn.split('\u0001');
        var yazar = p[0] ? '<span class="yazar">— ' + esc(p[0]) + '</span>' : '';
        return '<p class="example">&ldquo;' + esc(p[1] || orn) + '&rdquo;' + yazar + '</p>';
      }).join('') : '';
      return '<div class="meaning-row">' +
        '<span class="meaning-num">' + (baslangic + i) + '.</span>' +
        '<div class="meaning-body">' +
        (a.p ? '<span class="pos-tag">' + esc(a.p) + '</span>' : '') + esc(a.m) + ornekler +
        '</div></div>';
    }).join('');
  }

  function kelimeKarti(e, numara) {
    var tel = e.t ? '<span class="telaffuz">[' + esc(e.t) + ']</span>' : '';
    var lisan = e.l ? '<span class="badge origin">' + esc(e.l) + '</span>' : '';
    var ek = e.y ? '<span class="badge">' + esc(e.y) + '</span>' : '';
    var fav = favoriMi(e.k) ? ' on' : '';
    return '<div class="card">' +
      '<div class="word-head">' +
      '<div>' +
      '<div class="word-title"><h2>' + esc(e.k) + '</h2>' + tel + '</div>' +
      '<div class="word-meta">' + ek + lisan + '</div>' +
      '</div>' +
      '<div class="word-act">' +
      '<button class="w-btn not-btn" data-k="' + esc(e.k) + '" title="notlara ekle" aria-label="notlara ekle">' + NOT_IKON + '</button>' +
      '<button class="fav-btn' + fav + '" data-fav="' + esc(e.k) + '" title="favori" aria-label="favori">' + YILDIZ + '</button>' +
      '</div>' +
      '</div>' +
      anlamSatirlari(e.a, 1) +
      '</div>';
  }

  function renderKelime(q) {
    yukleniyor('&ldquo;' + esc(q) + '&rdquo; aranıyor…');
    getJSON('/api/kayit?q=' + encodeURIComponent(q)).then(function (d) {
      if (!d.bulgu || !d.kayitlar.length) {
        document.title = q + ' — Türkçe Sözlük';
        return renderAra(q);
      }
      sonAra(q);
      var varSayi = d.kayitlar.length;
      var html = geriSatir() + d.kayitlar.map(function (e) {
        return varSayi > 1
          ? '<p class="hint" style="margin:6px 0 -6px">' + varSayi + ' ayrı kayıt bulundu.</p>' + kelimeKarti(e)
          : kelimeKarti(e);
      }).join('') +
      '<p class="hint ai-gir">AI ile bu konu hakkında konuşmak ister misin? ' +
      '<a href="#/ai?kelime=' + encodeURIComponent(q) + '">Yapay zekâya sor &rsaquo;</a></p>';
      return getJSON('/api/komsu?q=' + encodeURIComponent(q)).then(function (g) {
        var sol = g.onceki
          ? '<a href="#/kelime/' + encodeURIComponent(g.onceki) + '"><span class="boos">önceki</span><span class="k">&lsaquo; ' + esc(g.onceki) + '</span></a>'
          : '<span></span>';
        var sag = g.sonraki
          ? '<a href="#/kelime/' + encodeURIComponent(g.sonraki) + '"><span class="boos">sonraki</span><span class="k">' + esc(g.sonraki) + ' &rsaquo;</span></a>'
          : '<span></span>';
        var card = d.kayitlar.length === 1
          ? '<div class="komsu-nav">' + sol + sag + '</div>'
          : '';
        $app.innerHTML = html + card;
        $input.value = q;
        document.title = d.kayitlar[0].k + ' — Türkçe Sözlük';
      });
    }).catch(function () {
      $app.innerHTML = '<div class="card not-found"><p class="hint">Sunucuya ulaşılamadı.</p></div>';
    });
  }

  /* ---------- Arama sonuçları ---------- */
  function renderAra(q) {
    if (!q) return renderAnayasa();
    sonAra(q);
    yukleniyor('&ldquo;' + esc(q) + '&rdquo; aranıyor…');
    getJSON('/api/ara?q=' + encodeURIComponent(q)).then(function (res) {
      document.title = q + ' — Türkçe Sözlük';
      var liste = res.sonuc || [];
      if (!liste.length) {
        var oneriChip = res.oneri && res.oneri.length
          ? '<p class="hint">Aranan bulunamadı. Şunlardan birini mi arıyordunuz?</p>' +
            '<div class="chip-row">' +
            res.oneri.map(function (k) {
              return '<a class="chip" href="#/kelime/' + encodeURIComponent(k) + '">' + esc(k) + '</a>';
            }).join('') + '</div>'
          : '';
        var sonChip = sonAramalar().length
          ? '<p class="hint">Ya da son aramalarınızdan birine göz atın:</p>' +
            '<div class="chip-row">' +
            sonAramalar().slice(0, 8).map(function (k) {
              return '<a class="chip" href="#/kelime/' + encodeURIComponent(k) + '">' + esc(k) + '</a>';
            }).join('') + '</div>'
          : '';
        $app.innerHTML = geriSatir() + '<div class="card not-found"><h2 class="baslik">bulunamadı</h2>' +
          '<p class="hint">Yazımı bir daha kontrol edin ya da başka bir kelime deneyin. <a href="#/filtre">Ayrıntılı filtreyle aramayı deneyin &rsaquo;</a></p>' +
          oneriChip + sonChip + '</div>';
        return;
      }
      var html = geriSatir() + '<div class="card arama-kart">' +
        '<div class="arama-ust">' +
        '<h1 class="sayfa-baslik">' + esc(q) + '</h1>' +
        '<span class="badge arama-sayi">' + liste.length + ' kayıt</span>' +
        '</div>' +
        '<p class="hint arama-alt">içinde &ldquo;' + esc(q) + '&rdquo; geçen kayıtlar' +
        ' &middot; <a href="#/filtre">filtrelerle daralt</a> &middot; <a href="#/ai">AI&rsquo;a sor</a></p>';
      liste.forEach(function (e) {
        html += '<a class="result-item" href="#/kelime/' + encodeURIComponent(e.k) + '">' +
          '<div class="rt"><b>' + vurgula(e.k, q) + '</b>' +
          (e.t ? '<span class="ry">[' + esc(e.t) + ']</span>' : '') +
          (e.sayi > 1 ? '<span class="badge">' + e.sayi + ' anlam</span>' : '') +
          '</div>' +
          (e.ilk ? '<p class="rm">' + vurgula(e.ilk, q) + '</p>' : '') +
          '</a>';
      });
      html += '</div>';
      $app.innerHTML = html;
    }).catch(function () {
      $app.innerHTML = '<div class="card not-found"><p class="hint">Sunucuya ulaşılamadı.</p></div>';
    });
  }

  /* ---------- Harf sayfası ---------- */
  function harfCubuk(aktif) {
    var harfler = 'abcçdefgğhıijklmnoöprsştuüvyz';
    var html = '';
    for (var i = 0; i < harfler.length; i++) {
      var a = harfler[i];
      html += '<a href="#/harf/' + encodeURIComponent(a) + '"' + (a === aktif ? ' class="active"' : '') + '>' +
        esc(a.toLocaleUpperCase('tr')) + '</a>';
    }
    return '<div class="letter-nav">' + html + '</div>';
  }

  function harfGovde(harf, d) {
    if (!d.words.length) return '<div class="card not-found"><p class="hint">Bu harfle kayıt yok.</p></div>';
    var per = Math.max(d.limit, 1);
    var once = d.offset > 0
      ? '<a class="back-link" href="#/harf/' + encodeURIComponent(harf) + '/' + Math.max(0, d.offset - per) + '">&lsaquo; önceki</a>'
      : '';
    var sonra = d.offset + d.words.length < d.total
      ? '<a class="back-link" href="#/harf/' + encodeURIComponent(harf) + '/' + (d.offset + per) + '">sonraki &rsaquo;</a>'
      : '';
    var html = '<div class="card"><ul class="word-list">';
    d.words.forEach(function (w) {
      html += '<li><a href="#/kelime/' + encodeURIComponent(w) + '">' + esc(w) + '</a></li>';
    });
    html += '</ul>' +
      '<div class="pager">' + once + '<span class="hint">' + (d.offset + 1) + '–' + (d.offset + d.words.length) +
      ' / ' + d.total.toLocaleString('tr-TR') + '</span>' + sonra + '</div></div>';
    return html;
  }

  function renderHarf(h, offset) {
    var o = offset || 0;
    yukleniyor(h ? (h.toLocaleUpperCase('tr') + ' harfi yükleniyor…') : '…');
    getJSON('/api/harf?h=' + encodeURIComponent(h) + '&o=' + o + '&l=90').then(function (d) {
      document.title = h.toLocaleUpperCase('tr') + ' — Türkçe Sözlük';
      $app.innerHTML = geriSatir() + '<h1 class="sayfa-baslik">' +
        esc(h.toLocaleUpperCase('tr')) + '</h1>' + harfCubuk(h) + harfGovde(h, d);
    }).catch(function () {
      $app.innerHTML = '<div class="card not-found"><p class="hint">Sunucuya ulaşılamadı.</p></div>';
    });
  }

  /* ---------- Harfler (özet) ---------- */
  function harfGrafik(harfs) {
    var max = 1;
    for (var a in harfs) { if (harfs[a] > max) max = harfs[a]; }
    var html = '<div class="bar-chart" role="img" aria-label="Harflere göre kelime sayıları">';
    for (var b in harfs) {
      if (!Object.prototype.hasOwnProperty.call(harfs, b)) continue;
      var px = Math.round((harfs[b] / max) * 130);
      html += '<a class="bar" href="#/harf/' + encodeURIComponent(b) + '" title="' +
        esc(b.toLocaleUpperCase('tr')) + ' — ' + harfs[b].toLocaleString('tr-TR') + ' kelime">' +
        '<span class="c"><i style="height:' + Math.max(px, 3) + 'px"></i></span>' +
        '<span class="harf">' + esc(b.toLocaleUpperCase('tr')) + '</span></a>';
    }
    html += '</div>';
    return html;
  }

  function renderHarfler() {
    yukleniyor('Yükleniyor…');
    getJSON('/api/ozet').then(function (s) {
      var harfs = s.harfs;
      document.title = 'Harfler — Türkçe Sözlük';
      var tim = '';
      for (var a in harfs) {
        if (Object.prototype.hasOwnProperty.call(harfs, a)) {
          tim += '<a class="letter-tile" href="#/harf/' + encodeURIComponent(a) + '">' +
                 '<span class="harf">' + esc(a.toLocaleUpperCase('tr')) + '</span>' +
                 '<small>' + harfs[a].toLocaleString('tr-TR') + '</small></a>';
        }
      }
      $app.innerHTML = geriSatir() + '<h1 class="sayfa-baslik">Harfler</h1>' +
        '<div class="card"><p class="hint">Her harfle kaç kayıt olduğu. Sütuna tıklayınca o harfin kelimeleri açılır.</p>' +
        harfGrafik(harfs) + '</div>' +
        '<div class="letter-grid">' + tim + '</div>';
    }).catch(function () {
      $app.innerHTML = '<div class="card not-found"><p class="hint">Sunucuya ulaşılamadı.</p></div>';
    });
  }

  /* ---------- Rastgele ---------- */
  function renderRastgele() {
    yukleniyor('Rastgele bir kelime seçiliyor…');
    getJSON('/api/rastgele').then(function (e) {
      $app.innerHTML = '<p style="text-align:left;margin:0 0 10px"><a class="back-link" href="#/rastgele">&harr; başka bir kelime</a></p>' +
        kelimeKarti(e);
      $input.value = e.k;
      document.title = e.k + ' — Türkçe Sözlük';
    }).catch(function () {
      $app.innerHTML = '<div class="card not-found"><p class="hint">Sunucuya ulaşılamadı.</p></div>';
    });
  }

  /* ---------- Hakkında ---------- */
  function renderHakkinda() {
    yukleniyor('Yükleniyor…');
    getJSON('/api/istatistik').then(function (ist) {
      document.title = 'Hakkında — Türkçe Sözlük';
      $app.innerHTML = geriSatir() +
        '<div class="card about">' +
        '<h2>Hakkında</h2>' +
        '<div class="about-warn"><b>Önemli:</b> Bu bir demo sürümdür ve içinde hatalar olabilir. Kelime, anlam ya da köken bilgisi eksik veya yanlış bulunabilir; resmî kullanım için <a href="https://sozluk.gov.tr/" target="_blank" rel="noopener">sozluk.gov.tr</a> adresini kullanın.</div>' +
        '<p>Bu sözlük, Türkçeye merak salan biri için hazırlanmış küçük bir proje. Amacı günlük dilde karşımıza çıkan kelimelerin anlamına hızlıca göz atmak. Türk Dil Kurumu ile resmî bir bağı yoktur.</p>' +
        '<h3>Veri kaynağı</h3>' +
        '<p>Kelime ve anlamlar, Türk Dil Kurumu&rsquo;nun <a href="https://sozluk.gov.tr/" target="_blank" rel="noopener">Güncel Türkçe Sözlük</a> verilerinin kamuya açık kopyasından derlendi. Telif hakları TDK&rsquo;ya aittir.</p>' +
        '<h3>Neler var</h3>' +
        '<ul class="about-list">' +
        '<li><b>' + ist.kelime.toLocaleString('tr-TR') + '</b> madde (kelime, deyim, birleşik söz)</li>' +
        '<li><b>' + ist.anlam.toLocaleString('tr-TR') + '</b> ayrı anlam</li>' +
        '<li>Tür bilgisi (isim, fiil, sıfat&hellip;), köken, telaffuz ve örnek cümleler</li>' +
        '</ul>' +
        '<h3>Özellikler</h3>' +
        '<ul class="about-list">' +
        '<li>Anlamlı canlı arama — yazarken ilk anlamı gösterir</li>' +
        '<li>Favoriler ve son aramalar (tarayıcıda saklanır, hiçbir yere gönderilmez)</li>' +
        '<li>Harfe göre göz atma ve harf yoğunluğu grafiği, önceki/sonraki kelime, rastgele kelime</li>' +
        '<li>Bulmaca araması — <b>k?t?p</b> gibi kalıplarla bilinmeyen harfli kelime bulma</li>' +
        '<li>Mini kelime testi ve sözlük istatistikleri (rekorlar, köken dağılımı)</li>' +
        '<li>Yazım hatasında &ldquo;bunu mu arıyordunuz?&rdquo; önerisi, birden çok tema (Aydınlık, Koyu, Siyah &amp; Gri, Gece Mavisi) ve <a href="#/ayarlar">ayarlar sayfası</a></li>' +
        '<li>Kısayol: <b>/</b> tuşu arama kutusuna odaklanır</li>' +
        '</ul>' +
        '<h3>Sürüm</h3>' +
        '<p>Uygulama sürümü <b>' + SURUM.ad + '</b>' + (apkTespit() ? ' (kod ' + SURUM.kod + ')' : '') + '. Bütün seçenekler <a href="#/ayarlar">Ayarlar</a> sayfasında.</p>' +
        '<h3>Android uygulaması</h3>' +
        '<p>Sözlüğü telefonunuza kurabilirsiniz' + (apkTespit() ? '' : ': <a class="btn" href="/' + APK_ADI + '" download="turkce-sozluk.apk">APK İndir &middot; ~4,1 MB</a>') + '. Çevrimdışı çalışır, ana ekrana widget eklenebilir.</p>' +
        '</div>';
    }).catch(function () {
      $app.innerHTML = '<div class="card not-found"><p class="hint">Sunucuya ulaşılamadı.</p></div>';
    });
  }

  /* ---------- Bulmaca / desen araması ---------- */
  function desenSayfasi(sablon, sonuc) {
    var sonucHtml = '';
    if (sonuc && sonuc.length) {
      sonucHtml = '<div class="card"><p class="hint">' + sonuc.length + ' kayıt bulundu.</p>' +
        sonuc.map(function (e) {
          return '<a class="result-item" href="#/kelime/' + encodeURIComponent(e.k) + '">' +
            '<div class="rt"><b>' + esc(e.k) + '</b></div>' +
            (e.a ? '<p class="rm">' + esc(e.a) + '</p>' : '') + '</a>';
        }).join('') + '</div>';
    } else if (sonuc) {
      sonucHtml = '<div class="card not-found"><p class="hint">Bu kalıba uyan kayıt yok. Harf sayısına ya da harflere tekrar bakın.</p></div>';
    }
    return geriSatir() + '<h1 class="sayfa-baslik">Bulmaca araması</h1>' +
      '<div class="card">' +
      '<form id="desenForm" class="desen-form">' +
      '<input id="desenInp" class="desen-input" placeholder="ör. k?t?p, a??k, *çe" autocomplete="off" spellcheck="false" value="' + esc(sablon) + '">' +
      '<button type="submit" class="btn">Bul</button></form>' +
      '<p class="hint"><b>&#63;</b> = tek harf, <b>&#42;</b> = her sayıda harf. Harf sayısı tam belli değilse &#42; kullanın.</p>' +
      '</div>' + sonucHtml;
  }

  function renderDesen(q) {
    if (!q) {
      document.title = 'Bulmaca araması — Türkçe Sözlük';
      $app.innerHTML = desenSayfasi('', null);
      baglaDesenForm();
      return;
    }
    yukleniyor('Kalıp taranıyor…');
    getJSON('/api/desen?q=' + encodeURIComponent(q)).then(function (liste) {
      document.title = q + ' — Bulmaca araması';
      $app.innerHTML = desenSayfasi(q, liste);
      baglaDesenForm();
    }).catch(function () {
      $app.innerHTML = '<div class="card not-found"><p class="hint">Sunucuya ulaşılamadı.</p></div>';
    });
  }

  function baglaDesenForm() {
    var df = document.getElementById('desenForm');
    if (!df) return;
    df.onsubmit = function (ev) {
      ev.preventDefault();
      var v = df.querySelector('input').value.trim();
      if (!v) return;
      location.hash = '#/desen/' + encodeURIComponent(v);
    };
  }

  /* ---------- Mini kelime testi ---------- */
  function testSoruSayisi() {
    var n = parseInt(ayarOku('testN', '5'), 10);
    return (n === 5 || n === 10 || n === 15) ? n : 5;
  }
  function renderTest() {
    yukleniyor('Sorular hazırlanıyor…');
    getJSON('/api/test?n=' + testSoruSayisi()).then(function (sorular) {
      if (!sorular || !sorular.length) {
        $app.innerHTML = '<div class="card not-found"><p class="hint">Sorular hazırlanamadı.</p></div>';
        return;
      }
      document.title = 'Kelime testi — Türkçe Sözlük';
      var sira = 0, skor = 0, kilitli = false;

      function soruKarti() {
        if (sira >= sorular.length) return bitisKarti();
        var s = sorular[sira];
        kilitli = false;
        var secenekler = s.secenekler.map(function (k, idx) {
          return '<button type="button" class="quiz-sec" data-k="' + esc(k) + '">' + esc(k) + '</button>';
        }).join('');
        $app.innerHTML = geriSatir() + '<div class="card quiz">' +
          '<div class="quiz-ust">' +
          '<span class="quiz-num">Soru ' + (sira + 1) + ' / ' + sorular.length + '</span>' +
          '<span class="quiz-puan">' + skor + ' doğru</span></div>' +
          '<h2 class="quiz-soru">&ldquo;' + esc(s.anlam) + '&rdquo;</h2>' +
          '<p class="hint">Bu anlama gelen kelime hangisidir?</p>' +
          '<div class="quiz-secilenler">' + secenekler + '</div>' +
          '<button type="button" class="btn" id="quizIleri" hidden>&rsaquo; İleri</button></div>';
        document.querySelectorAll('.quiz-sec').forEach(function (b) {
          b.onclick = function () {
            if (kilitli) return;
            kilitli = true;
            var secilen = b.getAttribute('data-k');
            if (secilen === s.dogru) {
              b.classList.add('dogru');
              skor++;
              document.querySelector('.quiz-puan').textContent = skor + ' doğru';
            } else {
              b.classList.add('yanlis');
              document.querySelectorAll('.quiz-sec').forEach(function (x) {
                if (x.getAttribute('data-k') === s.dogru) x.classList.add('dogru');
              });
            }
            document.getElementById('quizIleri').hidden = false;
            document.getElementById('quizIleri').onclick = function () { sira++; soruKarti(); };
          };
        });
      }

      function bitisKarti() {
        var yorum = skor === sorular.length ? 'Süpersin, hepsini bildin!' :
          skor >= Math.ceil(sorular.length / 2) ? 'Gayet iyi, devamını getir.' :
          'Yeni kelimelere göz atmakta fayda var.';
        var liste = sorular.map(function (s) {
          return '<p class="bitis-dogru"><b>' + esc(s.dogru) + '</b> &mdash; ' + esc(s.anlam) + '</p>';
        }).join('');
        $app.innerHTML = geriSatir() + '<div class="card quiz bitis">' +
          '<h2>' + skor + ' / ' + sorular.length + ' doğru</h2>' +
          '<p class="hint">' + esc(yorum) + '</p>' +
          '<div class="tt-actions">' +
          '<a class="btn ghost" href="#/test">Tekrar dene</a>' +
          '<a class="btn" href="#/">Ana sayfa</a></div>' +
          '<h3>Cevaplar</h3>' + liste + '</div>';
      }

      soruKarti();
    }).catch(function () {
      $app.innerHTML = '<div class="card not-found"><p class="hint">Sunucuya ulaşılamadı.</p></div>';
    });
  }

  /* ---------- Sözlük istatistikleri ---------- */
  function statKart(buyuk, kucuk) {
    return '<div class="stat-kart"><b>' + esc(buyuk) + '</b><span>' + esc(kucuk) + '</span></div>';
  }

  function renderIstatistik() {
    yukleniyor('Yükleniyor…');
    getJSON('/api/bilgi').then(function (B) {
      document.title = 'İstatistikler — Türkçe Sözlük';
      var maxK = 1;
      B.kokenler.forEach(function (k) { if (k.adet > maxK) maxK = k.adet; });
      var kokenHtml = B.kokenler.map(function (k) {
        return '<div class="koken-row"><span class="koken-ad">' + esc(k.dil) + '</span>' +
          '<span class="koken-cubuk"><i style="width:' + Math.round((k.adet / maxK) * 100) + '%"></i></span>' +
          '<span class="koken-sayi">' + k.adet.toLocaleString('tr-TR') + ' &middot; %' + k.yuzde + '</span></div>';
      }).join('');

      $app.innerHTML = geriSatir() + '<h1 class="sayfa-baslik">İstatistikler</h1>' +
        '<div class="stat-grid">' +
        statKart(B.toplamKelime.toLocaleString('tr-TR'), 'madde') +
        statKart(B.toplamAnlam.toLocaleString('tr-TR'), 'ayrı anlam') +
        statKart(B.ortalama, 'anlam / madde ortalaması') +
        '</div>' +
        '<div class="card"><h2>Rekorlar</h2>' +
        statKart(B.enUzun.k, 'en uzun kayıt · ' + B.enUzun.uzunluk + ' harf') +
        statKart(B.enKisa.k, 'en kısa kayıt · ' + B.enKisa.uzunluk + ' harf') +
        statKart(B.enCokAnlam.k, 'en çok anlamlı · ' + B.enCokAnlam.anlam + ' anlam') +
        '</div>' +
        '<div class="card"><h2>Köken dili dağılımı</h2>' +
        '<p class="hint">Kayıtlardaki köken dili etiketlerine göre ilk 10.</p>' + kokenHtml + '</div>';
    }).catch(function () {
      $app.innerHTML = '<div class="card not-found"><p class="hint">Sunucuya ulaşılamadı.</p></div>';
    });
  }

  /* ---------- Filtreli arama ---------- */
  function secOptions(dizi) {
    var h = '<option value="">Hepsi</option>';
    dizi.forEach(function (x) { h += '<option value="' + esc(x) + '">' + esc(x) + '</option>'; });
    return h;
  }

  function renderFiltre() {
    document.title = 'Filtreli arama — Türkçe Sözlük';
    yukleniyor('Hazırlanıyor…');
    getJSON('/api/kokenler').then(function (m) {
      $app.innerHTML = geriSatir() +
        '<h1 class="sayfa-baslik">Filtreli arama</h1>' +
        '<div class="card"><p class="hint">Uzunluk, başlangıç/bitiş, içerilen/dislanan harfler, köken ve türe göre daraltın.</p>' +
        '<form id="filtreForm" class="filter-grid" autocomplete="off">' +
        '<label><span>En az harf</span><input type="number" id="ffUzmin" min="1" max="40" placeholder="örn. 3"></label>' +
        '<label><span>En çok harf</span><input type="number" id="ffUzmax" min="1" max="40" placeholder="örn. 8"></label>' +
        '<label><span>Başlayan</span><input id="ffBas" placeholder="ör. ka"></label>' +
        '<label><span>Biten</span><input id="ffBit" placeholder="ör. mak"></label>' +
        '<label><span>İçeren</span><input id="ffIcer" placeholder="ör. şır"></label>' +
        '<label><span>İçermeyen</span><input id="ffDisla" placeholder="ör. zq"></label>' +
        '<label><span>Köken</span><select id="ffKok">' + secOptions(m.kokenler) + '</select></label>' +
        '<label><span>Tür</span><select id="ffTur">' + secOptions(m.turler) + '</select></label>' +
        '<div class="filter-submit"><button class="btn" type="submit">Ara</button>' +
        '<span class="hint">ilk 300 eşleşme</span></div>' +
        '</form>' +
        '<div id="filtreSonuc"></div>' +
        '</div>';
      document.getElementById('filtreForm').onsubmit = function (ev) {
        ev.preventDefault();
        filtreCalistir();
      };
    }).catch(function () {
      $app.innerHTML = '<div class="card not-found"><p class="hint">Sunucuya ulaşılamadı.</p></div>';
    });
  }

  function filtreCalistir() {
    var sayi = function (id) {
      var v = parseInt(document.getElementById(id).value, 10);
      return (v && v > 0) ? v : 0;
    };
    var oku = function (id) { return document.getElementById(id).value.trim(); };
    var p = {};
    if (sayi('ffUzmin')) p.uzmin = sayi('ffUzmin');
    if (sayi('ffUzmax')) p.uzmax = sayi('ffUzmax');
    if (oku('ffBas')) p.bas = oku('ffBas');
    if (oku('ffBit')) p.bit = oku('ffBit');
    if (oku('ffIcer')) p.icer = oku('ffIcer');
    if (oku('ffDisla')) p.disla = oku('ffDisla');
    if (oku('ffKok')) p.kok = oku('ffKok');
    if (oku('ffTur')) p.tur = oku('ffTur');
    var url = '/api/filtre?l=300' + Object.keys(p).map(function (k) {
      return '&' + k + '=' + encodeURIComponent(p[k]);
    }).join('');
    var kutu = document.getElementById('filtreSonuc');
    kutu.innerHTML = '<div class="spinner">Taranıyor…</div>';
    getJSON(url).then(function (res) {
      if (!res.length) {
        kutu.innerHTML = '<div class="card not-found"><p class="hint">Filtreye uyan kayıt yok. Kriterleri gevşetin.</p></div>';
        return;
      }
      var h = '<p class="hint">' + res.length + ' kayıt bulundu.</p><ul class="word-list">';
      res.forEach(function (e) {
        h += '<li><a href="#/kelime/' + encodeURIComponent(e.k) + '">' + esc(e.k) + '</a>' +
          (e.tur ? '<span class="pos-tag">' + esc(e.tur) + '</span>' : '') +
          '<span class="s">' + esc(e.ilk || '') + '</span></li>';
      });
      h += '</ul>';
      kutu.innerHTML = h;
    }).catch(function () {
      kutu.innerHTML = '<div class="card not-found"><p class="hint">Arama yapılamadı.</p></div>';
    });
  }

  /* ---------- Notlar (yapılacaklar / yapıldı) ---------- */
  function renderNotlar() {
    document.title = 'Notlar — Türkçe Sözlük';
    var l = notlar();
    var h = geriSatir() + '<h1 class="sayfa-baslik">Notlar</h1>';
    if (!l.length) {
      h += '<div class="card not-found"><p class="hint">Henüz not listesi yok. Alışveriş, okuma, üniversite, proje… neyi takip etmek isterseniz aşağıdan oluşturun.</p></div>';
    } else {
      h += '<div class="not-grid">';
      l.forEach(function (d) {
        var tamam = d.maddeler.filter(function (x) { return x.y; }).length;
        h += '<div class="card not-kart">' +
          '<div class="not-ad">' + esc(d.ad) +
          '<span class="badge">' + tamam + '/' + d.maddeler.length + ' tamam</span></div>' +
          '<p class="hint">' + (d.maddeler.length - tamam) + ' yapılacak bekliyor</p>' +
          '<div class="not-islem">' +
          '<a class="btn ghost" href="#/notlar/' + encodeURIComponent(d.ad) + '">Aç</a>' +
          '<button class="btn ghost danger" type="button" data-notsil="' + esc(d.ad) + '">Sil</button>' +
          '</div></div>';
      });
      h += '</div>';
    }
    h += '<div class="card"><h2>Yeni not listesi</h2>' +
      '<form id="notYeniForm" class="desen-form"><input id="notYeniAd" placeholder="Liste adı… ör. yapılacaklar">' +
      '<button class="btn" type="submit">Oluştur</button></form></div>';
    $app.innerHTML = h;
    var f = document.getElementById('notYeniForm');
    if (f) f.onsubmit = function (ev) {
      ev.preventDefault();
      var ad = document.getElementById('notYeniAd').value.trim();
      if (ad) { notEkle(ad); location.hash = '#/notlar/' + encodeURIComponent(ad); }
    };
    $app.querySelectorAll('[data-notsil]').forEach(function (b) {
      b.onclick = function () {
        var ad = b.getAttribute('data-notsil');
        if (b.getAttribute('data-emin') === '1') { notSil(ad); renderNotlar(); return; }
        b.setAttribute('data-emin', '1');
        b.textContent = 'Evet, sil';
        setTimeout(function () {
          if (b.getAttribute('data-emin') === '1') { b.removeAttribute('data-emin'); b.textContent = 'Sil'; }
        }, 2500);
      };
    });
  }

  function notMaddeHtml(o) {
    return '<div class="not-madde' + (o.x.y ? ' on' : '') + '">' +
      '<input type="checkbox" class="not-cb" data-i="' + o.i + '"' + (o.x.y ? ' checked' : '') + '>' +
      '<span class="not-metin">' + esc(o.x.m) + '</span>' +
      '<button class="not-sil" type="button" data-i="' + o.i + '" aria-label="sil">&times;</button>' +
      '</div>';
  }

  function renderNotListesi(ad) {
    var d = notBul(ad);
    if (!d) return renderNotlar();
    var yapilacaklar = [], yapildilar = [];
    d.maddeler.forEach(function (x, i) {
      (x.y ? yapildilar : yapilacaklar).push({ x: x, i: i });
    });
    document.title = d.ad + ' — Notlar';
    var h = geriSatir() + '<h1 class="sayfa-baslik">' + esc(d.ad) + '</h1>' +
      '<div class="card">' +
      '<p class="hint">' + yapildilar.length + ' / ' + d.maddeler.length + ' yapıldı</p>' +
      '<form id="notMaddeForm" class="desen-form">' +
      '<input id="notMaddeInp" placeholder="yeni yapılacak…" autocomplete="off" spellcheck="false">' +
      '<button class="btn" type="submit">Ekle</button></form>';
    if (!d.maddeler.length) {
      h += '<p class="hint">Liste boş. Yukarıdan ilk görevinizi ekleyin.</p>';
    } else {
      if (yapilacaklar.length) {
        h += '<div class="not-bolum">Yapılacaklar (' + yapilacaklar.length + ') <small>bitince işaretleyin</small></div>' +
          '<div class="not-listesi">' + yapilacaklar.map(notMaddeHtml).join('') + '</div>';
      }
      if (yapildilar.length) {
        h += '<div class="not-bolum">Yapıldı (' + yapildilar.length + ')</div>' +
          '<div class="not-listesi">' + yapildilar.map(notMaddeHtml).join('') + '</div>' +
          '<button class="back-link" type="button" id="notTemiz">tamamlananları temizle</button>';
      }
    }
    h += '</div>';
    $app.innerHTML = h;

    document.getElementById('notMaddeForm').onsubmit = function (ev) {
      ev.preventDefault();
      var m = document.getElementById('notMaddeInp').value;
      if (m && m.trim()) { notMaddeEkle(ad, m); renderNotListesi(ad); }
    };
    $app.querySelectorAll('.not-cb').forEach(function (c) {
      c.onchange = function () {
        notMaddeDurum(ad, parseInt(c.getAttribute('data-i'), 10), c.checked);
        renderNotListesi(ad);
      };
    });
    $app.querySelectorAll('.not-sil').forEach(function (b) {
      b.onclick = function () {
        notMaddeSil(ad, parseInt(b.getAttribute('data-i'), 10));
        renderNotListesi(ad);
      };
    });
    var tm = document.getElementById('notTemiz');
    if (tm) tm.onclick = function () { notTamamlananlariSil(ad); renderNotListesi(ad); };
  }

  /* ---- kelime sayfasından notlara ekle (panel) ---- */
  var arnotK = '';
  function acNotSec(btn) {
    var p = document.querySelector('.def-panel');
    if (p) p.remove();
    arnotK = btn.getAttribute('data-k');
    var l = notlar();
    var h = '<div class="def-panel">' +
      '<p class="hint">Notlara ekle: <b>' + esc(arnotK) + '</b></p>';
    if (!l.length) {
      h += '<p class="hint">Henüz not listesi yok — aşağıdan oluşturun.</p>';
    } else {
      h += '<div class="chip-row">' + l.map(function (d) {
        return '<button type="button" class="chip not-liste-item" data-ad="' + esc(d.ad) + '">' + esc(d.ad) + '</button>';
      }).join('') + '</div>';
    }
    h += '<div class="def-yeni"><input id="defYeniAd" placeholder="yeni liste adı…">' +
      '<button type="button" class="btn" id="defYeniBtn">oluştur &amp; ekle</button></div>' +
      '<button type="button" class="back-link def-kapat">kapat</button></div>';
    btn.insertAdjacentHTML('afterend', h);
    var kapat = document.querySelector('.def-kapat');
    if (kapat) kapat.onclick = function () {
      var x = document.querySelector('.def-panel');
      if (x) x.remove();
    };
  }

  function notPanelYenile() {
    var b = null;
    document.querySelectorAll('.not-btn').forEach(function (x) {
      if (x.getAttribute('data-k') === arnotK) b = x;
    });
    if (b) acNotSec(b);
  }

  /* ---------- Yapay zekâ (ücretsiz, anahtarsız) ---------- */
  var AI_ADRES = null;
  function aiIste(prompt) {
    var deneme = 0;
    var denemeTek = function () {
      return fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: String(prompt) })
      }).then(function (r) {
        if (!r.ok) {
          return r.json().catch(function () { return {}; }).then(function (j) {
            throw new Error(j.hata || ('yanıt yok (' + r.status + ')'));
          });
        }
        return r.text();
      }).then(function (metin) {
        var y = String(metin || '').trim();
        if (!y) throw new Error('boş yanıt');
        return y;
      }).catch(function (e) {
        if (e && e.name === 'TypeError') {
          throw new Error(e.message === 'Failed to fetch' ? 'ağ hatası — internet bağlantınızı denetleyin' : e.message);
        }
        deneme++;
        if (deneme < 3) {
          return new Promise(function (g) { setTimeout(g, deneme * 3000); }).then(denemeTek);
        }
        throw e;
      });
    };
    return denemeTek();
  }

  var AI_ORNEKLER = [
    { etiket: '5 yaşındaki gibi anlat', tur: 1 },
    { etiket: 'örnek cümle kur', tur: 2 },
    { etiket: 'eş anlamlısı', tur: 3 },
    { etiket: 'hangi dilde?', tur: 4 }
  ];

  function aiIstem(kelime, tur) {
    if (tur === 1) return 'Bu kelimeyi 5 yaşındaki bir çocuğa anlatır gibi basitçe açıkla: ' + kelime;
    if (tur === 2) return 'Bu kelimeyle anlamına uygun 2 kısa örnek cümle kur: ' + kelime;
    if (tur === 3) return 'Şu kelimenin eş anlamlılarını söyle ve her birini tek satırda açıkla: ' + kelime;
    return 'Şu kelimenin hangi dilden geldiğini ve kökenini kısaca anlat: ' + kelime;
  }

  function renderAi() {
    document.title = 'AI — Türkçe Sözlük';
    var odak = '';
    var e = location.hash.match(/\?kelime=([^&]+)/);
    if (e) {
      try { odak = decodeURIComponent(e[1]); } catch (err) {}
    }
    var h = geriSatir() + '<div class="card ai-kart">' +
      '<div class="ai-baslik"><h1 class="sayfa-baslik" style="margin:0">Yapay zekâ</h1><span class="ai-spark">&#10024;</span></div>' +
      '<p class="ai-isim">ücretsiz + anahtarsız &middot; internet gerekir &middot; sözlükle ilgili her şeyi sorabilirsiniz</p>' +
      '<form id="aiForm" class="desen-form ai-form">' +
      '<div class="ai-satir"><input id="aiInp" placeholder="Ör. kitap nedir, kökü nereden gelir?" autocomplete="off" spellcheck="false">' +
      '<button type="submit" class="btn">Sor</button></div></form>' +
      '<div class="ai-sorular" id="aiSorular"></div>' +
      '<div id="aiCevap"></div>' +
      '<p class="ai-uyari">Demo yardımcıdır; yanıtlar üretilmiştir, yine de doğruluğunu denetleyin. Sorularınız hiçbir yere kaydedilmez.</p>' +
      '</div>';
    $app.innerHTML = h;

    var sorular = document.getElementById('aiSorular');
    AI_ORNEKLER.forEach(function (ornek) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip ai-soru-chip';
      b.textContent = ornek.etiket;
      b.onclick = function () {
        var k = document.getElementById('aiInp').value.trim();
        if (!k) { document.getElementById('aiInp').focus(); return; }
        aiSor(ornek.tur, k);
      };
      sorular.appendChild(b);
    });

    function mesaj(html) {
      document.getElementById('aiCevap').innerHTML = html;
    }

    function aiSor(tur, kelime) {
      if (!kelime) return;
      sonAra(kelime);
      mesaj('<div class="ai-dusunme"><span class="nokta"></span><span class="nokta"></span><span class="nokta"></span> düşünüyorum…</div>');
      aiIste(aiIstem(kelime, tur)).then(function (metin) {
        mesaj('<div class="ai-cevap">' + esc(metin) + '<div class="ai-kaynak">v1.0.10 &middot; Pollinations &middot; üretken metin — doğruluğu kontrol edin</div></div>');
      }).catch(function (hata) {
        mesaj('<div class="card not-found" style="margin:0"><p class="hint">Çalışmadı: ' +
          esc((hata && hata.message) || 'bilinmeyen hata') +
          ' — internet bağlantısını denetleyin, sonra tekrar deneyin.</p></div>');
      });
    }

    var f = document.getElementById('aiForm');
    f.onsubmit = function (ev) {
      ev.preventDefault();
      var k = document.getElementById('aiInp').value.trim();
      if (!k) return;
      aiSor(0, k);
    };

    if (odak) {
      document.getElementById('aiInp').value = odak;
      aiSor(0, odak);
    }
  }

  /* ---------- Ayarlar ---------- */
  function renderAyarlar() {
    document.title = 'Ayarlar — Türkçe Sözlük';
    var tema = temaOku();
    var h = geriSatir() + '<h1 class="sayfa-baslik">Ayarlar</h1>';

    h += '<div class="card"><h2>Görünüm — tema</h2>' +
      '<div class="tema-kutulari">';
    Object.keys(TEMALAR).forEach(function (id) {
      var t = TEMALAR[id];
      h += '<button type="button" class="tema-kutu' + (tema === id ? ' on' : '') + '" data-tema="' + id + '">' +
        '<span class="tk-ornek" style="background:' + t.ornek + '">' +
        '<span class="tk-harf" style="color:' + t.vurgu + '">Aa</span></span>' +
        '<small>' + t.ad + '</small></button>';
    });
    h += '</div>' +
      '<label class="ayar-satir">' +
      '<input type="checkbox" id="ayarSistemTema"' + (sistemTemaAktif() ? ' checked' : '') + '>' +
      '<span><b>Sistem temasını izle</b><small>İşletim sisteminiz karanlıktaysa otomatik geçir.</small></span>' +
      '</label></div>';

    h += '<div class="card"><h2>Mini kelime testi</h2>' +
      '<label class="ayar-satir">' +
      '<span><b>Soru sayısı</b><small>Testte kaç soru çıksın?</small></span>' +
      '<select id="ayarTestN"><option value="5">5</option><option value="10">10</option><option value="15">15</option></select>' +
      '</label></div>';

    h += '<div class="card"><h2>Sürüm ve veri</h2>' +
      '<ul class="about-list">' +
      '<li>Uygulama sürümü: <b>' + SURUM.ad + '</b> (kod ' + SURUM.kod + ')</li>' +
      '<li>Sözlük kaydı: <span id="ayarIst">…</span></li>' +
      '<li>Mod: ' + (apkTespit() ? 'Android APK (çevrimdışı)' : 'Web (sunucu)') + '</li>' +
      '</ul>' +
      (apkTespit() ? '' : '<p><a class="btn" href="/' + APK_ADI + '" download="turkce-sozluk.apk">APK İndir &middot; ~4,1 MB</a></p>') +
      '</div>';

    h += '<div class="card"><h2>Kişisel veri (yalnızca bu cihazda)</h2>' +
      '<div class="veri-bilgi"><span><b>Favoriler</b><small>' + favoriler().length + ' kelime</small></span>' +
      '<button class="btn ghost danger" type="button" id="temizFav">Temizle</button></div>' +
      '<div class="veri-bilgi"><span><b>Son aramalar</b><small>' + sonAramalar().length + ' kayıt</small></span>' +
      '<button class="btn ghost danger" type="button" id="temizSon">Temizle</button></div>' +
      '<div class="veri-bilgi"><span><b>Notlar</b><small>' + notlar().length + ' liste</small></span>' +
      '<button class="btn ghost danger" type="button" id="temizNot">Sil</button></div>' +
      '<p class="hint">Bu veriler hiçbir yere gönderilmez; yalnızca tarayıcıda/telefonda saklanır.</p>' +
      '</div>';

    $app.innerHTML = h;

    $app.querySelectorAll('.tema-kutu').forEach(function (b) {
      b.onclick = function () {
        var t = b.getAttribute('data-tema');
        ayarYaz('sistemTema', '0');
        temaKur(t);
        ayarYaz('tema', t);
        $app.querySelectorAll('.tema-kutu').forEach(function (x) { x.classList.remove('on'); });
        b.classList.add('on');
      };
    });

    var st = document.getElementById('ayarSistemTema');
    st.onchange = function () {
      if (st.checked) { ayarYaz('sistemTema', '1'); temaKur(autoTema()); }
      else { ayarYaz('sistemTema', '0'); temaKur(temaOku()); }
    };

    var tn = document.getElementById('ayarTestN');
    tn.value = '' + testSoruSayisi();
    tn.onchange = function () { ayarYaz('testN', tn.value); };

    var temiz = [
      ['temizFav', function () { yaz('fav', []); }],
      ['temizSon', function () { yaz('son', []); }],
      ['temizNot', function () { notlarYaz([]); }]
    ];
    temiz.forEach(function (satir) {
      var b = document.getElementById(satir[0]);
      b.onclick = function () {
        if (b.getAttribute('data-emin') === '1') { satir[1](); renderAyarlar(); return; }
        b.setAttribute('data-emin', '1');
        b.textContent = 'Evet';
        setTimeout(function () {
          if (b.getAttribute('data-emin') === '1') { b.removeAttribute('data-emin'); b.textContent = 'Temizle'; }
        }, 2500);
      };
    });

    getJSON('/api/istatistik').then(function (ist) {
      var el = document.getElementById('ayarIst');
      if (el) el.textContent = ist.kelime.toLocaleString('tr-TR') + ' madde, ' + ist.anlam.toLocaleString('tr-TR') + ' anlam';
    });
  }

  /* ---------- Canlı öneriler ---------- */
  function oneriGetir(q) {
    $sonOneri.hidden = true;
    getJSON('/api/oneri?q=' + encodeURIComponent(q)).then(function (liste) {
      aktifSicak = -1;
      oneriler = liste;
      if (!liste.length) { $suggest.hidden = true; return; }
      var html = '<div class="suggest-hint">bir şeye basın ya da Enter&rsquo;a basın</div>';
      liste.forEach(function (it) {
        html += '<button type="button" class="suggest-item" data-i="' + liste.indexOf(it) + '">' +
          '<span class="w">' + vurgula(it.k, q) + '</span>' +
          (it.a ? '<span class="m">' + esc(it.a) + '</span>' : '') +
          '</button>';
      });
      $suggest.innerHTML = html;
      $suggest.hidden = false;
      var kutu = $suggest.querySelectorAll('.suggest-item');
      kutu.forEach(function (el) {
        el.onmousedown = function (ev) {
          ev.preventDefault();
          var i = parseInt(el.getAttribute('data-i'), 10);
          if (oneriler[i]) gitKelime(oneriler[i].k);
        };
      });
      aktifGoster();
    });
  }

  function aktifGoster() {
    var kutu = $suggest.querySelectorAll('.suggest-item');
    kutu.forEach(function (el, i) {
      el.classList.toggle('active', i === aktifSicak);
    });
  }

  function gitKelime(w) {
    gizleAcilirlar();
    location.hash = '#/kelime/' + encodeURIComponent(w);
  }

  function sonOneriGoster() {
    var s = sonAramalar();
    $suggest.hidden = true;
    if (!s.length) { $sonOneri.hidden = true; return; }
    var html = '<div class="suggest-hint">son aramalarınız — birine basın</div>' +
      '<div class="son-chipleri">' + s.slice(0, 6).map(function (k) {
        return '<button type="button" class="chip son-chip" data-k="' + esc(k) + '">' + esc(k) + '</button>';
      }).join('') + '</div>' +
      '<div class="suggest-hint son-alt">' +
      '<a href="#/filtre">gelişmiş arama &rsaquo;</a> &middot; <a href="#/ai">AI&rsquo;a sor &rsaquo;</a></div>';
    $sonOneri.innerHTML = html;
    $sonOneri.hidden = false;
    $sonOneri.querySelectorAll('.son-chip').forEach(function (c) {
      c.onmousedown = function (ev) {
        ev.preventDefault();
        var k = c.getAttribute('data-k');
        $sonOneri.hidden = true;
        location.hash = '#/kelime/' + encodeURIComponent(k);
      };
    });
  }

  function gizleAcilirlar() { $suggest.hidden = true; $sonOneri.hidden = true; }

  function kirInput() {
    var v = $input.value;
    $clear.hidden = !v;
  }

  $input.addEventListener('input', function () {
    kirInput();
    var q = $input.value.trim();
    if (!q) { $sonOneri.hidden = false; sonOneriGoster(); return; }
    $sonOneri.hidden = true;
    clearTimeout(oneriTimer);
    oneriTimer = setTimeout(function () { oneriGetir(q); }, 130);
  });

  if ($clear) $clear.addEventListener('click', function () {
    $input.value = '';
    kirInput();
    $suggest.hidden = true;
    sonOneriGoster();
    $input.focus();
  });

  $input.addEventListener('keydown', function (ev) {
    if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      aktifSicak = Math.min(aktifSicak + 1, oneriler.length - 1);
      aktifGoster();
    } else if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      aktifSicak = Math.max(aktifSicak - 1, -1);
      aktifGoster();
    } else if (ev.key === 'Enter') {
      ev.preventDefault();
      gizleAcilirlar();
      var q = $input.value.trim();
      if (!q) return;
      if (oneriler[aktifSicak]) return gitKelime(oneriler[aktifSicak].k);
      if (desenKalibi(q)) location.hash = '#/desen/' + encodeURIComponent(q);
      else location.hash = '#/ara/' + encodeURIComponent(q);
    } else if (ev.key === 'Escape') {
      gizleAcilirlar();
    }
  });

  $input.addEventListener('blur', function () {
    setTimeout(function () { gizleAcilirlar(); }, 120);
  });

  $btn.addEventListener('click', function () {
    var q = $input.value.trim();
    if (!q) { $input.focus(); return; }
    if (desenKalibi(q)) location.hash = '#/desen/' + encodeURIComponent(q);
    else location.hash = '#/ara/' + encodeURIComponent(q);
  });

  function desenKalibi(q) {
    return q.indexOf('?') !== -1 || q.indexOf('*') !== -1;
  }

  document.addEventListener('keydown', function (ev) {
    if (ev.key === '/' && document.activeElement !== $input) {
      ev.preventDefault();
      $input.focus();
    }
  });

  /* favori yıldızı: tıklanınca ekle/çıkar, sayfayı tazele */
  $app.addEventListener('click', function (ev) {
    var notBtn = ev.target.closest('.not-btn');
    if (notBtn) { acNotSec(notBtn); return; }
    var listeItem = ev.target.closest('.not-liste-item');
    if (listeItem) {
      notMaddeEkle(listeItem.getAttribute('data-ad'), arnotK);
      notPanelYenile();
      return;
    }
    if (ev.target.closest('#defYeniBtn')) {
      var ad = '';
      var input = document.getElementById('defYeniAd');
      if (input) ad = input.value.trim();
      if (ad) { notEkle(ad); notMaddeEkle(ad, arnotK); notPanelYenile(); }
      return;
    }
    var btn = ev.target.closest('.fav-btn');
    if (!btn) return;
    var w = btn.getAttribute('data-fav');
    if (!w) return;
    if (favoriMi(w)) favoriSil(w); else favoriEkle(w);
    route();
  });

  /* ---------- Sayfa tanıtım turu ---------- */
  var KITAP_IKON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5c-2-1.6-4.6-2-7-2v15c2.4 0 5 .4 7 2 2-1.6 4.6-2 7-2V3c-2.4 0-5 .4-7 2z"/><path d="M12 5v15"/></svg>';

  var REHBER_ADIMLAR = [
    { secici: '#searchWrap', baslik: 'Arama kutusu', yazi: 'Bir kelime yazmaya başlayın; altında anlamlarıyla birlikte öneriler belirir. Enter ile arayın, ok tuşlarıyla seçin.' },
    { secici: '#nav-rastgele', baslik: 'Rastgele kelime', yazi: 'Şansınıza güzel bir kelime gelsin. Üstteki menüden istediğiniz an kullanabilirsiniz.' },
    { secici: '#bolum-harf', baslik: 'Harfler', yazi: 'Başlangıç harfine göre sözlüğe göz atın. Her karoda o harfle kaç kelime olduğu yazar.' },
    { secici: '#bolum-fav', baslik: 'Favorilerim', yazi: 'Kelime sayfasındaki yıldıza basın; sevdikleriniz burada birikir.' },
    { secici: '#bolum-son', baslik: 'Son aramalarım', yazi: 'En son aradıklarınız burada durur; herhangi birine tıklayıp geri dönersiniz.' }
  ];

  var turAdim = 0;
  var turOdak = null;

  function turKapat() {
    var o = document.getElementById('turOverlay');
    if (o) o.remove();
    turOdak = null;
  }

  function turNoktalar(suanki) {
    var h = '';
    for (var n = 0; n < REHBER_ADIMLAR.length + 1; n++) h += '<i' + (n === suanki ? ' class="on"' : '') + '></i>';
    return h;
  }

  function turTipkonum(eso, r) {
    var tip = document.getElementById('turTip');
    if (!tip) return;
    var w = 330;
    var sol = r.left + r.width / 2 - w / 2;
    sol = Math.max(8, Math.min(sol, window.innerWidth - w - 8));
    var alt = r.bottom + 14;
    var ust = r.top - 14 - 210;
    var top = (alt + 210 < window.innerHeight) ? alt : Math.max(8, ust);
    tip.style.left = sol + 'px';
    tip.style.top = top + 'px';
  }

  function turPozla(elt, adim, i, noktalar) {
    var ring = document.getElementById('turRing');
    var tip = document.getElementById('turTip');
    function konumla() {
      var r = elt.getBoundingClientRect();
      var pad = 10;
      ring.classList.remove('hidden');
      ring.style.left = (r.left - pad) + 'px';
      ring.style.top = (r.top - pad) + 'px';
      ring.style.width = (r.width + pad * 2) + 'px';
      ring.style.height = (r.height + pad * 2) + 'px';
      tip.classList.remove('warn');
      tip.style.width = '330px';
      turTipkonum(null, r);
    }
    konumla();
    var geri = i > 0 ? '<button class="btn ghost" id="turGeri">&lsaquo; geri</button>' : '';
    tip.innerHTML =
      '<div class="tt-ust"><h4>' + esc(adim.baslik) + '</h4>' +
      '<div class="tt-noktalar">' + noktalar + '</div>' +
      '<button class="tt-gec" id="turKapat">geç</button></div>' +
      '<p>' + esc(adim.yazi) + '</p>' +
      '<div class="tt-actions">' + geri + '<button class="btn" id="turIleri">ileri &rsaquo;</button></div>';
    requestAnimationFrame(function () { konumla(); });
  }

  function turAdimla(i) {
    turAdim = i;
    var tip = document.getElementById('turTip');
    var ring = document.getElementById('turRing');
    if (!tip || !ring) return;
    var adim = i < REHBER_ADIMLAR.length ? REHBER_ADIMLAR[i] : null;
    var noktalar = turNoktalar(i);

    if (!adim) {
      ring.classList.add('hidden');
      tip.classList.add('warn');
      tip.style.width = '340px';
      var sol = (window.innerWidth - 340) / 2;
      tip.style.left = Math.max(8, sol) + 'px';
      tip.style.top = (window.innerHeight > 700 ? '36vh' : '26vh');
      tip.innerHTML =
        '<div class="tt-ust"><h4>Aklınızda olsun</h4></div>' +
        '<p><b>Bu sayfa bir demo sürümdür; hatalar olabilir.</b> Kelime ve anlamlar TDK&rsquo;nın ' +
        'Güncel Türkçe Sözlük verilerinden alınmıştır. Resmî ve güncel sözlük için ' +
        '<a href="https://sozluk.gov.tr/" target="_blank" rel="noopener">sozluk.gov.tr</a> adresini kullanınız.</p>' +
        '<div class="tt-actions"><button class="btn ghost" id="turHakkinda">Hakkında</button>' +
        '<button class="btn" id="turTamam">Tamam</button></div>';
      return;
    }

    var elt = document.querySelector(adim.secici);
    if (!elt) { turAdimla(i + 1); return; }
    var r = elt.getBoundingClientRect();
    var gorunur = r.top >= -6 && r.bottom <= window.innerHeight + 6 &&
      r.left >= -6 && r.right <= window.innerWidth + 6;
    if (!gorunur) {
      elt.scrollIntoView({ block: 'center', behavior: 'auto' });
      r = elt.getBoundingClientRect();
    }
    turPozla(elt, adim, i, noktalar);
  }

  function turAc() {
    if (document.getElementById('turOverlay')) turKapat();
    var ov = document.createElement('div');
    ov.id = 'turOverlay';
    ov.innerHTML =
      '<div class="tour-ring hidden" id="turRing"></div>' +
      '<div class="tour-tip" id="turTip" role="dialog" aria-live="polite"></div>';
    document.body.appendChild(ov);
    turAdimla(0);
  }

  function turBaslat() {
    if (parseHash().sayfa !== 'anayasa') location.hash = '#/';
    if (document.querySelector('#bolum-harf')) { turAc(); return; }
    var deneme = 0;
    var gomlek = setInterval(function () {
      deneme++;
      if (document.querySelector('#bolum-harf') || deneme > 30) {
        clearInterval(gomlek);
        turAc();
      }
    }, 60);
  }

  function tanitimPenceresi() {
    if (oku('rehber') === '1') return;
    var m = document.createElement('div');
    m.id = 'turModal';
    m.className = 'tour-modal';
    m.innerHTML =
      '<div class="kart">' +
      '<div class="bm">' + KITAP_IKON + '</div>' +
      '<h3>Bu sayfayı tanımak ister misiniz?</h3>' +
      '<p>Türkçe Sözlük&rsquo;ün nerede ne olduğunu 30 saniyede özetleyelim: arama kutusu, harfler, favoriler ve sonda da bir uyarı var.</p>' +
      '<div class="mm-btn"><button class="btn" id="turEvet">Evet, tanıt</button>' +
      '<button class="btn ghost" id="turHayir">Hayır, sonra</button></div>' +
      '</div>';
    document.body.appendChild(m);
    m.addEventListener('click', function (ev) {
      if (ev.target.id === 'turEvet') {
        yaz('rehber', '1');
        m.remove();
        turBaslat();
      } else if (ev.target.id === 'turHayir') {
        yaz('rehber', '1');
        m.remove();
      }
    });
  }

  document.addEventListener('click', function (ev) {
    var t = ev.target;
    if (t.id === 'turBaslat') {
      ev.preventDefault();
      turBaslat();
    }
    if (t.closest) {
      var orta = t.closest('#turOverlay');
      if (orta) {
        if (t.id === 'turIleri') turAdimla(turAdim + 1);
        else if (t.id === 'turGeri') turAdimla(Math.max(turAdim - 1, 0));
        else if (t.id === 'turKapat') turKapat();
        else if (t.id === 'turTamam') turKapat();
        else if (t.id === 'turHakkinda') { turKapat(); location.hash = '#/hakkimda'; }
      }
    }
  });

  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape' && document.getElementById('turOverlay')) turKapat();
  });

  function surumKontrol() {
    if (window.apkTespit && window.apkTespit()) return;
    var bar = document.getElementById('surumBar');
    if (!bar) return;
    fetch('surum.json', { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error();
      return r.json();
    }).then(function (s) {
if (s && typeof s.kod === 'number' && s.kod > SURUM.kod) {
      bar.hidden = false;
      var kapat = document.getElementById('surumKapat');
      if (kapat) kapat.addEventListener('click', function () { bar.hidden = true; });
    }
    }).catch(function () {});
  }
  surumKontrol();

  window.addEventListener('hashchange', route);
  route();
  tanitimPenceresi();
})();