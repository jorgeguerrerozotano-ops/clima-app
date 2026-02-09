/**
 * Unit tests for weatherParser.js — processWeatherData and edge cases.
 * Uses mock Open-Meteo–style data; no real API calls.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  processWeatherData,
  parseCurrentWeather,
  getNextRainText,
  generatePrecipitationAlert,
  formatHourlyForecast,
} from './weatherParser.js';

// Mock i18n so parser functions don't depend on real translations
vi.mock('../i18n', () => ({
  default: {
    t: (key) => key,
    language: 'es',
  },
}));

// Build hourly.time so that index 0 is "current" hour (for predictable tests)
function buildHourlyTimeForNow(hoursCount = 48) {
  const now = new Date();
  const tz = 'Europe/Madrid';
  const pad = (n) => String(n).padStart(2, '0');
  const time = [];
  for (let i = 0; i < hoursCount; i++) {
    const d = new Date(now);
    d.setHours(d.getHours() + i);
    const y = d.getFullYear();
    const m = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const h = pad(d.getHours());
    time.push(`${y}-${m}-${day}T${h}:00`);
  }
  return time;
}

/** Minimal valid Open-Meteo–style response (hourly + daily + current). */
function createMockOpenMeteoData(overrides = {}) {
  const time = buildHourlyTimeForNow(48);
  const len = time.length;
  const defaultData = {
    timezone: 'Europe/Madrid',
    hourly: {
      time,
      temperature_2m: Array(len).fill(18),
      apparent_temperature: Array(len).fill(17),
      precipitation_probability: Array(len).fill(10),
      weather_code: Array(len).fill(0),
      is_day: Array(len).fill(1),
      cloud_cover: Array(len).fill(25),
      precipitation: Array(len).fill(0),
      snowfall: Array(len).fill(0),
      snow_depth: Array(len).fill(0),
    },
    daily: {
      sunrise: [time[0].replace(/T\d{2}:\d{2}/, 'T06:00')],
      sunset: [time[0].replace(/T\d{2}:\d{2}/, 'T21:00')],
    },
    current: {
      temperature_2m: 18,
      apparent_temperature: 17,
      relative_humidity_2m: 60,
      weather_code: 0,
      is_day: 1,
      wind_speed_10m: 15,
      cloud_cover: 25,
      precipitation: 0,
      snowfall: 0,
      snow_depth: 0,
    },
  };
  return deepMerge(defaultData, overrides);
}

