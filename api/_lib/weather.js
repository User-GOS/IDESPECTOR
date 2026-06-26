const SAO_PAULO = { lat: -23.5505, lon: -46.6333, name: 'São Paulo, SP' };

const WEATHER_CODES = {
  0: { label: 'Céu limpo', icon: '☀️' },
  1: { label: 'Predom. limpo', icon: '🌤️' },
  2: { label: 'Parcial. nublado', icon: '⛅' },
  3: { label: 'Nublado', icon: '☁️' },
  45: { label: 'Neblina', icon: '🌫️' },
  48: { label: 'Neblina', icon: '🌫️' },
  51: { label: 'Garoa leve', icon: '🌦️' },
  53: { label: 'Garoa', icon: '🌦️' },
  55: { label: 'Garoa forte', icon: '🌧️' },
  56: { label: 'Garoa congelante', icon: '🌧️' },
  57: { label: 'Garoa congelante', icon: '🌧️' },
  61: { label: 'Chuva fraca', icon: '🌧️' },
  63: { label: 'Chuva', icon: '🌧️' },
  65: { label: 'Chuva forte', icon: '🌧️' },
  66: { label: 'Chuva congelante', icon: '🌧️' },
  67: { label: 'Chuva congelante', icon: '🌧️' },
  71: { label: 'Neve fraca', icon: '🌨️' },
  73: { label: 'Neve', icon: '🌨️' },
  75: { label: 'Neve forte', icon: '🌨️' },
  77: { label: 'Grãos de neve', icon: '🌨️' },
  80: { label: 'Pancadas leves', icon: '🌦️' },
  81: { label: 'Pancadas', icon: '🌦️' },
  82: { label: 'Pancadas fortes', icon: '⛈️' },
  85: { label: 'Neve em pancadas', icon: '🌨️' },
  86: { label: 'Neve em pancadas', icon: '🌨️' },
  95: { label: 'Tempestade', icon: '⛈️' },
  96: { label: 'Tempestade c/ granizo', icon: '⛈️' },
  99: { label: 'Tempestade c/ granizo', icon: '⛈️' },
};

function weatherFromCode(code, isDay = true) {
  const base = WEATHER_CODES[code] || { label: 'Tempo variável', icon: '🌡️' };
  if (isDay !== 0 && isDay !== false) return base;
  const nightMap = {
    0: { label: 'Noite limpa', icon: '🌙' },
    1: { label: 'Noite limpa', icon: '🌙' },
    2: { label: 'Parcial. nublado', icon: '☁️' },
    3: { label: 'Nublado', icon: '☁️' },
  };
  return nightMap[code] || base;
}

function dayLabel(isoDate, index) {
  if (index === 0) return 'Hoje';
  const d = new Date(`${isoDate}T12:00:00`);
  const name = d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace(/\./g, '');
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function parseOpenMeteo(data) {
  const cur = data.current || {};
  const daily = data.daily || {};
  const dates = daily.time || [];
  const isDay = cur.is_day;
  const wInfo = weatherFromCode(cur.weather_code, isDay);
  const today = dates[0] || new Date().toISOString().slice(0, 10);

  return {
    city: SAO_PAULO.name,
    date: today,
    source: 'Open-Meteo',
    current: {
      temp: Math.round(cur.temperature_2m ?? 0),
      humidity: Math.round(cur.relative_humidity_2m ?? 0),
      windKmh: Math.round(cur.wind_speed_10m ?? 0),
      code: cur.weather_code,
      isDay: isDay !== 0,
      label: wInfo.label,
      icon: wInfo.icon,
    },
    daily: dates.map((date, i) => {
      const info = weatherFromCode(daily.weather_code?.[i]);
      return {
        date,
        day: dayLabel(date, i),
        max: Math.round(daily.temperature_2m_max?.[i] ?? 0),
        min: Math.round(daily.temperature_2m_min?.[i] ?? 0),
        code: daily.weather_code?.[i],
        label: info.label,
        icon: info.icon,
      };
    }),
  };
}

async function fetchWeatherForecast() {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(SAO_PAULO.lat));
  url.searchParams.set('longitude', String(SAO_PAULO.lon));
  url.searchParams.set('current', 'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,is_day');
  url.searchParams.set('daily', 'weather_code,temperature_2m_max,temperature_2m_min');
  url.searchParams.set('timezone', 'America/Sao_Paulo');
  url.searchParams.set('forecast_days', '5');

  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`Open-Meteo: HTTP ${res.status}`);
  const data = await res.json();
  return parseOpenMeteo(data);
}

module.exports = { fetchWeatherForecast, parseOpenMeteo, weatherFromCode, dayLabel };
