/**
 * Unit tests for safetyRules.js — evaluateMoto.
 * Ensures risk state (red/yellow/green) for edge cases: heavy rain, strong wind, cold, etc.
 */

import { describe, it, expect } from 'vitest';
import { evaluateMoto, SAFETY_LIMITS } from './safetyRules.js';

// Mock i18n: return key so we can assert on criticals/warnings content
const t = (key, opts) => (opts ? `${key}:${JSON.stringify(opts)}` : key);

/** Baseline safe data for moto (green conditions). */
const baseData = () => ({
  temp: 15,
  apparentTemp: 15,
  rainMM: 0,
  snowCM: 0,
  snowDepth: 0,
  windSpeed: 10,
  wind: 10,
  code: 0,
  isFloorWet: false,
  rainProb: 0,
  visibilityM: 5000,
});

describe('evaluateMoto', () => {
  describe('safe conditions (green)', () => {
    it('returns no criticals nor warnings in ideal conditions', () => {
      const result = evaluateMoto(baseData(), t);
      expect(result.criticals).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
      expect(result.factors.length).toBeGreaterThan(0);
    });

    it('accepts data with wind alias (wind instead of windSpeed)', () => {
      const data = { ...baseData(), wind: 12 };
      delete data.windSpeed;
      const result = evaluateMoto(data, t);
      expect(result.criticals).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('rain — risk state red/yellow', () => {
    it('returns CRITICAL (red) when rain >= 4 mm (MOTO_RAIN_CRITICAL)', () => {
      const data = { ...baseData(), rainMM: 4.5 };
      const result = evaluateMoto(data, t);
      expect(result.criticals.length).toBeGreaterThan(0);
      expect(result.criticals.some((c) => c.includes('activePrecip') || c === 'activities.activePrecip')).toBe(true);
    });

    it('returns CRITICAL (red) when rain >= 0.5 mm (MOTO_RAIN_ACTIVE_MM)', () => {
      const data = { ...baseData(), rainMM: 0.5 };
      const result = evaluateMoto(data, t);
      expect(result.criticals.length).toBeGreaterThan(0);
      expect(result.criticals.some((c) => c.includes('activePrecip') || c === 'activities.activePrecip')).toBe(true);
    });

    it('returns CRITICAL (red) when rain is 1 mm', () => {
      const data = { ...baseData(), rainMM: 1 };
      const result = evaluateMoto(data, t);
      expect(result.criticals.length).toBeGreaterThan(0);
    });

    it('returns WARNING (yellow) when rain >= 0.1 mm and < 0.5 mm', () => {
      const data = { ...baseData(), rainMM: 0.2 };
      const result = evaluateMoto(data, t);
      expect(result.criticals).toHaveLength(0);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some((w) => w.includes('rainRisk') || w.includes('rain'))).toBe(true);
    });

    it('returns WARNING (yellow) when floor is wet (isFloorWet)', () => {
      const data = { ...baseData(), isFloorWet: true };
      const result = evaluateMoto(data, t);
      expect(result.criticals).toHaveLength(0);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some((w) => w.includes('wetAsphalt') || w.includes('wet'))).toBe(true);
    });
  });

  describe('wind — risk state red/yellow', () => {
    it('returns CRITICAL (red) when wind > 45 km/h (MOTO_WIND_CRITICAL)', () => {
      const data = { ...baseData(), windSpeed: 50 };
      const result = evaluateMoto(data, t);
      expect(result.criticals.length).toBeGreaterThan(0);
      expect(result.criticals.some((c) => c.includes('dangerousWind') || c === 'activities.dangerousWind')).toBe(true);
    });

    it('returns CRITICAL (red) when wind is exactly 46 km/h', () => {
      const data = { ...baseData(), windSpeed: 46 };
      const result = evaluateMoto(data, t);
      expect(result.criticals.length).toBeGreaterThan(0);
    });

    it('returns WARNING (yellow) when wind > 30 and <= 45 km/h (MOTO_WIND_WARNING)', () => {
      const data = { ...baseData(), windSpeed: 35 };
      const result = evaluateMoto(data, t);
      expect(result.criticals).toHaveLength(0);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some((w) => w.includes('annoyingWind') || w === 'activities.annoyingWind')).toBe(true);
    });

    it('returns safe (green) when wind is 30 km/h (boundary)', () => {
      const data = { ...baseData(), windSpeed: 30 };
      const result = evaluateMoto(data, t);
      expect(result.criticals).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('temperature — risk state red/yellow', () => {
    it('returns CRITICAL (red) when temp < 2°C (ice risk)', () => {
      const data = { ...baseData(), temp: 1, apparentTemp: 1 };
      const result = evaluateMoto(data, t);
      expect(result.criticals.length).toBeGreaterThan(0);
      expect(result.criticals.some((c) => c.includes('iceRisk') || c === 'activities.iceRisk')).toBe(true);
    });

    it('returns WARNING (yellow) when temp >= 2 and < 5°C (intense cold)', () => {
      const data = { ...baseData(), temp: 3, apparentTemp: 3 };
      const result = evaluateMoto(data, t);
      expect(result.criticals).toHaveLength(0);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some((w) => w.includes('intenseCold') || w === 'activities.intenseCold')).toBe(true);
    });

    it('returns CRITICAL (red) when temp >= 35°C (heat stroke)', () => {
      const data = { ...baseData(), temp: 36, apparentTemp: 36 };
      const result = evaluateMoto(data, t);
      expect(result.criticals.length).toBeGreaterThan(0);
      expect(result.criticals.some((c) => c.includes('heatStrokeRisk') || c === 'activities.heatStrokeRisk')).toBe(true);
    });

    it('returns WARNING (yellow) when temp >= 30 and < 35°C (excessive heat)', () => {
      const data = { ...baseData(), temp: 32, apparentTemp: 32 };
      const result = evaluateMoto(data, t);
      expect(result.criticals).toHaveLength(0);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some((w) => w.includes('excessiveHeat') || w === 'activities.excessiveHeat')).toBe(true);
    });
  });

  describe('visibility', () => {
    it('returns CRITICAL (red) when visibility < 200 m (MOTO_VIS_CRITICAL_M)', () => {
      const data = { ...baseData(), visibilityM: 150 };
      const result = evaluateMoto(data, t);
      expect(result.criticals.length).toBeGreaterThan(0);
      expect(result.criticals.some((c) => c.includes('veryPoorVisibility') || c === 'activities.veryPoorVisibility')).toBe(true);
    });

    it('returns WARNING (yellow) when visibility < 1000 m and >= 200 m', () => {
      const data = { ...baseData(), visibilityM: 500 };
      const result = evaluateMoto(data, t);
      expect(result.criticals).toHaveLength(0);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some((w) => w.includes('reducedVisibility') || w === 'activities.reducedVisibility')).toBe(true);
    });

    it('returns CRITICAL (red) for fog code 48 when no visibilityM', () => {
      const data = { ...baseData(), code: 48, visibilityM: null };
      const result = evaluateMoto(data, t);
      expect(result.criticals.length).toBeGreaterThan(0);
      expect(result.criticals.some((c) => c.includes('veryPoorVisibility'))).toBe(true);
    });
  });

  describe('combined edge cases (red state)', () => {
    it('returns red when heavy rain and strong wind combined', () => {
      const data = { ...baseData(), rainMM: 5, windSpeed: 50 };
      const result = evaluateMoto(data, t);
      expect(result.criticals.length).toBeGreaterThanOrEqual(2);
    });

    it('returns red when rain >= 0.5 mm even with low wind', () => {
      const data = { ...baseData(), rainMM: 0.5, windSpeed: 5 };
      const result = evaluateMoto(data, t);
      expect(result.criticals.length).toBeGreaterThan(0);
    });
  });

  describe('factors structure', () => {
    it('returns factors array with type, value, status, label', () => {
      const result = evaluateMoto(baseData(), t);
      expect(result.factors).toBeDefined();
      expect(Array.isArray(result.factors)).toBe(true);
      result.factors.forEach((f) => {
        expect(f).toHaveProperty('type');
        expect(f).toHaveProperty('value');
        expect(f).toHaveProperty('status');
        expect(f).toHaveProperty('label');
        expect(['SAFE', 'WARNING', 'CRITICAL']).toContain(f.status);
      });
    });
  });
});

describe('SAFETY_LIMITS (moto)', () => {
  it('exposes MOTO_WIND_WARNING and MOTO_WIND_CRITICAL for test reference', () => {
    expect(SAFETY_LIMITS.MOTO_WIND_WARNING).toBe(30);
    expect(SAFETY_LIMITS.MOTO_WIND_CRITICAL).toBe(45);
    expect(SAFETY_LIMITS.MOTO_RAIN_ACTIVE_MM).toBe(0.5);
    expect(SAFETY_LIMITS.MOTO_RAIN_CRITICAL).toBe(4.0);
  });
});
