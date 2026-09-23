const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { exec } = require('child_process');

const PORT = process.env.PORT || 3000;
const PUB = path.join(__dirname, 'public');
const DATA = path.join(__dirname, 'data');
const DISTS = path.join(__dirname, 'dists');
const NETLIFY = path.join(__dirname, 'netlify-deploy');

/* ---------- Yönetim paneli (şifre + token) ---------- */
const PANEL_SIFRE_DOSYA = path.join(__dirname, '.panel-sifre');
let PANEL_SIFRE = '';
try { PANEL_SIFRE = fs.readFileSync(PANEL_SIFRE_DOSYA, 'utf8').trim(); } catch (e) {}
if (!PANEL_SIFRE) {
  PANEL_SIFRE = crypto.randomBytes(12).toString('hex');
  fs.writeFileSync(PANEL_SIFRE_DOSYA, PANEL_SIFRE);
}
const panelTokenleri = new Map();
let panelYanlisTarih = [];
let panelKilitli = 0;

function panelTeoriOncesi() {
  if (Date.now() < panelKilitli) return false;
  return true;
}
function panelSifreDogru(g) {
  const now = Date.now();
  if (now < panelKilitli) return false;
  if (!g || g !== PANEL_SIFRE) {
    panelYanlisTarih.push(now);
    panelYanlisTarih = panelYanlisTarih.filter((t) => now - t < 600000);
    if (panelYanlisTarih.length >= 5) { panelKilitli = now + 10 * 60000; panelYanlisTarih = []; }
    return false;
  }
  panelYanlisTarih = [];
  return true;
}
function panelTokenUret() {
  const tok = crypto.randomBytes(24).toString('hex');
  panelTokenleri.set(tok, Date.now() + 6 * 3600000);
  if (panelTokenleri.size > 50) {
    for (const [k, v] of panelTokenleri) {
      if (v < Date.now()) panelTokenleri.delete(k);
    }
    if (panelTokenleri.size > 60) panelTokenleri.clear();
  }
  return tok;
}
function panelTokenGecerli(tok) {
  if (!tok) return false;
  const bitis = panelTokenleri.get(tok);
  if (!bitis) return false;
  if (bitis < Date.now()) { panelTokenleri.delete(tok); return false; }
  return true;
}
function panelBodyOku(req, sinir, then) {
  let govde = '';
  req.on('data', (c) => {
    if (govde.length > sinir) return;
    govde += c;
  });
  req.on('end', () => then(govde));
}
function panelGit(dagit) {
  return new Promise((don) => {
    exec('git add -A && git -c core.quotepath=false status --porcelain | head -20', { cwd: __dirname }, (e, sok) => {
      don({ dek: sok || '' });
    });
  });
}

function sendPJSON(res, obj, durum) {
  const body = JSON.stringify(obj);
  res.writeHead(durum || 200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}

const dictionary = JSON.parse(fs.readFileSync(path.join(DATA, 'dictionary.json'), 'utf8'));
const words = JSON.parse(fs.readFileSync(path.join(DATA, 'words.json'), 'utf8'));

const TURKISH_ALPHABET = 'abcçdefgğhıijklmnoöprsştuüvyz';

function normalize(s) {
  if (!s) return '';
  s = String(s).toLocaleLowerCase('tr');
  s = s.replace(/â/g, 'a').replace(/î/g, 'i').replace(/û/g, 'u');
  s = s.replace(/ğ/g, 'g').replace(/ş/g, 's').replace(/ı/g, 'i');
  s = s.replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ç/g, 'c');
  s = s.replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  return s;
}

const normWords = words.map(normalize);
const firstLetters = new Map();
for (const w of words) {
  const L = w[0].toLocaleLowerCase('tr');
  firstLetters.set(L, (firstLetters.get(L) || 0) + 1);
}

function exact(q) {
  const nq = normalize(q);
  if (!nq) return [];
  const raw = String(q).toLocaleLowerCase('tr');
  const hits = [];
  for (let i = 0; i < words.length; i++) {
    if (normWords[i] === nq || words[i].toLocaleLowerCase('tr') === raw) hits.push(dictionary[i]);
  }
  return hits;
}

function suggest(q, limit = 10) {
  const nq = normalize(q);
  if (!nq) return [];
  const raw = String(q).toLocaleLowerCase('tr');
  const aday = [];
  for (let i = 0; i < normWords.length; i++) {
    const w = normWords[i];
    let sira;
    if (words[i].toLocaleLowerCase('tr').startsWith(raw)) sira = 0;
    else if (w.startsWith(nq)) sira = 1;
    else if (w.includes(nq)) sira = 2;
    else continue;
    aday.push([i, sira]);
  }
  aday.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  return aday.slice(0, limit).map(([i]) => words[i]);
}

