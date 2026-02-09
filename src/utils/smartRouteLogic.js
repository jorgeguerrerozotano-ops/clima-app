/**
 * Smart Safe Route — Fase 1 (Time Shift) + Fase 2 (Spatial Detour)
 * Lógica para buscar hora alternativa o desvío espacial que mejore las condiciones meteorológicas.
 */
import { pointAlongRoute, getTangentAtFraction, pivotPointFromTangent } from './helpers';

/** Puntuación por estado de segmento: mayor = peor (más adversidad) */
const SEGMENT_ADVERSITY = {
    red: 100,
    yellow: 40,
    green: 0
};

/** Umbral de adversidad por encima del cual se activa la búsqueda de mejor hora */
export const ADVERSITY_THRESHOLD = 30;

/** Mejora mínima relativa: 3% — punto medio: mejora visible sin ser excesiva */
export const MIN_IMPROVEMENT_RATIO = 0.03;

/** Salir ahora: solo futuros, horquilla máx 3 h (T+1h, T+2h, T+3h) */
const TIME_OFFSETS_LEAVE_NOW = [1, 2, 3];

/** Salida programada: puede adelantar o retrasar; horquilla 3 h (T-1h, T+1h, T+2h) */
const TIME_OFFSETS_SCHEDULED = [-1, 1, 2];

/** Tiempo extra mínimo permitido para rutas cortas (min) — base ~1h para rutas largas */
const SPATIAL_MIN_EXTRA_MINUTES = 50;

/** Porcentaje de duración original que aceptamos como tiempo extra (ej: 2h → 3h si justifica seguridad) */
const SPATIAL_EXTRA_PERCENT = 0.5;

/**
 * Calcula un índice de adversidad (0–100) de la ruta a partir de sus segmentos.
 * Mayor valor = peor condiciones (más lluvia/viento/riesgo).
 * @param {Object} routeResult - Resultado de ruta con segments (origin, mid, dest o legs)
 * @returns {number} 0–100
 */
export function calculateAdversityScore(routeResult) {
    const segments = routeResult?.segments;
    if (!segments || typeof segments !== 'object') return 0;

    const list = Object.values(segments);
    if (list.length === 0) return 0;

    let sum = 0;
    for (const seg of list) {
        const status = seg?.status ?? 'green';
        sum += SEGMENT_ADVERSITY[status] ?? SEGMENT_ADVERSITY.green;
    }
    return Math.round(sum / list.length);
}

/**
 * Adversidad solo del trayecto (excluye destino). Si llueve en destino, penaliza igual a ambas rutas;
 * lo que importa es si esquivamos la lluvia DURANTE el viaje.
 * @param {Object} routeResult - Ruta con segments (origin, mid, dest o legs)
 * @returns {number} 0–100
 */
export function calculateAdversityScoreEnRoute(routeResult) {
    const segments = routeResult?.segments;
    if (!segments || typeof segments !== 'object') return 0;

    const keys = Object.keys(segments).filter((k) => k !== 'dest');
    if (keys.length === 0) return 0;

    let sum = 0;
    for (const key of keys) {
        const seg = segments[key];
        const status = seg?.status ?? 'green';
        sum += SEGMENT_ADVERSITY[status] ?? SEGMENT_ADVERSITY.green;
    }
    return Math.round(sum / keys.length);
}

/**
 * Distancia del pivote (km) según longitud de la ruta — escala real.
 * Rutas largas necesitan salir de la región climática afectada.
 */
function getPivotDistanceKm(routeDistKm) {
    const dist = typeof routeDistKm === 'number' ? routeDistKm : parseFloat(routeDistKm) || 0;
    if (dist < 100) return 18;
    if (dist <= 500) return 50;
    return 175;
}

/**
 * Tiempo extra máximo permitido (min): 40% de la duración original, mínimo 45 min. Safety First.
 */
function getMaxExtraMinutes(originalDurationMinutes) {
    const base = typeof originalDurationMinutes === 'number' ? originalDurationMinutes : 0;
    const allowed = Math.round(base * SPATIAL_EXTRA_PERCENT);
    return Math.max(SPATIAL_MIN_EXTRA_MINUTES, allowed);
}

/**
 * Construye un "routeResult" sintético solo con segments para calcular adversidad.
 * @param {Object} segments - { origin, mid, dest } con { status, message, ... }
 * @returns {{ segments: Object }}
 */
