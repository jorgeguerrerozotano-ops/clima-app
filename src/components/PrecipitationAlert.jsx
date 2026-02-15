import React from 'react';
import { useTranslation } from 'react-i18next';
import { CircleAlert } from 'lucide-react';
import { getFactorIcon, getUIIcon } from '../utils/iconMap';

/**
 * Alerta de Precipitación Inminente (próximas 8h).
 * Solo se renderiza cuando hay un evento de inicio o fin de lluvia/nieve en esa ventana.
 * Nieve tiene prioridad visual (más peligrosa).
 */
const PrecipitationAlert = ({ alert }) => {
    const { t } = useTranslation();

    if (!alert) return null;

    const { type, hourLabel, relativeLabel, isSnow, precipTypeLabel, isApprox } = alert;
    const WeatherIcon = isSnow ? getFactorIcon('SNOW') : getUIIcon('umbrella');

    const colorClass = isSnow
        ? 'text-cyan-200 bg-cyan-500/10 border-cyan-500/20'
        : 'text-blue-200 bg-blue-500/10 border-blue-500/20';
    const iconColor = isSnow ? 'text-cyan-400' : 'text-blue-400';

    const message =
        isApprox !== false
            ? type === 'stop'
                ? t('weather.approxStopsAt', { time: hourLabel })
                : isSnow
                  ? t('weather.approxSnowAt', { time: hourLabel })
                  : t('weather.approxRainAt', { time: hourLabel })
            : type === 'stop'
                ? `${t('weather.stopsAt')} ${hourLabel}`
                : isSnow
                  ? `${t('weather.snowAt')} ${hourLabel}`
                  : `${t('weather.rainAt')} ${hourLabel}`;

    return (
        <div
            className={`mt-2 inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border backdrop-blur-md ${colorClass} animate-fade-in shadow-lg shadow-black/10`}
            role="status"
            aria-live="polite"
        >
            <div className="flex items-center justify-center bg-white/10 p-1 rounded-full animate-pulse">
                <CircleAlert size={14} className={iconColor} strokeWidth={3} />
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
                {WeatherIcon && <WeatherIcon size={14} className="opacity-80 shrink-0" strokeWidth={2.5} />}
                {precipTypeLabel && (
                    <span className="text-xs font-bold opacity-90 capitalize">{precipTypeLabel}</span>
                )}
                <span className="text-xs font-bold tracking-wide">{message}</span>
            </div>
            {type !== 'stop' && relativeLabel && (
                <>
                    <div className="w-px h-3 bg-current opacity-20 shrink-0" aria-hidden />
                    <span className="text-xs font-bold opacity-90">{relativeLabel}</span>
                </>
            )}
        </div>
    );
};

export default PrecipitationAlert;
