import React from 'react';
import { PREDEFINED_ACTIVITIES, checkActivityRules, getIconComponent } from '../utils/activitiesConfig';

const HomeSummary = ({ weatherData, onSelectActivity, favorites }) => {
    if (!weatherData || !weatherData.rawHourly) return null;

    const currentHour = new Date().getHours();
    const startIndex = weatherData.rawHourly.time.findIndex(t => new Date(t).getHours() === currentHour);
    
    if (startIndex === -1) return null;

    let customActs = [];
    try {
        const savedCustom = localStorage.getItem('my_activities');
        if (savedCustom) customActs = JSON.parse(savedCustom);
    } catch (e) {}

    const allActivities = [...PREDEFINED_ACTIVITIES, ...customActs];
    const activitiesToShow = allActivities.filter(act => favorites && favorites.includes(act.id)).slice(0, 3);

    if (activitiesToShow.length === 0) {
        return (
            <div className="mt-2 text-center text-xs text-slate-500 py-2 border border-dashed border-slate-700 rounded-xl">
                Añade favoritos en Planes
            </div>
        );
    }

    return (
        <div className="grid grid-cols-3 gap-2 mt-2">
            {activitiesToShow.map(act => {
                const Icon = typeof act.icon === 'string' ? getIconComponent(act.icon) : act.icon;
                const result = checkActivityRules(weatherData.rawHourly, startIndex, act.duration, act.rules);
                
                // --- SOPORTE PARA ESTADO 'GRAY' Y COLORES CORRECTOS ---
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
                    <button 
                        key={act.id}
                        onClick={() => onSelectActivity(act)}
                        className={`flex flex-col items-center justify-center p-2 rounded-xl border backdrop-blur-md transition-all active:scale-95 ${bgClass}`}
                    >
                        <div className="flex justify-between w-full mb-1">
                             <Icon size={16} className="opacity-90" />
                             <div className={`w-1.5 h-1.5 rounded-full ${dotClass} shadow-[0_0_8px_currentColor]`}></div>
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-wide w-full text-left truncate">{act.label}</span>
                    </button>
                );
            })}
        </div>
    );
};

export default HomeSummary;