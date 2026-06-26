const { json, handleOptions } = require('./_lib/http');
const { chatCompletion } = require('./_lib/chat');

module.exports = async (req, res) => {
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Method not allowed' });

  const body = req.body || {};
  const messages = body.messages;
  const context = body.context;
  const apiKey = body.apiKey;

  try {
    const result = await chatCompletion(messages, { context, apiKey });
    json(res, 200, { ok: true, reply: result.reply, model: result.model });
  } catch (err) {
    const msg = err?.message || 'Erro ao conversar com a IA';
    const status = /não configurada|Envie pelo menos/i.test(msg) ? 503 : 502;
    json(res, status, { ok: false, error: msg });
  }
};