function syntheticRouteWithSegments(segments) {
    return { segments };
}

/**
 * Encuentra la mejor hora de salida reutilizando la misma ruta.
 * - Salir ahora: solo T+1h, T+2h, T+3h (no tiene sentido sugerir "salir 2h antes").
 * - Salida programada: T-1h, T+1h, T+2h (puede adelantar o retrasar; horquilla 3 h).
 * Solo aplicable a rutas sin waypoints (origen → destino con segmentos origin, mid, dest).
 * @param {Object} routeResult - Ruta actual (con originCoords, destCoords, midCoords, segments, routeGeometry)
 * @param {Date} originalDate - Hora de salida original
 * @param {number} durationMinutes - Duración total del trayecto en minutos
 * @param {Object} mergedData - { originMerged, destMerged, midMerged } con .hourly y .timezone
 * @param {string} mode - 'moto'|'car'|'walk'|'bicycle'
 * @param {Object} deps - { getForecastAtTime, evaluateSegment }
 * @param {Object} [options] - { isScheduled: boolean } true si la salida es programada (permite candidatos en el pasado)
 * @returns {Promise<Object|null>} { type: 'time', suggestedDeparture, suggestedDepartureLabel, adversityScore, segments, routeGeometry } o null
 */
export async function findBestTimeSlot(routeResult, originalDate, durationMinutes, mergedData, mode, deps, options = {}) {
    const { getForecastAtTime, evaluateSegment } = deps;
    if (!routeResult || !getForecastAtTime || !evaluateSegment) return null;

    const { originMerged, destMerged, midMerged } = mergedData || {};
    if (!originMerged?.hourly || !destMerged?.hourly || !midMerged?.hourly) return null;

    // Solo rutas simples (sin waypoints): origin, mid, dest
    const segs = routeResult.segments || {};
    if (!segs.origin || !segs.mid || !segs.dest) return null;

    const originalAdversity = calculateAdversityScore(routeResult);
    if (originalAdversity < ADVERSITY_THRESHOLD) return null;

    const isScheduled = options.isScheduled === true;
    const timeOffsets = isScheduled ? TIME_OFFSETS_SCHEDULED : TIME_OFFSETS_LEAVE_NOW;

    let best = null;
    let bestAdversity = originalAdversity;
    const minImprovement = originalAdversity * MIN_IMPROVEMENT_RATIO;

    for (const offsetHours of timeOffsets) {
        const candidateDate = new Date(originalDate.getTime() + offsetHours * 60 * 60 * 1000);
        const midDate = new Date(candidateDate.getTime() + (durationMinutes / 2) * 60000);
        const arrDate = new Date(candidateDate.getTime() + durationMinutes * 60000);

        const originF = getForecastAtTime(originMerged.hourly, candidateDate, originMerged.timezone);
        const midF = getForecastAtTime(midMerged.hourly, midDate, midMerged.timezone);
        const destF = getForecastAtTime(destMerged.hourly, arrDate, destMerged.timezone);

        if (!originF || !midF || !destF) continue;

        const originSeg = evaluateSegment(originF, mode);
        const midSeg = evaluateSegment(midF, mode);
        const destSeg = evaluateSegment(destF, mode);

        const segments = {
            origin: { ...originSeg, time: candidateDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), name: 'Salida', remainingKm: segs.origin?.remainingKm },
            mid: { ...midSeg, time: midDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), name: 'En ruta 1', remainingKm: segs.mid?.remainingKm },
            dest: { ...destSeg, time: arrDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), name: 'Llegada', remainingKm: 0 }
        };

        const synthetic = syntheticRouteWithSegments(segments);
        const candidateAdversity = calculateAdversityScore(synthetic);

        const improvement = originalAdversity - candidateAdversity;
        if (improvement >= minImprovement && candidateAdversity < bestAdversity) {
            bestAdversity = candidateAdversity;
            best = {
                type: 'time',
                suggestedDeparture: candidateDate.toISOString(),
                suggestedDepartureLabel: candidateDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                adversityScore: candidateAdversity,
                segments,
                routeGeometry: routeResult.routeGeometry || []
            };
        }
    }

    return best;
}

/**
 * Devuelve la fracción (0–1) del segmento con peor clima para usar como pivote.
 * origin=0, mid=0.5, dest=0.85 (evitar 1 para tener tangente válida).
 */
