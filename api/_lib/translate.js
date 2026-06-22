function normCompare(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isTooSimilar(source, translation) {
  const a = normCompare(source);
  const b = normCompare(translation);
  if (!a || !b) return true;
  if (a === b) return true;
  if (a.replace(/\s/g, '') === b.replace(/\s/g, '')) return true;
  const srcWords = a.split(' ').filter(Boolean);
  const outWords = b.split(' ').filter(Boolean);
  if (srcWords.length > 2 && outWords.length >= srcWords.length - 1) {
    const overlap = srcWords.filter((w) => outWords.includes(w)).length;
    if (overlap / srcWords.length >= 0.85) return true;
  }
  return false;
}

function looksPortuguese(text) {
  if (/[áàâãéêíóôõúç]/i.test(text)) return true;
  const words = normCompare(text).split(' ').filter(Boolean);
  const markers = new Set([
    'eu', 'quero', 'voce', 'você', 'nao', 'não', 'estou', 'para', 'com', 'uma', 'um',
    'ao', 'aos', 'da', 'do', 'das', 'dos', 'ir', 'cinema', 'obrigado', 'bom', 'dia',
    'café', 'cafe', 'preciso', 'ajuda', 'tudo', 'bem', 'obrigada', 'por', 'favor',
  ]);
  let hits = 0;
  for (const w of words) if (markers.has(w)) hits++;
  return hits >= 2 || (words.length <= 8 && hits >= 1 && !/\b(the|and|want|go|movies|coffee|please|thank)\b/i.test(text));
}

function looksEnglish(text) {
  if (/\b(the|and|want|go|to|movies|coffee|please|thank|you|hello|good|morning|i|is|are|was|have)\b/i.test(text)) {
    return true;
  }
  return !looksPortuguese(text) && /^[\x00-\x7F'".,!?;:()\-–—\s\d]+$/.test(text);
}

function isValidTranslation(source, translation, langpair) {
  const [from, to] = String(langpair || '').split('|');
  const text = String(translation || '').trim();
  if (!text || /MYMEMORY WARNING|INVALID/i.test(text)) return false;
  if (isTooSimilar(source, text)) return false;
  if (from === 'pt' && to === 'en') {
    if (looksPortuguese(text) && !looksEnglish(text)) return false;
  }
  if (from === 'en' && to === 'pt') {
    if (looksEnglish(text) && !looksPortuguese(text) && !/[áàâãéêíóôõúç]/i.test(text)) {
      const ptHints = /\b(bom|dia|obrigad|você|voce|preciso|ajuda|tudo|bem|café|cafe)\b/i;
      if (!ptHints.test(text)) return false;
    }
  }
  return true;
}

function pickBestMyMemory(data, source, langpair) {
  const candidates = [];
  const main = data?.responseData?.translatedText;
  if (main) {
    candidates.push({ text: String(main).trim(), match: Number(data?.responseData?.match) || 0.55 });
  }
  for (const m of data?.matches || []) {
    if (!m?.translation) continue;
    candidates.push({ text: String(m.translation).trim(), match: Number(m.match) || 0 });
  }

  const valid = candidates.filter((c) => isValidTranslation(source, c.text, langpair));
  valid.sort((a, b) => b.match - a.match);
  if (!valid.length) throw new Error('Nenhuma tradução válida encontrada');
  return valid[0].text;
}

async function translateViaGoogle(text, from, to) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(from)}&tl=${encodeURIComponent(to)}&dt=t&q=${encodeURIComponent(text)}`;
  const resp = await fetch(url, {
    headers: {
      Accept: 'application/json,text/plain,*/*',
      'User-Agent': 'IDespector/1.0',
    },
  });
  if (!resp.ok) throw new Error(`Google HTTP ${resp.status}`);
  const data = await resp.json();
  const parts = Array.isArray(data?.[0]) ? data[0] : [];
  const out = parts.map((p) => (Array.isArray(p) ? p[0] : '')).join('').trim();
  if (!out) throw new Error('Resposta vazia do Google Translate');
  return out;
}

async function translateViaMyMemory(text, langpair) {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(langpair)}`;
  const resp = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!resp.ok) throw new Error(`MyMemory HTTP ${resp.status}`);
  const data = await resp.json();
  if (Number(data.responseStatus) !== 200) {
    throw new Error(data.responseDetails || 'MyMemory retornou erro');
  }
  return pickBestMyMemory(data, text, langpair);
}

async function translateText(text, langpair) {
  const q = String(text || '').trim();
  if (!q) throw new Error('Texto vazio');
  if (!langpair || !/^[a-z]{2}\|[a-z]{2}$/i.test(langpair)) {
    throw new Error('langpair inválido');
  }
  const [from, to] = langpair.split('|');

  const attempts = [
  async () => translateViaGoogle(q, from, to),
  async () => translateViaMyMemory(q, langpair),
  ];

  let lastError = null;
  for (const attempt of attempts) {
    try {
      const result = await attempt();
      if (isValidTranslation(q, result, langpair)) return result;
      lastError = new Error('Tradução inválida');
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error('Falha ao traduzir');
}

module.exports = {
  translateText,
  isValidTranslation,
  pickBestMyMemory,
  normCompare,
};
