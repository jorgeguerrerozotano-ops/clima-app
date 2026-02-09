/**
 * Proxy seguro para OpenRouteService Directions API.
 * La API Key se inyecta solo en el servidor (ORS_API_KEY); el cliente no la expone.
 */

const ORS_BASE = 'https://api.openrouteservice.org/v2/directions';
const ORS_TIMEOUT_MS = 12000;

export default async function handler(req, res) {
  // CORS: permitir peticiones desde el mismo origen (SPA) o desde el origen de la request
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.ORS_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: 'ORS API key not configured on server' });
    return;
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    res.status(400).json({ error: 'Invalid JSON body' });
    return;
  }

  const { profile, coordinates, options } = body;
  if (!profile || !Array.isArray(coordinates) || coordinates.length < 2) {
    res.status(400).json({ error: 'Missing profile or coordinates' });
    return;
  }

  const cleanCoords = coordinates.map((pair) => [
    parseFloat(pair[0]),
    parseFloat(pair[1])
  ]);
  const orsBody = {
    coordinates: cleanCoords,
    radiuses: cleanCoords.map(() => -1)
  };
  if (options && typeof options === 'object') orsBody.options = options;

  const url = `${ORS_BASE}/${profile}/geojson`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ORS_TIMEOUT_MS);

  try {
    const orsRes = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: apiKey
      },
      body: JSON.stringify(orsBody),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const data = await orsRes.json();

    if (!orsRes.ok) {
      res.status(orsRes.status).json(data);
      return;
    }

    res.status(200).json(data);
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      res.status(504).json({ error: 'Timeout connecting to OpenRouteService' });
      return;
    }
    res.status(502).json({ error: err.message || 'Error calling OpenRouteService' });
  }
}
