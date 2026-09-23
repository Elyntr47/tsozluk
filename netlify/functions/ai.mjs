export async function handler(event) {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: cors, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: cors, body: JSON.stringify({ hata: 'POST gerek' }) };
  }
  let prompt = '';
  try { prompt = String(JSON.parse(event.body || '{}').prompt || '').slice(0, 1200); } catch (e) {}
  if (!prompt.trim()) {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ hata: 'soru boş' }) };
  }
  const ctl = new AbortController();
  const zamanlayici = setTimeout(() => ctl.abort(), 24000);
  try {
    const r = await fetch('https://text.pollinations.ai/', {
      method: 'POST',
      signal: ctl.signal,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'curl/8.5.0'
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: prompt }],
        model: 'openai'
      })
    });
    const metin = await r.text();
    if (r.status >= 400) {
      return { statusCode: 502, headers: cors, body: JSON.stringify({ hata: 'AI yanıt veremedi (' + r.status + ')' }) };
    }
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', ...cors },
      body: metin
    };
  } catch (e) {
    return {
      statusCode: 502,
      headers: cors,
      body: JSON.stringify({ hata: (e && e.name === 'AbortError') ? 'AI uzun sürdü' : 'AI servisine ulaşılamadı' })
    };
  } finally {
    clearTimeout(zamanlayici);
  }
}