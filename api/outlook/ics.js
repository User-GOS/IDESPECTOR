const { json, handleOptions } = require('../_lib/http');

module.exports = async (req, res) => {
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Method not allowed' });

  let url = String(req.body?.url || '').trim();
  if (!url) return json(res, 400, { ok: false, error: 'url obrigatoria' });

  url = url.replace(/^webcal:/i, 'https:');

  try {
    const ics = await fetch(url, { signal: AbortSignal.timeout(30000) });
    const text = await ics.text();
    if (!text || !/BEGIN:VCALENDAR/i.test(text)) {
      return json(res, 400, { ok: false, error: 'Resposta nao parece um calendario ICS valido' });
    }
    return json(res, 200, { ok: true, ics: text });
  } catch (e) {
    return json(res, 502, { ok: false, error: `Erro ao baixar ICS: ${e.message}` });
  }
};
