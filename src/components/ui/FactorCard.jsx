// src/components/ui/FactorCard.jsx
// Renderiza un factor estandarizado usando FACTOR_ICONS centralizado

import React from 'react';
import { FACTOR_ICONS } from '../../utils/riskUtils';

const STATUS_STYLES = {
    CRITICAL: { color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
    WARNING: { color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' },
    SAFE: { color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
    INFO: { color: 'text-slate-400', bg: 'bg-slate-700/30 border-slate-600/30' },
};

/**
 * Tarjeta de un factor. Acepta factor estandarizado { type, value, status, label, description }.
 * @param {Object} factor - Factor del array sortedFactors
 * @param {string} size - 'sm'|'md'|'lg'
 * @param {boolean} showLabel - Mostrar etiqueta (label)
 * @param {boolean} showDescription - Mostrar descripción (para listas detalladas)
 * @param {string} layout - 'grid' (icon arriba) | 'row' (icon a la izquierda, para listas)
 */
const FactorCard = ({ factor, size = 'md', showLabel = true, showDescription = false, layout = 'grid' }) => {
    if (!factor) return null;
    const style = STATUS_STYLES[factor.status] ?? STATUS_STYLES.INFO;
    const Icon = FACTOR_ICONS[factor.type] ?? FACTOR_ICONS.DEFAULT;
    const iconSize = size === 'sm' ? 14 : size === 'lg' ? 20 : 16;
    const valueClass = size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-lg' : 'text-base';
    const labelClass = 'text-xs uppercase font-bold';

    if (layout === 'row') {
        return (
            <div className={`flex items-start gap-3 rounded-lg border p-3 ${style.bg}`}>
                <Icon size={iconSize} className={`${style.color} shrink-0 mt-0.5`} />
                <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                        <span className={`font-bold ${style.color} ${valueClass}`}>{factor.value}</span>
                        {showLabel && <span className={`text-slate-400 ${labelClass}`}>{factor.label}</span>}
                    </div>
                    {showDescription && factor.description && (
                        <p className="text-xs text-slate-500 mt-1 leading-tight">{factor.description}</p>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className={`flex flex-col items-center justify-center rounded-xl border p-2 ${style.bg}`}>
            <Icon size={iconSize} className={`${style.color} mb-1`} />
            <span className={`font-bold ${style.color} ${valueClass}`}>{factor.value}</span>
            {showLabel && <span className={`text-slate-400 ${labelClass}`}>{factor.label}</span>}
        </div>
    );
};

export default FactorCard;
export { STATUS_STYLES, FACTOR_ICONS };
