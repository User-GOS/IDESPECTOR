const { json, handleOptions } = require('./_lib/http');

function pickBestTranslation(data) {
  const matches = Array.isArray(data?.matches) ? data.matches : [];
  const best = matches
    .filter((m) => m?.translation && !/MYMEMORY WARNING|INVALID/i.test(m.translation))
    .sort((a, b) => (Number(b.match) || 0) - (Number(a.match) || 0))[0];
  const text = (best?.translation || data?.responseData?.translatedText || '').trim();
  if (!text || /MYMEMORY WARNING|INVALID/i.test(text)) {
    throw new Error(data?.responseDetails || 'Tradução indisponível');
  }
  return text;
}

module.exports = async (req, res) => {
  if (handleOptions(req, res)) return;

  if (req.method !== 'GET') {
    return json(res, 405, { ok: false, error: 'Method not allowed' });
  }

  const q = String(req.query.q || req.query.text || '').trim();
  const langpair = String(req.query.langpair || '').trim();

  if (!q) return json(res, 400, { ok: false, error: 'Parâmetro q é obrigatório' });
  if (!langpair || !/^[a-z]{2}\|[a-z]{2}$/i.test(langpair)) {
    return json(res, 400, { ok: false, error: 'langpair inválido (ex: pt|en)' });
  }
  if (q.length > 2000) {
    return json(res, 400, { ok: false, error: 'Texto muito longo (máx. 2000 caracteres por requisição)' });
  }

  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(q)}&langpair=${encodeURIComponent(langpair)}`;
    const resp = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    if (Number(data.responseStatus) !== 200) {
      throw new Error(data.responseDetails || 'API de tradução retornou erro');
    }
    const text = pickBestTranslation(data);
    return json(res, 200, { ok: true, text, langpair });
  } catch (err) {
    return json(res, 502, { ok: false, error: err.message || 'Falha ao traduzir' });
  }
};