function ilkAnlam(e) {
  if (!e || !e.a || !e.a.length) return '';
  return e.a[0].m;
}

function suggestWithMeaning(q) {
  return suggest(q).map((w) => {
    const i = words.indexOf(w);
    let a = '';
    if (i > -1) {
      a = ilkAnlam(dictionary[i]);
      if (a.length > 90) a = a.slice(0, 87) + '…';
    }
    return { k: w, a };
  });
}

function komsu(q) {
  const nq = normalize(q);
  const i = normWords.indexOf(nq);
  if (i < 0) return { onceki: null, sonraki: null };
  return {
    onceki: i > 0 ? words[i - 1] : null,
    sonraki: i < words.length - 1 ? words[i + 1] : null,
  };
}

/* ---- benzer yazımlı kelimeler (yazım hatası önerisi) ---- */
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  const d = [];
  for (let i = 0; i <= m; i++) { d[i] = [i]; }
  for (let j = 0; j <= n; j++) { d[0][j] = j; }
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const c = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
    }
  }
  return d[m][n];
}

function benzerOneri(q, sinir = 6) {
  const nq = normalize(q);
  const adaylar = [];
  for (let i = 0; i < normWords.length; i++) {
    const w = normWords[i];
    if (!w) continue;
    if (Math.abs(w.length - nq.length) > 2) continue;
    const mesafe = levenshtein(w, nq);
    if (mesafe >= 1 && mesafe <= 2) adaylar.push([i, mesafe]);
  }
  adaylar.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  return adaylar.slice(0, sinir).map(([i]) => words[i]);
}

/* ---- bulmaca / desen araması: k?t?p ---- */
function desenAra(q, sinir = 80) {
  const p = String(q || '').toLocaleLowerCase('tr');
  if (!p) return [];
  let kalip = '^';
  let dort = true;
  for (const ch of p) {
    if (ch === '?') kalip += '[a-zçğıöşüâîû]';
    else if (ch === '*' || ch === '') { kalip += '.*'; dort = false; }
    else { kalip += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&'); if (ch === ' ') dort = false; }
  }
  kalip += '$';
  const re = new RegExp(kalip);
  const sonuc = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i].toLocaleLowerCase('tr');
    if (!re.test(w)) continue;
    if (dort && !/^[a-zçğıöşüâîû]+$/.test(w)) continue;
    sonuc.push({ k: words[i], a: ilkAnlam(dictionary[i]) });
    if (sonuc.length >= sinir) break;
  }
  return sonuc;
}

