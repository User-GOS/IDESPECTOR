const { json, handleOptions } = require('../_lib/http');
const { telegramGet } = require('../_lib/telegram');

module.exports = async (req, res) => {
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Method not allowed' });

  const token = String(req.body?.token || '').trim();
  if (!token) return json(res, 400, { ok: false, error: 'token obrigatorio' });

  try {
    try {
      await telegramGet(token, 'deleteWebhook', 'drop_pending_updates=false');
    } catch (_) {}
    const tg = await telegramGet(token, 'getMe');
    if (tg.ok) {
      const username = tg.result.username;
      return json(res, 200, { ok: true, botUsername: username, botLink: `https://t.me/${username}` });
    }
    return json(res, 400, { ok: false, error: tg.description });
  } catch (e) {
    return json(res, 502, { ok: false, error: `Erro ao validar token: ${e.message}` });
  }
};
