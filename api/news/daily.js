const { json, handleOptions } = require('../_lib/http');
const { fetchDailyNews } = require('../_lib/rss');

module.exports = async (req, res) => {
  if (handleOptions(req, res)) return;
  if (req.method !== 'GET') return json(res, 405, { ok: false, error: 'Method not allowed' });

  const limit = Math.min(Math.max(parseInt(req.query?.limit, 10) || 8, 1), 15);

  try {
    const { items, source } = await fetchDailyNews(limit);
    const today = new Date().toISOString().slice(0, 10);
    json(res, 200, {
      ok: true,
      date: today,
      feed: source,
      items,
    });
  } catch (err) {
    json(res, 502, {
      ok: false,
      error: err?.message || 'Erro ao buscar notícias',
    });
  }
};