function getWorstSegmentFraction(routeResult) {
    const segs = routeResult?.segments || {};
    const keys = ['origin', 'mid', 'dest'];
    let worstKey = 'mid';
    let worstScore = -1;
    for (const key of keys) {
        const seg = segs[key];
        if (!seg) continue;
        const status = seg?.status ?? 'green';
        const score = SEGMENT_ADVERSITY[status] ?? SEGMENT_ADVERSITY.green;
        if (score > worstScore) {
            worstScore = score;
            worstKey = key;
        }
    }
    if (worstKey === 'origin') return 0.15;
    if (worstKey === 'dest') return 0.85;
    return 0.5;
}

/**
 * Fase 2: Busca un desvío espacial (waypoint pivote) que evite la zona de peor clima.
 * @param {Object} routeResult - Ruta actual (sin waypoints)
 * @param {Date} depDate - Hora de salida
 * @param {string} mode - 'moto'|'car'|'walk'|'bicycle'
 * @param {Object} [options] - { pivotDistanceKm, maxExtraMinutes }
 * @param {Object} deps - { buildRouteWithWaypoints: (waypoints, depDate, originCoords, destCoords, mode, options?) => Promise<routeResult> }
 * @returns {Promise<Object|null>} { type: 'space', routeResult, extraMinutes, adversityScore, suggestedLabel } o null
 */
export async function findBestSpatialDetour(routeResult, depDate, mode, options = {}, deps) {
    const buildRouteWithWaypoints = deps?.buildRouteWithWaypoints;
    if (!routeResult || !buildRouteWithWaypoints) return null;

    const { originCoords, destCoords, routeGeometry, segments: segs, dist: routeDist } = routeResult;
    if (!originCoords || !destCoords || !segs?.origin || !segs?.mid || !segs?.dest) return null;
    if ((routeResult.waypoints?.length ?? 0) > 0) return null;

    const geometry = routeGeometry || [];
    if (geometry.length < 2) return null;

    const originalAdversity = calculateAdversityScore(routeResult);
    if (originalAdversity < ADVERSITY_THRESHOLD) return null;

    // Safety First: comparar solo trayecto (sin destino) y tolerancia temporal elástica
    const originalEnRoute = calculateAdversityScoreEnRoute(routeResult);
    const originalDurationMinutes = routeResult.durationMinutes ?? 0;
    const pivotDistanceKm = options.pivotDistanceKm ?? getPivotDistanceKm(routeDist);
    const maxExtraMinutes = options.maxExtraMinutes ?? getMaxExtraMinutes(originalDurationMinutes);
    const minImprovement = originalEnRoute * MIN_IMPROVEMENT_RATIO;

    const fraction = getWorstSegmentFraction(routeResult);
    const P = pointAlongRoute(geometry, fraction);
    const tangent = getTangentAtFraction(geometry, fraction);
    if (!P || !tangent) return null;

    let best = null;
    let bestEnRoute = originalEnRoute;

    for (const sign of [1, -1]) {
        try {
            const pivot = pivotPointFromTangent(P, tangent, pivotDistanceKm, sign);
            // avoidFerries: el mar como límite; no ofrecer rutas por ferry (p. ej. Estrecho de Gibraltar → Marruecos)
            const newRoute = await buildRouteWithWaypoints([pivot], depDate, originCoords, destCoords, mode, { avoidFerries: true });
            if (!newRoute?.segments) continue;

            const newEnRoute = calculateAdversityScoreEnRoute(newRoute);
            const newDuration = newRoute.durationMinutes ?? 0;
            const extraMinutes = newDuration - originalDurationMinutes;
            const improvement = originalEnRoute - newEnRoute;
            const improvementPct = originalEnRoute > 0 ? Math.round((improvement / originalEnRoute) * 100) : 0;

            if (extraMinutes > maxExtraMinutes) {
                continue;
            }
            if (improvement < minImprovement || newEnRoute >= bestEnRoute) {
                continue;
            }

            bestEnRoute = newEnRoute;
            best = {
                type: 'space',
                routeResult: newRoute,
                extraMinutes,
                adversityScore: newRoute.segments ? calculateAdversityScore(newRoute) : newEnRoute,
                suggestedLabel: `+${extraMinutes} min`
            };
        } catch (e) {
            continue;
        }
    }

    return best;
}
