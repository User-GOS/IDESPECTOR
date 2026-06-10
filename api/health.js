const { json, handleOptions } = require('./_lib/http');

module.exports = (req, res) => {
  if (handleOptions(req, res)) return;
  if (req.method !== 'GET') return json(res, 405, { ok: false, error: 'Method not allowed' });
  json(res, 200, { ok: true, platform: 'vercel' });
};
