async function telegramGet(token, method, query = '') {
  let url = `https://api.telegram.org/bot${token}/${method}`;
  if (query) url += `?${query}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(25000) });
  return res.json();
}

async function telegramPost(token, method, body) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
    signal: AbortSignal.timeout(25000),
  });
  return res.json();
}

async function getTelegramChatId(token) {
  try {
    await telegramGet(token, 'deleteWebhook', 'drop_pending_updates=false');
  } catch (_) {}

  const tg = await telegramGet(token, 'getUpdates', 'limit=100&timeout=0');
  if (!tg.ok) return { ok: false, error: tg.description };

  const updates = tg.result || [];
  if (!updates.length) {
    return { ok: false, error: 'Nenhuma mensagem encontrada. Abra seu bot no Telegram e envie /start.' };
  }

  let chatId = null;
  let lastUpdateId = 0;
  for (let i = updates.length - 1; i >= 0; i--) {
    const u = updates[i];
    const chat =
      u.message?.chat ||
      u.edited_message?.chat ||
      u.callback_query?.message?.chat;
    if (chat?.id) {
      chatId = String(chat.id);
      lastUpdateId = u.update_id;
      break;
    }
  }

  if (!chatId) {
    return { ok: false, error: 'Mensagens encontradas, mas sem Chat ID. Envie /start ao seu bot.' };
  }

  try {
    await telegramGet(token, 'getUpdates', `offset=${lastUpdateId + 1}&limit=1`);
  } catch (_) {}

  return { ok: true, chatId };
}

module.exports = { telegramGet, telegramPost, getTelegramChatId };
