const { json, handleOptions } = require('./_lib/http');
const { translateText } = require('./_lib/translate');

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
    const text = await translateText(q, langpair);
    return json(res, 200, { ok: true, text, langpair, provider: 'google+mymemory' });
  } catch (err) {
    return json(res, 502, { ok: false, error: err.message || 'Falha ao traduzir' });
  }
};
