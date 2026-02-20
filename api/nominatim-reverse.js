/**
 * Proxy para Nominatim Reverse Geocoding (OpenStreetMap).
 * Evita CORS y 403 en el cliente; el servidor envía User-Agent y cumple la política de uso.
 */

const NOMINATIM_REVERSE_BASE = 'https://nominatim.openstreetmap.org/reverse';
const NOMINATIM_USER_AGENT = 'MiClimaApp/1.0 (https://github.com/mi-clima-app; proxy@vercel)';
const TIMEOUT_MS = 8000;

export default async function handler(req, res) {
  const origin = req.headers.origin;
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Accept');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { lat, lon } = req.query;
  const latNum = parseFloat(lat);
  const lonNum = parseFloat(lon);
  if (Number.isNaN(latNum) || Number.isNaN(lonNum)) {
    res.status(400).json({ error: 'Missing or invalid lat/lon' });
    return;
  }

  const params = new URLSearchParams({
    format: 'json',
    lat: String(latNum),
    lon: String(lonNum),
    addressdetails: '1'
  });
  const url = `${NOMINATIM_REVERSE_BASE}?${params.toString()}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const nominatimRes = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': NOMINATIM_USER_AGENT,
        Accept: 'application/json'
      },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const data = await nominatimRes.json();

    if (!nominatimRes.ok) {
      res.status(nominatimRes.status).json(data);
      return;
    }

    res.status(200).json(data);
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      res.status(504).json({ error: 'Timeout connecting to Nominatim' });
      return;
    }
    res.status(502).json({ error: err.message || 'Error calling Nominatim' });
  }
}
