const SYSTEM_PROMPT = `Você é o assistente IA do IDespector, um painel pessoal de produtividade.
Ajude com tarefas, hábitos, organização, motivação, estudos e perguntas gerais (incluindo notícias, esportes e cultura quando souber).
Responda sempre em português do Brasil, de forma clara, objetiva e amigável.
Use listas curtas quando fizer sentido. Para dados do painel do usuário, use o contexto fornecido; se não souber algo atualizado, diga honestamente.`;

function normalizeMessages(messages) {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && String(m.content || '').trim())
    .slice(-20)
    .map((m) => ({ role: m.role, content: String(m.content).trim().slice(0, 4000) }));
}

function buildSystemPrompt(context) {
  const ctx = String(context || '').trim().slice(0, 1500);
  return ctx ? `${SYSTEM_PROMPT}\n\nContexto atual do painel:\n${ctx}` : SYSTEM_PROMPT;
}

async function callOpenAICompatible(baseUrl, apiKey, model, messages, options = {}) {
  const normalized = normalizeMessages(messages);
  if (!normalized.length || normalized[normalized.length - 1].role !== 'user') {
    throw new Error('Envie pelo menos uma mensagem do usuário.');
  }

  const system = buildSystemPrompt(options.context);
  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
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
    const msg = data?.error?.message || `HTTP ${res.status}`;
    throw new Error(msg);
  }

  const reply = String(data?.choices?.[0]?.message?.content || '').trim();
  if (!reply) throw new Error('Resposta vazia da IA.');
  return { reply, model: data?.model || model, provider: baseUrl.includes('groq') ? 'groq' : 'openai' };
}

async function callPollinationsFree(messages, options = {}) {
  const normalized = normalizeMessages(messages);
  if (!normalized.length || normalized[normalized.length - 1].role !== 'user') {
    throw new Error('Envie pelo menos uma mensagem do usuário.');
  }

  const system = buildSystemPrompt(options.context);
  let prompt = `${system}\n\nConversa:\n`;
  for (const m of normalized) {
    prompt += `${m.role === 'user' ? 'Usuário' : 'Assistente'}: ${m.content}\n`;
  }
  prompt += 'Assistente:';

  const url = `https://text.pollinations.ai/${encodeURIComponent(prompt.slice(0, 12000))}?model=openai`;
  const res = await fetch(url, { signal: AbortSignal.timeout(55000) });
  if (!res.ok) throw new Error(`IA gratuita indisponível (HTTP ${res.status})`);

  const reply = String(await res.text()).trim();
  if (!reply) throw new Error('Resposta vazia da IA.');
  return { reply, model: 'openai-via-pollinations', provider: 'pollinations' };
}

async function chatCompletion(messages, options = {}) {
  const userKey = String(options.apiKey || '').trim();
  const openaiKey = userKey || String(process.env.OPENAI_API_KEY || '').trim();
  const groqKey = String(process.env.GROQ_API_KEY || '').trim();
  const errors = [];

  if (openaiKey) {
    try {
      const model = String(process.env.OPENAI_MODEL || 'gpt-4o-mini').trim();
      return await callOpenAICompatible(
        'https://api.openai.com/v1',
        openaiKey,
        model,
        messages,
        options
      );
    } catch (err) {
      errors.push(err);
      if (!groqKey || userKey) {
        try {
          return await callPollinationsFree(messages, options);
        } catch (freeErr) {
          errors.push(freeErr);
          throw err;
        }
      }
    }
  }

  if (groqKey) {
    try {
      const model = String(process.env.GROQ_MODEL || 'llama-3.3-70b-versatile').trim();
      return await callOpenAICompatible(
        'https://api.groq.com/openai/v1',
        groqKey,
        model,
        messages,
        options
      );
    } catch (err) {
      errors.push(err);
    }
  }

  try {
    return await callPollinationsFree(messages, options);
  } catch (err) {
    errors.push(err);
  }

  throw new Error(errors[0]?.message || 'IA temporariamente indisponível. Tente novamente em instantes.');
}

module.exports = { chatCompletion, normalizeMessages, SYSTEM_PROMPT, callOpenAICompatible, callPollinationsFree };