function deepMerge(target, source) {
  const out = { ...target };
  if (!source || typeof source !== 'object') return out;
  for (const key of Object.keys(source)) {
    if (Array.isArray(source[key])) out[key] = source[key];
    else if (source[key] != null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      out[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      out[key] = source[key];
    }
  }
  return out;
}

describe('weatherParser', () => {
  describe('processWeatherData', () => {
    it('returns expected structure with location, current, analysis', () => {
      const data = createMockOpenMeteoData();
      const result = processWeatherData(data, 'Madrid', 'ES', 40.4, -3.7);

      expect(result).toHaveProperty('location');
      expect(result.location).toEqual({ name: 'Madrid', country: 'ES', lat: 40.4, lon: -3.7 });

      expect(result).toHaveProperty('current');
      expect(result.current).toMatchObject({
        temp: expect.any(Number),
        feelsLike: expect.any(Number),
        code: expect.any(Number),
        isDay: expect.any(Number),
        wind_speed: expect.any(Number),
        cloud_cover: expect.any(Number),
        precip: expect.any(Number),
        snow: expect.any(Number),
        precipProbability: expect.any(Number),
      });

      expect(result).toHaveProperty('analysis');
      expect(result.analysis).toMatchObject({
        nextRainText: expect.any(String),
        isRainingNow: expect.any(Boolean),
        laundrySafe: expect.any(Boolean),
        avgClouds: expect.any(Number),
        hourlyForecast: expect.any(Array),
      });
      // precipitationAlert can be null (no precip in window) or object { type, hourLabel, ... }
      expect(result.analysis).toHaveProperty('precipitationAlert');
      expect(
        result.analysis.precipitationAlert === null ||
          typeof result.analysis.precipitationAlert === 'object'
      ).toBe(true);

      expect(result).toHaveProperty('timezone');
      expect(result).toHaveProperty('astro');
      expect(result).toHaveProperty('daily');
      expect(result).toHaveProperty('rawHourly');
    });

    it('throws when hourly.time is missing or empty', () => {
      const data = createMockOpenMeteoData({ hourly: { time: [] } });
      expect(() => processWeatherData(data, 'X', 'ES', 0, 0)).toThrow('Estructura de datos inválida');
    });

    it('throws when daily.sunrise is missing or empty', () => {
      const data = createMockOpenMeteoData({ daily: { sunrise: [], sunset: [] } });
      expect(() => processWeatherData(data, 'X', 'ES', 0, 0)).toThrow('Estructura de datos inválida');
    });
  });

  describe('processWeatherData — edge cases: hourly.precipitation', () => {
    it('throws when hourly.precipitation is null (API edge case)', () => {
      const data = createMockOpenMeteoData();
      data.hourly.precipitation = null;
      expect(() => processWeatherData(data, 'X', 'ES', 0, 0)).toThrow();
    });

    it('throws when hourly.precipitation is undefined', () => {
      const data = createMockOpenMeteoData();
      delete data.hourly.precipitation;
      expect(() => processWeatherData(data, 'X', 'ES', 0, 0)).toThrow();
    });
  });

  describe('parseCurrentWeather', () => {
    it('returns startIndex, baseCode, baseTemp, currentPrecipMM, probForNow', () => {
      const data = createMockOpenMeteoData();
      const currentHourIndex = 0;
      const result = parseCurrentWeather(data, currentHourIndex);

      expect(result).toHaveProperty('startIndex', 0);
      expect(result).toHaveProperty('baseCode');
      expect(result).toHaveProperty('baseTemp');
      expect(result).toHaveProperty('currentPrecipMM');
      expect(result).toHaveProperty('probForNow');
      expect(result).toHaveProperty('baseFeelsLike');
      expect(result).toHaveProperty('baseIsDay');
      expect(result).toHaveProperty('currentSnowCM');
      expect(result).toHaveProperty('currentSnowDepth');
    });

    it('uses current.* when currentHourIndex is -1', () => {
      const data = createMockOpenMeteoData();
      const result = parseCurrentWeather(data, -1);
      expect(result.currentPrecipMM).toBe(data.current.precipitation);
      expect(result.baseTemp).toBe(data.current.temperature_2m);
    });
  });

  describe('getNextRainText', () => {
    it('returns a string (translation key or formatted text)', () => {
      const params = {
        futurePrecip: [0, 0, 0.3, 0.5],
        futureProb: [5, 10, 40, 50],
        futureTime: [new Date().toISOString(), new Date(Date.now() + 3600000).toISOString(), new Date(Date.now() + 7200000).toISOString(), new Date(Date.now() + 10800000).toISOString()],
        futureSnow: [0, 0, 0, 0],
        futureTemp: [18, 18, 17, 16],
        currentPrecipMM: 0,
        currentSnowCM: 0,
        baseTemp: 20,
      };
      const text = getNextRainText(params);
      expect(typeof text).toBe('string');
      expect(text.length).toBeGreaterThan(0);
    });
  });

  describe('generatePrecipitationAlert', () => {
    it('returns null when no precipitation in window', () => {
      const params = {
        windowPrecip: [0, 0, 0, 0, 0, 0, 0, 0],
        windowSnow: [0, 0, 0, 0, 0, 0, 0, 0],
        windowTime: Array(8).fill(0).map((_, i) => new Date(Date.now() + i * 3600000).toISOString()),
        currentSnowCM: 0,
        currentPrecipMM: 0,
        timezone: 'Europe/Madrid',
      };
      const alert = generatePrecipitationAlert(params);
      expect(alert).toBeNull();
    });
  });

  describe('formatHourlyForecast', () => {
    it('returns array of objects with time, temp, iconCode, isDay, prob, mm, snowCM, snowDepth', () => {
      const params = {
        futureTime: buildHourlyTimeForNow(24),
        futureTemp: Array(24).fill(20),
        futureCodes: Array(24).fill(0),
        futureIsDay: Array(24).fill(1),
        futureProb: Array(24).fill(0),
        futurePrecip: Array(24).fill(0),
        futureSnow: Array(24).fill(0),
        futureSnowDepth: Array(24).fill(0),
      };
      const list = formatHourlyForecast(params);
      expect(Array.isArray(list)).toBe(true);
      expect(list.length).toBeLessThanOrEqual(24);
      if (list.length > 0) {
        expect(list[0]).toMatchObject({
          time: expect.any(String),
          temp: expect.any(Number),
          iconCode: expect.any(Number),
          isDay: expect.any(Number),
          prob: expect.any(Number),
          mm: expect.any(Number),
          snowCM: expect.any(Number),
          snowDepth: expect.any(Number),
        });
      }
    });
  });
});