/* ---- istatistikler ---- */
function istatistikTopla() {
  const B = { toplamKelime: dictionary.length, toplamAnlam: 0, enUzun: null, enKisa: null, enCokAnlam: null, kokenler: {} };
  let minLen = Infinity, minW = '', maxLen = 0, maxW = '', maxA = 0, maxAW = '';
  for (const e of dictionary) {
    const uz = e.k.length;
    if (uz > maxLen) { maxLen = uz; maxW = e.k; }
    if (uz < minLen) { minLen = uz; minW = e.k; }
    if (e.a.length > maxA) { maxA = e.a.length; maxAW = e.k; }
    B.toplamAnlam += e.a.length;
    const dil = (e.l || '').trim();
    if (dil) {
      const ilk = dil.split(' ')[0];
      B.kokenler[ilk] = (B.kokenler[ilk] || 0) + 1;
    } else {
      B.kokenler['diğer'] = (B.kokenler['diğer'] || 0) + 1;
    }
  }
  B.enUzun = { k: maxW, uzunluk: maxLen };
  B.enKisa = { k: minW, uzunluk: minLen };
  B.enCokAnlam = { k: maxAW, anlam: maxA };
  B.ortalama = (B.toplamAnlam / B.toplamKelime).toFixed(1);
  B.kokenler = Object.entries(B.kokenler)
    .map(([dil, adet]) => ({ dil, adet, yuzde: Math.round((adet / dictionary.length) * 1000) / 10 }))
    .sort((a, b) => b.adet - a.adet)
    .slice(0, 10);
  return B;
}
const BILGI = istatistikTopla();
const HARF_SOY = (() => {
  const o = {};
  for (const ch of TURKISH_ALPHABET) o[ch] = firstLetters.get(ch) || 0;
  return o;
})();
const ISTAT = (() => {
  let toplamAnlam = 0;
  for (const e of dictionary) toplamAnlam += e.a.length;
  return { kelime: words.length, anlam: toplamAnlam };
})();
const TUR_LIST = (() => {
  const m = new Map();
  for (const e of dictionary) {
    const p = e.a && e.a[0] && e.a[0].p;
    if (p) m.set(p, (m.get(p) || 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20).map(([p]) => p);
})();

/* ---- mini test ---- */
function testUret(adet = 5) {
  const kaplar = [];
  let perde = 0;
  while (kaplar.length < adet && perde++ < 5000) {
    const i = Math.floor(Math.random() * dictionary.length);
    if (!dictionary[i].a.length) continue;
    if (kaplar.indexOf(i) > -1) continue;
    kaplar.push(i);
  }
  return kaplar.map((i) => {
    const e = dictionary[i];
    const anlam = e.a[Math.floor(Math.random() * e.a.length)].m || e.a[0].m;
    const secenekler = [e.k];
    let koruma = 0;
    while (secenekler.length < 4 && koruma++ < 300) {
      const j = Math.floor(Math.random() * dictionary.length);
      const k = dictionary[j].k;
      if (k !== e.k && secenekler.indexOf(k) === -1) secenekler.push(k);
    }
    secenekler.sort(() => Math.random() - 0.5);
    return { anlam, secenekler, dogru: e.k };
  });
}

function search(q, limit = 20) {
  const nq = normalize(q);
  if (!nq) return [];
  const exactHits = exact(q);
  const seen = new Set(exactHits.map((e) => e.k));
  const out = exactHits.slice();
  for (let i = 0; i < normWords.length && out.length < limit; i++) {
    const w = normWords[i];
    if (!w.includes(nq)) continue;
    const entry = dictionary[i];
    if (seen.has(entry.k)) continue;
    seen.add(entry.k);
    out.push(entry);
  }
  return out;
}

function letterList(letter, offset = 0, limit = 60) {
  const nl = String(letter || '').toLocaleLowerCase('tr');
  if (!nl) return { words: [], total: 0, offset, limit };
  const res = [];
  let total = 0;
  for (let i = 0; i < words.length; i++) {
    const L = words[i][0].toLocaleLowerCase('tr');
    if (L === nl) {
      if (total >= offset && res.length < limit) res.push(words[i]);
      total++;
    }
  }
  return { words: res, total, offset, limit };
}

function randomEntry() {
  return dictionary[Math.floor(Math.random() * dictionary.length)];
}

/* ---- günün kelimesi (tarihe bağlı, deterministik) ---- */
function gununKelimesi() {
  const d = new Date();
  const gun = Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 86400000);
  return dictionary[((gun % dictionary.length) + dictionary.length) % dictionary.length];
}

/* ---- gelişmiş filtre araması ---- */
function filtreAra(p = {}) {
  const bas = normalize(p.bas || '').replace(/ /g, '');
  const bit = normalize(p.bit || '').replace(/ /g, '');
  const icer = normalize(p.icer || '').replace(/ /g, '');
  const disla = (String(p.disla || '').toLocaleLowerCase('tr').match(/[a-zçğıöşüâîû]/g) || []);
  const kok = String(p.kok || '').trim().toLocaleLowerCase('tr');
  const tur = String(p.tur || '').trim().toLocaleLowerCase('tr');
  const uzmin = parseInt(p.uzmin || '0', 10) || 0;
  const uzmax = parseInt(p.uzmax || '999', 10) || 999;
  const sinir = Math.min(parseInt(p.l || '200', 10) || 200, 500);
  const sonuc = [];
  for (let i = 0; i < words.length && sonuc.length < sinir; i++) {
    const w = words[i];
    const uz = w.length;
    if (uzmin && uz < uzmin) continue;
    if (uzmax < 999 && uz > uzmax) continue;
    if (bas && !w.startsWith(bas)) continue;
    if (bit && !w.endsWith(bit)) continue;
    if (icer && !w.includes(icer)) continue;
    if (disla.length) {
      let atla = false;
      for (const c of disla) { if (w.includes(c)) { atla = true; break; } }
      if (atla) continue;
    }
    const e = dictionary[i];
    if (kok && !String(e.l || '').toLocaleLowerCase('tr').startsWith(kok)) continue;
    if (tur) {
      const pt = e.a && e.a[0] && e.a[0].p;
      if (!pt || String(pt).toLocaleLowerCase('tr') !== tur) continue;
    }
    sonuc.push({
      k: w,
      ilk: ilkAnlam(e),
      tur: e.a && e.a[0] && e.a[0].p,
      sayi: e.a.length,
      l: e.l,
    });
  }
  return sonuc;
}

function kokenListesi() {
  return {
    kokenler: BILGI.kokenler.slice(0, 15).map((x) => x.dil),
    turler: TUR_LIST,
  };
}

function meanFirstMeaning(e) {
  if (!e || !e.a || !e.a.length) return '';
  return e.a[0].m;
}

function apiArama(q) {
  const list = search(q, 30);
  return list.map((e) => ({
    k: e.k,
    t: e.t,
    l: e.l,
    ilk: meanFirstMeaning(e),
    tur: e.a[0] && e.a[0].p,
    sayi: e.a.length,
  }));
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.apk': 'application/vnd.android.package-archive',
};

function sendJSON(res, obj, durum) {
  const body = JSON.stringify(obj);
  res.writeHead(durum || 200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=60' });
  res.end(body);
}

function serveStatic(req, res, pathname) {
  let file = pathname === '/' ? '/index.html' : pathname;
  const full = path.normalize(path.join(PUB, file));
  if (!full.startsWith(PUB)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  fs.stat(full, (serr, stat) => {
    if (serr) {
      fs.readFile(path.join(PUB, 'index.html'), (e2, d2) => {
        if (e2) {
          res.writeHead(404);
          return res.end('Not found');
        }
        res.writeHead(200, { 'Content-Type': MIME['.html'] });
        res.end(d2);
      });
      return;
    }
    const ext = path.extname(full).toLowerCase();
    const etag = '"' + stat.size.toString(16) + '-' + stat.mtimeMs.toString(16) + '"';
    if (req.headers['if-none-match'] === etag) {
      res.writeHead(304, { ETag: etag, 'Cache-Control': 'no-cache' });
      return res.end();
    }
    fs.readFile(full, (err, data) => {
      if (err) { res.writeHead(404); return res.end('Not found'); }
      res.writeHead(200, {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Cache-Control': 'no-cache',
        'ETag': etag,
      });
      res.end(data);
    });
  });
}

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://localhost');
  const pathname = decodeURIComponent(u.pathname);
  const q = Object.fromEntries(u.searchParams);

  if (pathname === '/api/oneri') {
    return sendJSON(res, suggestWithMeaning(q.q || ''));
  }
  if (pathname === '/api/komsu') {
    return sendJSON(res, komsu(q.q || ''));
  }
  if (pathname === '/api/kayit') {
    const hits = exact(q.q || '');
    if (!hits.length) return sendJSON(res, { bulgu: false, kayitlar: [] });
    return sendJSON(res, { bulgu: true, kayitlar: hits });
  }
  if (pathname === '/api/ara') {
    const liste = apiArama(q.q || '');
    return sendJSON(res, {
      sonuc: liste,
      oneri: liste.length ? [] : benzerOneri(q.q || ''),
    });
  }
  if (pathname === '/api/desen') {
    return sendJSON(res, desenAra(q.q || '', parseInt(q.l || '80', 10) || 80));
  }
  if (pathname === '/api/test') {
    return sendJSON(res, testUret(parseInt(q.n || '5', 10) || 5));
  }
  if (pathname === '/api/bilgi') {
    return sendJSON(res, BILGI);
  }
  if (pathname === '/api/harf') {
    return sendJSON(res, letterList(q.h || '', parseInt(q.o || '0', 10) || 0, parseInt(q.l || '60', 10) || 60));
  }
  if (pathname === '/api/harf-sayilari') {
    return sendJSON(res, HARF_SOY);
  }
  if (pathname === '/api/ozet') {
    return sendJSON(res, { ist: ISTAT, harfs: HARF_SOY });
  }
  if (pathname === '/api/rastgele') {
    return sendJSON(res, randomEntry());
  }
  if (pathname === '/api/istatistik') {
    return sendJSON(res, ISTAT);
  }
  if (pathname === '/api/gunun') {
    return sendJSON(res, gununKelimesi());
  }
  if (pathname === '/api/kokenler') {
    return sendJSON(res, kokenListesi());
  }
  if (pathname === '/api/filtre') {
    return sendJSON(res, filtreAra(q));
  }
  if (pathname === '/api/ai') {
    let govde = '';
    req.on('data', (c) => {
      if (govde.length > 4000) return;
      govde += c;
    });
    req.on('end', () => {
      let prompt = '';
      try { prompt = String((JSON.parse(govde) || {}).prompt || '').slice(0, 1200); } catch (e) { prompt = ''; }
      if (!prompt.trim()) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end('{"hata":"soru boş"}');
      }
      const ctl = new AbortController();
      const zamanlayici = setTimeout(() => ctl.abort(), 80000);
      const aiIste = (retry) => {
        fetch('https://text.pollinations.ai/', {
          method: 'POST',
          signal: ctl.signal,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'curl/8.5.0'
          },
          body: JSON.stringify({
            messages: [{ role: 'user', content: String(prompt) }],
            model: 'openai'
          })
        }).then((r) => r.text().then((metin) => ({ durum: r.status, metin })))
          .then((av) => {
            if ((av.durum === 429 || av.durum >= 500) && retry < 2) {
              setTimeout(() => aiIste(retry + 1), 4000);
              return;
            }
            if (av.durum >= 400) {
              res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
              return res.end(JSON.stringify({ hata: 'AI yanıt veremedi (' + av.durum + ')' }));
            }
            res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end(String(av.metin || ''));
          })
          .catch((e) => {
            res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ hata: (e && e.name === 'AbortError') ? 'AI uzun sürdü' : 'AI servisine ulaşılamadı' }));
          })
          .finally(() => {
            if (retry >= 2) clearTimeout(zamanlayici);
          });
      };
      aiIste(0);
    });
    return;
  }
  if (pathname === '/panel') {
    fs.readFile(path.join(__dirname, 'panel-ui.html'), 'utf8', (err, html) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('panel-ui.html bulunamadı');
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    });
    return;
  }
  if (pathname === '/api/panel/giris') {
    return panelBodyOku(req, 4000, (govde) => {
      if (!panelTeoriOncesi()) {
        return sendPJSON(res, { hata: 'çok fazla deneme — 10 dakika bekleyin' }, 429);
      }
      let g = '';
      try { g = String((JSON.parse(govde) || {}).sifre || ''); } catch (e) {}
      if (!panelSifreDogru(g)) {
        return sendPJSON(res, { hata: 'yanlış şifre' }, 401);
      }
      sendPJSON(res, { token: panelTokenUret() });
    });
  }
  if (pathname === '/api/panel/durum') {
    if (!panelTokenGecerli(req.headers['x-panel-token'])) return sendPJSON(res, { hata: 'giriş gerekli' }, 401);
    const okuJson = (p, v) => {
      try { v = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) {}
      return v;
    };
    let appSurum = null;
    try {
      const sx = fs.readFileSync(path.join(PUB, 'app.js'), 'utf8');
      const m = sx.match(/var SURUM = \{ ad: '([^']*)', kod: (\d+) \}/);
      if (m) appSurum = { ad: m[1], kod: parseInt(m[2], 10) };
    } catch (e) {}
    let apkBilgi = null;
    try {
      const st = fs.statSync(path.join(DISTS, 'tsozlukv1.apk'));
      apkBilgi = {
        boyut: st.size,
        tarih: new Date(st.mtime).toLocaleString('tr-TR'),
        isim: 'tsozlukv1.apk'
      };
    } catch (e) {}
    let surumler = [];
    try { surumler = okuJson(path.join(PUB, 'surum.json'), null) ? [okuJson(path.join(PUB, 'surum.json'), null)] : []; } catch (e) {}
    if (surumler.length && surumler[0] === null) surumler = [];
    let gitSon = '';
    let gitDurum = '';
    exec('git log -1 --format="%h %s" && echo "" && git status --porcelain | head -15', { cwd: __dirname }, (e, cik, cserr) => {
      const c = cik || cserr || '';
      const ilk = c.split('\n');
      gitSon = ilk[0] || '';
      gitDurum = ilk.slice(1).join('\n').trim();
      sendPJSON(res, {
        surum: surumler[0] || null,
        appSurum,
        apkBilgi,
        gitSon,
        gitDurum,
        sifreKurulu: !!PANEL_SIFRE
      });
    });
    return;
  }
  if (pathname === '/api/panel/surum') {
    if (!panelTokenGecerli(req.headers['x-panel-token'])) return sendPJSON(res, { hata: 'giriş gerekli' }, 401);
    return panelBodyOku(req, 4000, (govde) => {
      let ad = '';
      let kod = 0;
      try {
        const b = JSON.parse(govde) || {};
        ad = String(b.ad || '').trim();
        kod = parseInt(b.kod, 10);
      } catch (e) {}
      if (!ad || !(kod > 0)) return sendPJSON(res, { hata: 'ad ve kod gerekli' }, 400);
      const ap = path.join(PUB, 'app.js');
      try {
        const sx = fs.readFileSync(ap, 'utf8');
        const neu = sx.replace(/var SURUM = \{ ad: '([^']*)', kod: (\d+) \}/, "var SURUM = { ad: '" + ad + "', kod: " + kod + " }");
        if (neu === sx) return sendPJSON(res, { hata: 'SURUM satırı bulunamadı' }, 500);
        fs.writeFileSync(ap, neu);
        const sj = JSON.stringify({ ad, kod, apk: '/tsozlukv1.apk' }, null, 2);
        fs.writeFileSync(path.join(PUB, 'surum.json'), sj);
        try { fs.writeFileSync(path.join(NETLIFY, 'surum.json'), sj); } catch (e) {}
        sendPJSON(res, { tamam: true, ad, kod });
      } catch (e) {
        sendPJSON(res, { hata: String(e && e.message || e) }, 500);
      }
    });
  }
  if (pathname === '/api/panel/apk') {
    if (!panelTokenGecerli(req.headers['x-panel-token'])) return sendPJSON(res, { hata: 'giriş gerekli' }, 401);
    return panelBodyOku(req, 150 * 1024 * 1024, (govde) => {
      let veri = '';
      try {
        const b = JSON.parse(govde) || {};
        veri = String(b.veriB64 || '');
      } catch (e) {}
      if (!veri) return sendPJSON(res, { hata: 'veri boş' }, 400);
      try {
        const buf = Buffer.from(veri, 'base64');
        if (buf.length < 100000 || buf.length > 150 * 1024 * 1024) {
          return sendPJSON(res, { hata: 'geçersiz dosya boyutu' }, 400);
        }
        fs.mkdirSync(DISTS, { recursive: true });
        fs.writeFileSync(path.join(DISTS, 'tsozlukv1.apk'), buf);
        try { fs.writeFileSync(path.join(PUB, 'tsozlukv1.apk'), buf); } catch (e) {}
        try { fs.writeFileSync(path.join(NETLIFY, 'tsozlukv1.apk'), buf); } catch (e) {}
        sendPJSON(res, { tamam: true, boyut: buf.length });
      } catch (e) {
        sendPJSON(res, { hata: String(e && e.message || e) }, 500);
      }
    });
  }
  if (pathname === '/api/panel/git') {
    if (!panelTokenGecerli(req.headers['x-panel-token'])) return sendPJSON(res, { hata: 'giriş gerekli' }, 401);
    return panelBodyOku(req, 4000, (govde) => {
      let mesaj = '';
      let push = true;
      try {
        const b = JSON.parse(govde) || {};
        mesaj = String(b.mesaj || '').trim();
        push = b.push !== false;
      } catch (e) {}
      if (!mesaj) return sendPJSON(res, { hata: 'commit mesajı gerekli' }, 400);
      exec('git add -A && git commit -m ' + JSON.stringify(mesaj.slice(0, 200)), { cwd: __dirname }, (e1, c1) => {
        let log1 = (c1 || '').trim() + (e1 ? (' | hata: ' + e1.message.split('\n')[0]) : '');
        if (!push) return sendPJSON(res, { tamam: true, log: log1 || 'değişiklik yok' });
        exec('git push origin main', { cwd: __dirname, env: Object.assign({}, process.env, { GIT_TERMINAL_PROMPT: '0' }) }, (e2, c2) => {
          let log2 = (c2 || '').trim() + (e2 ? (' | hata: ' + e2.message.split('\n')[0]) : '');
          sendPJSON(res, { tamam: true, log: log1 + '\n--- push ---\n' + log2 });
        });
      });
    });
  }
  if (pathname.startsWith('/api/')) {
    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end('{"hata":"bulunamadı"}');
  }
  serveStatic(req, res, pathname);
});

server.listen(PORT, () => {
  console.log(`Türkçe Sözlük (Demo) çalışıyor: http://localhost:${PORT}`);
  console.log(`Kelime sayısı: ${words.length}`);
  console.log(`Yönetim paneli: http://localhost:${PORT}/panel`);
  console.log(`Panel şifresi (.panel-sifre): ${PANEL_SIFRE}`);
});
