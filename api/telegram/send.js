const { json, handleOptions } = require('../_lib/http');
const { telegramPost } = require('../_lib/telegram');

module.exports = async (req, res) => {
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Method not allowed' });

  const { token, chatId, text } = req.body || {};
  if (!token || !chatId || !text) {
    return json(res, 400, { ok: false, error: 'token, chatId e text sao obrigatorios' });
  }

  try {
    const tg = await telegramPost(token, 'sendMessage', { chat_id: chatId, text });
    if (tg.ok) return json(res, 200, { ok: true, message: 'Mensagem enviada ao Telegram' });
    return json(res, 400, { ok: false, error: tg.description });
  } catch (e) {
    return json(res, 502, { ok: false, error: `Erro ao contactar Telegram: ${e.message}` });
  }
};
