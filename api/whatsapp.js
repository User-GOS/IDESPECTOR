const { json, handleOptions } = require('./_lib/http');

const EXAMPLE_KEYS = new Set(['123123', '123456', '1234567', '0000000', '1234567890']);

function normalizePhone(raw) {
  let phone = String(raw || '').trim().replace(/[\s\-()]/g, '');
  if (!phone.startsWith('+')) {
    const m = phone.match(/^(55)?(\d{10,11})$/);
    if (m) phone = `+${m[1] ? phone : '55' + phone}`;
    else phone = `+${phone}`;
  }
  return phone;
}

module.exports = async (req, res) => {
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Method not allowed' });

  const { phone: rawPhone, apikey, text } = req.body || {};
  if (!rawPhone || !apikey || !text) {
    return json(res, 400, { ok: false, error: 'phone, apikey e text sao obrigatorios' });
  }

  const phone = normalizePhone(rawPhone);
  const key = String(apikey).trim();
  if (EXAMPLE_KEYS.has(key)) {
    return json(res, 400, {
      ok: false,
      error: 'API Key de exemplo invalida. Use a chave REAL que o CallMeBot enviou no seu WhatsApp.',
    });
  }

  const url =
    `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(phone)}` +
    `&apikey=${encodeURIComponent(key)}&text=${encodeURIComponent(text)}`;

  try {
    const wa = await fetch(url, { signal: AbortSignal.timeout(25000) });
    const respBody = (await wa.text()).trim();
    const statusCode = wa.status;
    const hasError = /invalid|error|wrong|not activated|not found|denied|expired|APIKey is invalid/i.test(respBody);

    if (hasError) {
      let msg = 'API Key invalida ou WhatsApp nao ativado.';
      if (/APIKey is invalid/i.test(respBody)) msg = 'API Key incorreta. Use a chave REAL do CallMeBot (nao use 123123).';
      else if (/not activated/i.test(respBody)) msg = 'WhatsApp nao ativado. Envie a mensagem de ativacao ao CallMeBot.';
      return json(res, 400, { ok: false, error: msg, detail: respBody, status: statusCode });
    }

    return json(res, 200, {
      ok: true,
      status: statusCode,
      message: 'Mensagem enviada ao WhatsApp',
      detail: respBody,
    });
  } catch (e) {
    return json(res, 502, { ok: false, error: `Erro ao contactar CallMeBot: ${e.message}` });
  }
};
