import React from 'react';
import { useTranslation } from 'react-i18next';
import { X, Clock } from 'lucide-react';
import { checkActivityRules, getActivityDisplayLabel, getActivityDurationLabel, getIconComponent } from '../utils/activitiesConfig';
import { getIndexOfCurrentTime, interpolateHourlyValue } from '../utils/helpers';
import Button from './ui/Button';
import Card from './ui/Card';
import FactorCard from './ui/FactorCard';

const ActivityModal = ({ activity, weatherData, onClose }) => {
    const { t, i18n } = useTranslation();
    if (!activity || !weatherData) return null;

    const timezone = weatherData.timezone;
    const startIndex = getIndexOfCurrentTime(weatherData.rawHourly.time, timezone);
    if (startIndex === -1) return null;

    const raw = weatherData.rawHourly;
    const interpolatedTemp = interpolateHourlyValue(raw.temperature_2m, raw.time, new Date(), timezone);
    const interpolatedFeelsLike = interpolateHourlyValue(raw.apparent_temperature, raw.time, new Date(), timezone);

    const result = checkActivityRules(weatherData.rawHourly, startIndex, activity.duration, activity.rules, {
        interpolatedTemp: interpolatedTemp ?? undefined,
        interpolatedFeelsLike: interpolatedFeelsLike ?? undefined
    });

    let nextOp = null;
    if (result.status !== 'green') {
        const limit = Math.min(startIndex + 48, weatherData.rawHourly.time.length - 1);
        for (let i = startIndex + 1; i < limit; i++) {
            const r = checkActivityRules(weatherData.rawHourly, i, activity.duration, activity.rules);
            if (r.status === 'green') {
                const d = new Date(weatherData.rawHourly.time[i]);
                const dayStr = d.getDate() === new Date().getDate() ? t('common.today') : (d.getDate() === new Date().getDate()+1 ? t('common.tomorrow') : t('common.yesterday'));
                nextOp = `${dayStr} ${d.toLocaleTimeString(i18n.language, {hour:'2-digit', minute:'2-digit'})}`;
                break;
            }
        }
    }

    // --- COLORES Y ESTILOS ---
    let colorClass = 'text-emerald-400', borderClass = 'border-emerald-500/50', bgClass = 'bg-emerald-500/10', iconBg = 'bg-emerald-500/20';
    
    if (result.status === 'yellow') { 
        colorClass = 'text-yellow-400'; borderClass = 'border-yellow-500/50'; bgClass = 'bg-yellow-500/10'; iconBg = 'bg-yellow-500/20';
    } else if (result.status === 'red') { 
        colorClass = 'text-red-400'; borderClass = 'border-red-500/50'; bgClass = 'bg-red-500/10'; iconBg = 'bg-red-500/20';
    } else if (result.status === 'gray') {
        colorClass = 'text-slate-400'; borderClass = 'border-slate-600/50'; bgClass = 'bg-slate-700/30'; iconBg = 'bg-slate-700';
    }

    const Icon = typeof activity.icon === 'string' ? getIconComponent(activity.icon) : activity.icon;

    const handleBackdropKeyDown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClose();
      }
    };

    return (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
          onClick={onClose}
          role="button"
          tabIndex={0}
          aria-label={t('common.close')}
          onKeyDown={handleBackdropKeyDown}
        >
            <Card variant="default" padding="none" className={`w-full max-w-sm rounded-3xl relative flex flex-col border ${borderClass}`} onClick={e => e.stopPropagation()}>
                <Button variant="ghost" size="iconLg" onClick={onClose} className="absolute right-4 top-4 p-2 rounded-full z-10" title={t('common.close')} aria-label={t('common.close')}><X size={20} /></Button>

                <div className={`${bgClass} p-6 pb-4 text-center relative`}>
                    <div className={`inline-flex p-4 rounded-full ${iconBg} backdrop-blur-md shadow-lg mb-4`}>
                        <Icon size={48} className="text-white drop-shadow-md" />
                    </div>
                    
                    <h2 className="text-xl font-bold text-white leading-tight">
                        {getActivityDisplayLabel(activity)}
                        <span className="text-slate-400 font-normal block text-sm mt-1">{getActivityDurationLabel(activity)}</span>
                    </h2>
                    
                    <div className="mt-3">
                        <span className={`text-sm font-black uppercase tracking-widest ${colorClass}`}>{result.message}</span>
                    </div>
                </div>

                <div className="px-5 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] bg-slate-900 relative z-10 flex-1 border-t border-white/5">
                    <div className="mb-6 text-center">
                        <p className="text-sm text-slate-300 leading-relaxed italic">"{result.analysis}"</p>
                    </div>

                    {/* GRID DE TODOS LOS FACTORES (ordenados por gravedad) */}
                    <div className="grid grid-cols-2 gap-3 mb-6">
                        {(result.sortedFactors ?? []).map((f, i) => (
                            <FactorCard key={i} factor={f} size="md" showLabel={true} />
                        ))}
                    </div>

                    {result.status !== 'green' && result.status !== 'gray' && (
                        <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700 flex items-center gap-4">
                            <div className="p-2.5 bg-blue-600 rounded-xl text-white shadow-lg shadow-blue-900/50">
                                <Clock size={20} />
                            </div>
                            <div>
                                <span className="block text-xs uppercase font-bold text-slate-500 tracking-wider">{t('activities.bestNext48h')}</span>
                                <span className="text-sm font-bold text-blue-200">{nextOp || t('common.noData')}</span>
                            </div>
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
};

export default ActivityModal;