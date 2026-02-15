/**
 * Unit tests for activitiesConfig.js — checkActivityRules (standard mode).
 * Ensures custom activity rules (tempMin, tempMax, windMax, rainMax) are respected in evaluation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkActivityRules } from './activitiesConfig.js';

/** Build minimal hourly data for one slot. All arrays same length; index 0 is the evaluated hour. */
function buildHourly(temp = 20, precip = 0, wind = 10, code = 0, rainProb = 0, len = 3) {
  const time = Array(len).fill('2025-02-10T12:00').map((_, i) => `2025-02-10T${12 + i}:00`);
  return {
    time,
    temperature_2m: Array(len).fill(temp),
    precipitation: Array(len).fill(precip),
    wind_speed_10m: Array(len).fill(wind),
    weather_code: Array(len).fill(code),
    precipitation_probability: Array(len).fill(rainProb),
    snowfall: Array(len).fill(0),
    snow_depth: Array(len).fill(0),
  };
}

describe('checkActivityRules — standard mode with custom rules', () => {
  beforeEach(() => {
    vi.unstubAllEnvs?.();
  });

  describe('temperature: rules.tempMin / rules.tempMax', () => {
    it('returns NOT green when temp is below custom tempMin (e.g. 10° with range 25–30)', () => {
      const hourly = buildHourly(10, 0, 10, 0, 0);
      const rules = {
        mode: 'standard',
        tempMin: 25,
        tempMax: 30,
        windMax: 30,
        rainMax: 0.5,
        rainPreference: 'flexible',
        checkWetFloor: false,
      };
      const result = checkActivityRules(hourly, 0, 60, rules);
      expect(result.status).not.toBe('green');
      expect(['red', 'yellow']).toContain(result.status);
    });

    it('returns green when temp is within custom range (e.g. 27° with range 25–30)', () => {
      const hourly = buildHourly(27, 0, 10, 0, 0);
      const rules = {
        mode: 'standard',
        tempMin: 25,
        tempMax: 30,
        windMax: 30,
        rainMax: 0.5,
        rainPreference: 'flexible',
        checkWetFloor: false,
      };
      const result = checkActivityRules(hourly, 0, 60, rules);
      expect(result.status).toBe('green');
    });

    it('returns NOT green when temp is above custom tempMax (e.g. 35° with range 25–30)', () => {
      const hourly = buildHourly(35, 0, 10, 0, 0);
      const rules = {
        mode: 'standard',
        tempMin: 25,
        tempMax: 30,
        windMax: 30,
        rainMax: 0.5,
        rainPreference: 'flexible',
        checkWetFloor: false,
      };
      const result = checkActivityRules(hourly, 0, 60, rules);
      expect(result.status).not.toBe('green');
    });
  });

  describe('wind: rules.windMax', () => {
    it('returns NOT green when wind exceeds custom windMax (e.g. 40 km/h with windMax 15)', () => {
      const hourly = buildHourly(20, 0, 40, 0, 0);
      const rules = {
        mode: 'standard',
        tempMin: 10,
        tempMax: 30,
        windMax: 15,
        rainMax: 0.5,
        rainPreference: 'flexible',
        checkWetFloor: false,
      };
      const result = checkActivityRules(hourly, 0, 60, rules);
      expect(result.status).not.toBe('green');
    });

    it('returns green when wind is within custom windMax (e.g. 10 km/h with windMax 30)', () => {
      const hourly = buildHourly(20, 0, 10, 0, 0);
      const rules = {
        mode: 'standard',
        tempMin: 10,
        tempMax: 30,
        windMax: 30,
        rainMax: 0.5,
        rainPreference: 'flexible',
        checkWetFloor: false,
      };
      const result = checkActivityRules(hourly, 0, 60, rules);
      expect(result.status).toBe('green');
    });
  });

  describe('rain: rules.rainMax', () => {
    it('returns NOT green when precipitation exceeds custom rainMax (e.g. 1 mm with rainMax 0.1)', () => {
      const hourly = buildHourly(20, 1, 10, 61, 50); // code 61 = light rain, 1mm
      const rules = {
        mode: 'standard',
        tempMin: 10,
        tempMax: 30,
        windMax: 30,
        rainMax: 0.1,
        rainPreference: 'strict',
        checkWetFloor: false,
      };
      const result = checkActivityRules(hourly, 0, 60, rules);
      expect(result.status).not.toBe('green');
    });

    it('returns green when precipitation is within custom rainMax (e.g. 0 mm with rainMax 0.5)', () => {
      const hourly = buildHourly(20, 0, 10, 0, 0);
      const rules = {
        mode: 'standard',
        tempMin: 10,
        tempMax: 30,
        windMax: 30,
        rainMax: 0.5,
        rainPreference: 'flexible',
        checkWetFloor: false,
      };
      const result = checkActivityRules(hourly, 0, 60, rules);
      expect(result.status).toBe('green');
    });
  });

  describe('rain: rules.rainRequired', () => {
    it('returns NOT green when rainRequired is true and there is no rain (0 mm)', () => {
      const hourly = buildHourly(20, 0, 10, 0, 0);
      const rules = {
        mode: 'standard',
        tempMin: 10,
        tempMax: 30,
        windMax: 30,
        rainMax: 2.5,
        rainPreference: 'any',
        rainRequired: true,
        checkWetFloor: false,
      };
      const result = checkActivityRules(hourly, 0, 60, rules);
      expect(result.status).not.toBe('green');
      expect(['red', 'yellow']).toContain(result.status);
    });

    it('returns green when rainRequired is true and precipitation is above rainMin (e.g. 0.3 mm)', () => {
      const hourly = buildHourly(20, 0.3, 10, 61, 50);
      const rules = {
        mode: 'standard',
        tempMin: 10,
        tempMax: 30,
        windMax: 30,
        rainMax: 2.5,
        rainPreference: 'any',
        rainRequired: true,
        checkWetFloor: false,
      };
      const result = checkActivityRules(hourly, 0, 60, rules);
      expect(result.status).toBe('green');
    });

    it('does not affect evaluation when rainRequired is false (0 mm stays green)', () => {
      const hourly = buildHourly(20, 0, 10, 0, 0);
      const rules = {
        mode: 'standard',
        tempMin: 10,
        tempMax: 30,
        windMax: 30,
        rainMax: 0.5,
        rainPreference: 'flexible',
        rainRequired: false,
        checkWetFloor: false,
      };
      const result = checkActivityRules(hourly, 0, 60, rules);
      expect(result.status).toBe('green');
    });

    it('returns NOT green when rainRequired is true and precipitation is undefined (API edge case)', () => {
      const hourly = buildHourly(20, 0, 10, 0, 0);
      hourly.precipitation = hourly.precipitation.map(() => undefined);
      const rules = {
        mode: 'standard',
        tempMin: 10,
        tempMax: 30,
        windMax: 30,
        rainMax: 2.5,
        rainPreference: 'any',
        rainRequired: true,
        checkWetFloor: false,
      };
      const result = checkActivityRules(hourly, 0, 60, rules);
      expect(result.status).not.toBe('green');
    });
  });

  describe('backward compatibility: rules without custom thresholds', () => {
    it('uses SAFETY_LIMITS when tempMin/tempMax are missing (predefined running-like)', () => {
      const hourly = buildHourly(20, 0, 10, 0, 0);
      const rules = { mode: 'standard', rainMax: 0.5, rainPreference: 'flexible', checkWetFloor: false };
      const result = checkActivityRules(hourly, 0, 60, rules);
      expect(result.status).toBe('green');
    });

    it('returns not green for very cold when using fallback limits (e.g. -5°)', () => {
      const hourly = buildHourly(-5, 0, 10, 0, 0);
      const rules = { mode: 'standard', rainMax: 0.5, rainPreference: 'flexible', checkWetFloor: false };
      const result = checkActivityRules(hourly, 0, 60, rules);
      expect(result.status).not.toBe('green');
    });
  });
});
