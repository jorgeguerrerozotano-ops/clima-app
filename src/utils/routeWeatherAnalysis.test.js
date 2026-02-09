/**
 * Unit tests for routeWeatherAnalysis.js — analyzeRouteWithWeather.
 * No real API calls: vi.mock for getRouteData and weather APIs.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeRouteWithWeather, isNetworkOrTimeoutError } from './routeWeatherAnalysis.js';

// Build hourly array in local timezone format so getIndexOfCurrentTime / getForecastAtTime find a slot
function buildHourlyForTime(targetDate, timezone = 'Europe/Madrid', len = 48) {
  const time = [];
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  });
  for (let i = 0; i < len; i++) {
    const d = new Date(targetDate);
    d.setHours(d.getHours() + i);
    const parts = formatter.formatToParts(d);
    const y = parts.find((p) => p.type === 'year').value;
    const m = parts.find((p) => p.type === 'month').value;
    const day = parts.find((p) => p.type === 'day').value;
    const h = parts.find((p) => p.type === 'hour').value;
    time.push(`${y}-${m}-${day}T${h}:00`);
  }
  return {
    time,
    temperature_2m: Array(len).fill(18),
    apparent_temperature: Array(len).fill(17),
    precipitation: Array(len).fill(0),
    precipitation_probability: Array(len).fill(10),
    weather_code: Array(len).fill(0),
    wind_speed_10m: Array(len).fill(15),
    snowfall: Array(len).fill(0),
    snow_depth: Array(len).fill(0),
    relative_humidity_2m: Array(len).fill(60),
  };
}

const mockRouteData = {
  distanceKm: '50',
  durationMin: 45,
  routeGeometry: [
    [40.0, -3.0],
    [40.25, -3.25],
    [40.5, -3.5],
    [40.75, -3.75],
    [41.0, -4.0],
  ],
};

const mockForecastRaw = (lat, lon) => {
  const now = new Date();
  const hourly = buildHourlyForTime(now, 'Europe/Madrid');
  return {
    latitude: lat,
    longitude: lon,
    timezone: 'Europe/Madrid',
    current: {},
    hourly,
  };
};

vi.mock('../i18n', () => ({
  default: {
    t: (key, opts) => (opts ? `${key}:${JSON.stringify(opts)}` : key),
    language: 'es',
  },
}));

vi.mock('./routeUtils', () => ({
  getRouteData: vi.fn(),
  pointAlongRoute: vi.fn((geometry) => {
    if (!geometry || geometry.length < 2) return null;
    const mid = Math.floor(geometry.length / 2);
    return { lat: geometry[mid][0], lon: geometry[mid][1] };
  }),
  fractionAlongPolyline: vi.fn(),
}));

vi.mock('./weatherApi', () => ({
  fetchOpenMeteoForecastRaw: vi.fn(),
  fetchAirQuality: vi.fn(),
  mergeAirQualityIntoHourly: vi.fn((data) => data),
}));

import { getRouteData } from './routeUtils';
import { fetchOpenMeteoForecastRaw, fetchAirQuality, mergeAirQualityIntoHourly } from './weatherApi';

describe('routeWeatherAnalysis', () => {
  const originCoords = { lat: 40.0, lon: -3.0 };
  const destCoords = { lat: 41.0, lon: -4.0 };
  const depDate = new Date();

  beforeEach(() => {
    vi.mocked(getRouteData).mockResolvedValue({
      routes: [{ ...mockRouteData }],
    });
    vi.mocked(fetchOpenMeteoForecastRaw).mockImplementation((lat, lon) =>
      Promise.resolve(mockForecastRaw(lat, lon))
    );
    vi.mocked(fetchAirQuality).mockResolvedValue(null);
    vi.mocked(mergeAirQualityIntoHourly).mockImplementation((data) => data);
  });

  describe('analyzeRouteWithWeather', () => {
    it('returns a valid routeResult when given correct coordinates (no waypoints)', async () => {
      const result = await analyzeRouteWithWeather(
        originCoords,
        destCoords,
        [],
        depDate,
        'moto'
      );

      expect(result).toBeDefined();
      expect(result).toHaveProperty('dist');
      expect(result).toHaveProperty('time');
      expect(result).toHaveProperty('durationMinutes');
      expect(result).toHaveProperty('segments');
      expect(result).toHaveProperty('originWeather');
      expect(result).toHaveProperty('destWeather');
      expect(result).toHaveProperty('routeGeometry');
      expect(result).toHaveProperty('mode', 'moto');
      expect(result).toHaveProperty('depDate');
      expect(result).toHaveProperty('originCoords');
      expect(result).toHaveProperty('destCoords');

      expect(typeof result.dist).toBe('number');
      expect(result.segments).toMatchObject({
        origin: expect.objectContaining({
          status: expect.any(String),
          message: expect.any(String),
          time: expect.any(String),
          name: expect.any(String),
          remainingKm: expect.any(Number),
        }),
        mid: expect.any(Object),
        dest: expect.any(Object),
      });
    });

    it('calls getRouteData with parsed coordinates and mode', async () => {
      await analyzeRouteWithWeather(
        { lat: '40.5', lon: '-3.5' },
        { lat: '41.2', lon: '-4.1' },
        [],
        depDate,
        'car'
      );

      expect(getRouteData).toHaveBeenCalledWith(40.5, -3.5, 41.2, -4.1, 'car', [], expect.any(Object));
    });

    it('throws when routes API returns no routes', async () => {
      vi.mocked(getRouteData).mockResolvedValueOnce({ routes: [] });

      await expect(
        analyzeRouteWithWeather(originCoords, destCoords, [], depDate, 'moto')
      ).rejects.toThrow('No routes');
    });

    it('throws when getRouteData rejects (API failure)', async () => {
      vi.mocked(getRouteData).mockRejectedValueOnce(new Error('Network error'));

      await expect(
        analyzeRouteWithWeather(originCoords, destCoords, [], depDate, 'moto')
      ).rejects.toThrow('Network error');
    });

    it('throws when getRouteData returns undefined routes', async () => {
      vi.mocked(getRouteData).mockResolvedValueOnce({});

      await expect(
        analyzeRouteWithWeather(originCoords, destCoords, [], depDate, 'moto')
      ).rejects.toThrow('No routes');
    });
  });

  describe('isNetworkOrTimeoutError', () => {
    it('returns true for Timeout message', () => {
      expect(isNetworkOrTimeoutError(new Error('Timeout al obtener el tiempo'))).toBe(true);
    });

    it('returns true for Failed to fetch', () => {
      expect(isNetworkOrTimeoutError(new Error('Failed to fetch'))).toBe(true);
    });

    it('returns true for network/CORS/504', () => {
      expect(isNetworkOrTimeoutError(new Error('network error'))).toBe(true);
      expect(isNetworkOrTimeoutError(new Error('CORS blocked'))).toBe(true);
      expect(isNetworkOrTimeoutError(new Error('504 Gateway'))).toBe(true);
    });

    it('returns false for other errors', () => {
      expect(isNetworkOrTimeoutError(new Error('Invalid coordinates'))).toBe(false);
    });
  });
});
