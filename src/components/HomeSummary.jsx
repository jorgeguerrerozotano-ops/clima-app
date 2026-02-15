import React from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import Button from './ui/Button';
import { PREDEFINED_ACTIVITIES, checkActivityRules, getIconComponent, getActivityDisplayLabel, getActivityDurationLabel } from '../utils/activitiesConfig';
import { getIndexOfCurrentTime, interpolateHourlyValue } from '../utils/helpers';

const HomeSummary = ({ weatherData, onSelectActivity, favorites, customActivities = [], onGoToActivities }) => {
    const { t } = useTranslation();

    if (!weatherData || !weatherData.rawHourly) return null;

    const timezone = weatherData.timezone;
    const raw = weatherData.rawHourly;
    const startIndex = getIndexOfCurrentTime(raw?.time, timezone);
    if (startIndex === -1) return null;

    const interpolatedTemp = interpolateHourlyValue(raw.temperature_2m, raw.time, new Date(), timezone);
    const interpolatedFeelsLike = interpolateHourlyValue(raw.apparent_temperature, raw.time, new Date(), timezone);

    const allActivities = [...PREDEFINED_ACTIVITIES, ...(Array.isArray(customActivities) ? customActivities : [])];
    const activitiesToShow = allActivities.filter(act => favorites && favorites.includes(act.id)).slice(0, 4);

    const renderActivityCard = (act) => {
        const Icon = typeof act.icon === 'string' ? getIconComponent(act.icon) : act.icon;
        const result = checkActivityRules(weatherData.rawHourly, startIndex, act.duration, act.rules, {
            interpolatedTemp: interpolatedTemp ?? undefined,
            interpolatedFeelsLike: interpolatedFeelsLike ?? undefined
        });
        
        let bgClass = "bg-emerald-500/10 border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/20";
        let dotClass = "bg-emerald-400";
        
        if (result.status === 'yellow') {
            bgClass = "bg-yellow-500/10 border-yellow-500/50 text-yellow-300 hover:bg-yellow-500/20";
            dotClass = "bg-yellow-400";
        } else if (result.status === 'red') {
            bgClass = "bg-red-500/10 border-red-500/50 text-red-300 hover:bg-red-500/20";
            dotClass = "bg-red-400";
        } else if (result.status === 'gray') {
            bgClass = "bg-slate-700/30 border-slate-600/50 text-slate-400 hover:bg-slate-700/50";
            dotClass = "bg-slate-500";
        }

        return (
            <Button
                key={act.id}
                variant="ghost"
                onClick={() => onSelectActivity(act)}
                className={`flex flex-col items-center justify-center p-2 rounded-xl border backdrop-blur-md transition-all active:scale-95 min-w-[100px] flex-shrink-0 rounded-xl ${bgClass}`}
            >
                <div className="flex justify-between w-full mb-1">
                    <Icon size={16} className="opacity-90" />
                    <div className={`w-1.5 h-1.5 rounded-full ${dotClass} shadow-[0_0_8px_currentColor]`}></div>
                </div>
                <span className="text-xs font-bold uppercase tracking-wide w-full text-left truncate">{getActivityDisplayLabel(act)}</span>
                <span className="text-xxxs opacity-70 w-full text-left mt-0.5">{getActivityDurationLabel(act)}</span>
            </Button>
        );
    };

    const addActivityButton = (
        <Button
            type="button"
            variant="secondary"
            size="icon"
            onClick={() => onGoToActivities?.()}
            className="flex items-center justify-center w-6 h-6 shrink-0 rounded-md border border-dashed border-border-default text-muted hover:border-primary/50 hover:text-primary hover:bg-primary/10"
            title={t('activities.addActivity')} aria-label={t('activities.addActivity')}
        >
            <Plus size={12} className="opacity-90" />
        </Button>
    );

    return (
        <div className="mt-2">
            <div className="flex justify-end mb-1">
                {addActivityButton}
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                {activitiesToShow.map(act => renderActivityCard(act))}
            </div>
        </div>
    );
};

export default HomeSummary;