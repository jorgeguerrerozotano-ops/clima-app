// src/utils/riskUtils.js
// Utilidades de priorización de factores de riesgo para evaluación de actividades

import { FACTOR_ICONS } from './iconMap';

export { FACTOR_ICONS };

/** Orden de gravedad para priorización (menor = más prioritario) */
const STATUS_ORDER = {
    CRITICAL: 0,
    WARNING: 1,
    SAFE: 2,
    INFO: 3,
};

/**
 * Prioriza factores por gravedad: CRITICAL primero, WARNING después, SAFE/INFO al final.
 * Usa score para desempate dentro del mismo nivel.
 *
 * @param {Array<{ type: string, value: string, status: string, label: string, description?: string, score?: number }>} factors
 * @returns {Array} Factores ordenados por prioridad
 */
export const prioritizeFactors = (factors) => {
    if (!factors || !Array.isArray(factors)) return [];
    return [...factors].sort((a, b) => {
        const orderA = STATUS_ORDER[a.status] ?? 99;
        const orderB = STATUS_ORDER[b.status] ?? 99;
        if (orderA !== orderB) return orderA - orderB;
        const scoreA = a.score ?? 0;
        const scoreB = b.score ?? 0;
        return scoreB - scoreA; // Mayor score = más grave primero
    });
};

/**
 * Convierte un factor estandarizado al formato legacy { name, value, status, icon }
 * para compatibilidad con la UI actual.
 */
export const mapFactorToLegacy = (factor) => {
    const statusMap = {
        CRITICAL: 'red',
        WARNING: 'yellow',
        SAFE: 'green',
        INFO: 'gray',
    };
    const Icon = FACTOR_ICONS[factor.type] ?? FACTOR_ICONS.DEFAULT;
    return {
        name: factor.label,
        value: factor.value,
        status: statusMap[factor.status] ?? 'gray',
        icon: Icon,
    };
};

/**
 * Convierte array de factores estandarizados a formato legacy.
 */
export const mapFactorsToLegacy = (factors) => {
    if (!factors || !Array.isArray(factors)) return [];
    return factors.map(mapFactorToLegacy);
};
