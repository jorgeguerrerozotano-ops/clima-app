import React from 'react';
import { useTranslation } from 'react-i18next';
import { X, Info, Pencil } from 'lucide-react';
import Button from './ui/Button';
import Card from './ui/Card';
import { FACTOR_ICONS } from '../utils/riskUtils';

const STATUS_COLOR = {
    CRITICAL: 'text-red-400',
    WARNING: 'text-yellow-400',
    SAFE: 'text-emerald-400',
    INFO: 'text-slate-400',
};

/**
 * Caja flotante pequeña junto al punto: nombre • hora, iconos de factores con color, Ver informe (pestaña general), Editar (solo paradas).
 */
const RoutePointSummaryCard = ({ segment, segmentKey, position, onEdit, onViewReport, onClose }) => {
    const { t } = useTranslation();
    if (!segment) return null;

    const sortedFactors = segment.sortedFactors ?? [];
    const isWaypoint = segmentKey !== 'origin' && segmentKey !== 'dest';
    const topFactors = sortedFactors.slice(0, 3);

    const baseStyle = { pointerEvents: 'auto' };
    const positionStyle = position
        ? { ...baseStyle, position: 'absolute', left: position.left, top: position.top, transform: 'translate(-50%, -100%)', marginTop: -8 }
        : { ...baseStyle, position: 'absolute', bottom: 12, left: 12, right: 12 };

    return (
        <Card
            variant="default"
            padding="none"
            className="z-[700] rounded-xl border border-border-default bg-slate-900/95 backdrop-blur shadow-xl animate-fade-in overflow-hidden min-w-[170px] max-w-[260px]"
            style={positionStyle}
        >
            <div className={`px-2.5 py-1.5 flex items-center justify-between gap-1 ${segment.colorClass || 'bg-slate-800/50'}`}>
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-white truncate" title={`${segment.name} • ${segment.time}`}>
                        {segment.time}
                    </p>
                    {segment.remainingKm != null && segmentKey !== 'dest' && (
                        <p className="text-[9px] text-slate-400 font-bold mt-0.5">
                            {segment.remainingKm} {t('routes.kmToDest')}
                        </p>
                    )}
                </div>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    className="p-1.5 rounded-lg shrink-0"
                    aria-label={t('common.close')}
                >
                    <X size={12} />
                </Button>
            </div>
            <div className="px-2.5 py-2 flex flex-wrap items-center gap-2">
                {topFactors.map((f, i) => {
                    const Icon = FACTOR_ICONS[f.type] ?? FACTOR_ICONS.DEFAULT;
                    const colorClass = STATUS_COLOR[f.status] ?? STATUS_COLOR.INFO;
                    return (
                        <span key={i} className={`flex items-center gap-1 ${colorClass}`} title={f.label}>
                            <Icon size={12} className="shrink-0" />
                            <span className="text-xs font-bold truncate max-w-[56px]">{f.value}</span>
                        </span>
                    );
                })}
            </div>
            <div className="px-2 py-1.5 flex flex-wrap items-center gap-1.5 border-t border-white/5">
                {onViewReport && (
                    <Button
                        type="button"
                        variant="secondary"
                        size="icon"
                        onClick={onViewReport}
                        className="p-1.5 rounded-lg text-slate-200"
                        title={t('routes.viewReport')}
                        aria-label={t('routes.viewReport')}
                    >
                        <Info size={16} />
                    </Button>
                )}
                {isWaypoint && onEdit && (
                    <Button
                        type="button"
                        variant="primary"
                        size="icon"
                        onClick={onEdit}
                        className="p-1.5 rounded-lg"
                        title={t('routes.editOnMap')}
                        aria-label={t('routes.editOnMap')}
                    >
                        <Pencil size={14} />
                    </Button>
                )}
            </div>
        </Card>
    );
};

export default RoutePointSummaryCard;
