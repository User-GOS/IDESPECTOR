const { json, handleOptions } = require('../_lib/http');
const { fetchWeatherForecast } = require('../_lib/weather');

module.exports = async (req, res) => {
  if (handleOptions(req, res)) return;
  if (req.method !== 'GET') return json(res, 405, { ok: false, error: 'Method not allowed' });

  try {
    const forecast = await fetchWeatherForecast();
    json(res, 200, { ok: true, ...forecast });
  } catch (err) {
    json(res, 502, {
      ok: false,
      error: err?.message || 'Erro ao buscar previsão do tempo',
    });
  }
};
