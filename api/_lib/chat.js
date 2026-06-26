const SYSTEM_PROMPT = `Você é o assistente IA do IDespector, um painel pessoal de produtividade.
Ajude com tarefas, hábitos, organização, motivação, estudos e perguntas gerais.
Responda sempre em português do Brasil, de forma clara, objetiva e amigável.
Use listas curtas quando fizer sentido. Não invente dados do painel — se não souber, diga.`;

function normalizeMessages(messages) {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && String(m.content || '').trim())
    .slice(-20)
    .map((m) => ({ role: m.role, content: String(m.content).trim().slice(0, 4000) }));
}

async function chatCompletion(messages, options = {}) {
  const apiKey = String(options.apiKey || process.env.OPENAI_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error(
      'IA não configurada. Defina OPENAI_API_KEY na Vercel ou informe sua chave no chat (ícone ⚙).'
    );
  }

  const normalized = normalizeMessages(messages);
  if (!normalized.length || normalized[normalized.length - 1].role !== 'user') {
    throw new Error('Envie pelo menos uma mensagem do usuário.');
  }

  const model = String(process.env.OPENAI_MODEL || 'gpt-4o-mini').trim();
  const context = String(options.context || '').trim().slice(0, 1500);
  const system = context ? `${SYSTEM_PROMPT}\n\nContexto atual do painel:\n${context}` : SYSTEM_PROMPT;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: system }, ...normalized],
      max_tokens: 900,
      temperature: 0.65,
    }),
    signal: AbortSignal.timeout(45000),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || `OpenAI HTTP ${res.status}`;
    throw new Error(msg);
  }

  const reply = String(data?.choices?.[0]?.message?.content || '').trim();
  if (!reply) throw new Error('Resposta vazia da IA.');
  return { reply, model: data?.model || model };
}

module.exports = { chatCompletion, normalizeMessages, SYSTEM_PROMPT };
