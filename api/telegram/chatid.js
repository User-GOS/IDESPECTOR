const { json, handleOptions } = require('../_lib/http');
const { getTelegramChatId } = require('../_lib/telegram');

module.exports = async (req, res) => {
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Method not allowed' });

  const token = String(req.body?.token || '').trim();
  if (!token) return json(res, 400, { ok: false, error: 'token obrigatorio' });

  try {
    const result = await getTelegramChatId(token);
    if (result.ok) return json(res, 200, { ok: true, chatId: result.chatId });
    return json(res, 404, { ok: false, error: result.error });
  } catch (e) {
    return json(res, 502, { ok: false, error: `Erro ao buscar chat: ${e.message}` });
  }
};
