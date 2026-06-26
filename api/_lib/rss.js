function decodeEntities(s) {
  return String(s || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/<[^>]+>/g, '')
    .trim();
}

function extractTag(block, tag) {
  const cdata = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i');
  const m1 = block.match(cdata);
  if (m1) return decodeEntities(m1[1]);
  const plain = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m2 = block.match(plain);
  return m2 ? decodeEntities(m2[1]) : '';
}

function splitTitleSource(title) {
  let t = String(title || '').trim();
  let source = '';
  if (t.includes(' - ')) {
    const parts = t.split(' - ');
    source = parts.pop().trim();
    t = parts.join(' - ').trim();
  }
  return { title: t, source };
}

function parseRssItems(xml, limit = 8) {
  const items = [];
  const re = /<item[\s>]([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = re.exec(xml)) && items.length < limit) {
    const block = m[1];
    let title = extractTag(block, 'title');
    const url = extractTag(block, 'link');
    const publishedAt = extractTag(block, 'pubDate');
    let source = extractTag(block, 'source');
    if (!source) {
      const split = splitTitleSource(title);
      title = split.title;
      source = split.source;
    } else {
      const suffix = ` - ${source}`;
      if (title.endsWith(suffix)) title = title.slice(0, -suffix.length).trim();
    }
    if (!title || !url) continue;
    items.push({
      title,
      url,
      source: source || 'Notícias',
      publishedAt: publishedAt || '',
    });
  }
  return items;
}

const NEWS_FEEDS = [
  { name: 'G1 São Paulo', url: 'https://g1.globo.com/rss/g1/sao-paulo/' },
  { name: 'Google News · SP', url: 'https://news.google.com/rss/search?q=S%C3%A3o+Paulo&hl=pt-BR&gl=BR&ceid=BR:pt-419' },
  { name: 'G1 · SP', url: 'https://g1.globo.com/rss/g1/sp/' },
];

async function fetchDailyNews(limit = 8) {
  let lastError = null;
  for (const feed of NEWS_FEEDS) {
    try {
      const res = await fetch(feed.url, {
        headers: {
          'User-Agent': 'IDespector/1.0 (+https://github.com/User-GOS/IDESPECTOR)',
          Accept: 'application/rss+xml, application/xml, text/xml, */*',
        },
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) {
        lastError = new Error(`${feed.name}: HTTP ${res.status}`);
        continue;
      }
      const xml = await res.text();
      const items = parseRssItems(xml, limit);
      if (items.length) {
        return { items, source: feed.name };
      }
      lastError = new Error(`${feed.name}: feed vazio`);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error('Nenhuma fonte de notícias disponível');
}

module.exports = { parseRssItems, fetchDailyNews };
