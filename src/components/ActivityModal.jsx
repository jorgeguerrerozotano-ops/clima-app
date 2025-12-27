import React from 'react';
import { X, Clock } from 'lucide-react';
import { checkActivityRules } from '../utils/activitiesConfig';

const ActivityModal = ({ activity, weatherData, onClose }) => {
    if (!activity || !weatherData) return null;

    const currentHour = new Date().getHours();
    const startIndex = weatherData.rawHourly.time.findIndex(t => new Date(t).getHours() === currentHour);
    
    const result = checkActivityRules(weatherData.rawHourly, startIndex, activity.duration, activity.rules);

    let nextOp = null;
    if (result.status !== 'green') {
        const limit = Math.min(startIndex + 48, weatherData.rawHourly.time.length - 1);
        for (let i = startIndex + 1; i < limit; i++) {
            const r = checkActivityRules(weatherData.rawHourly, i, activity.duration, activity.rules);
            if (r.status === 'green') {
                const d = new Date(weatherData.rawHourly.time[i]);
                const dayStr = d.getDate() === new Date().getDate() ? "Hoy" : (d.getDate() === new Date().getDate()+1 ? "Mañana" : "Pasado");
                nextOp = `${dayStr} ${d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`;
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

    const Icon = activity.icon;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div className={`bg-slate-900 border ${borderClass} w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl relative flex flex-col`} onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="absolute right-4 top-4 p-2 rounded-full bg-slate-800 text-slate-400 hover:text-white z-10"><X size={20} /></button>

                <div className={`${bgClass} p-6 pb-4 text-center relative`}>
                    <div className={`inline-flex p-4 rounded-full ${iconBg} backdrop-blur-md shadow-lg mb-4`}>
                        <Icon size={48} className="text-white drop-shadow-md" />
                    </div>
                    
                    <h2 className="text-xl font-bold text-white leading-tight">
                        {activity.label} <span className="text-slate-400 font-normal block text-sm mt-1">{activity.durationLabel}</span>
                    </h2>
                    
                    <div className="mt-3">
                        <span className={`text-sm font-black uppercase tracking-widest ${colorClass}`}>{result.message}</span>
                    </div>
                </div>

                <div className="p-5 bg-slate-900 relative z-10 flex-1 border-t border-white/5">
                    <div className="mb-6 text-center">
                        <p className="text-sm text-slate-300 leading-relaxed italic">"{result.analysis}"</p>
                    </div>

                    {/* GRID DE 4 FACTORES */}
                    <div className="grid grid-cols-2 gap-3 mb-6">
                        {result.factors.map((f, i) => {
                            let fColor = 'text-emerald-400', fBg = 'bg-emerald-500/10 border-emerald-500/20';
                            if (f.status === 'yellow') { fColor = 'text-yellow-400'; fBg = 'bg-yellow-500/10 border-yellow-500/20'; }
                            if (f.status === 'red') { fColor = 'text-red-400'; fBg = 'bg-red-500/10 border-red-500/20'; }
                            if (f.status === 'gray') { fColor = 'text-slate-400'; fBg = 'bg-slate-700/30 border-slate-600/30'; }
                            
                            const FIcon = f.icon;
                            return (
                                <div key={i} className={`flex flex-col items-center justify-center p-3 rounded-xl border ${fBg}`}>
                                    <FIcon size={16} className={`${fColor} mb-1`} />
                                    <span className={`text-lg font-bold ${fColor}`}>{f.value}</span>
                                    <span className="text-[10px] text-slate-400 uppercase font-bold">{f.name}</span>
                                </div>
                            );
                        })}
                    </div>

                    {result.status !== 'green' && result.status !== 'gray' && (
                        <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700 flex items-center gap-4">
                            <div className="p-2.5 bg-blue-600 rounded-xl text-white shadow-lg shadow-blue-900/50">
                                <Clock size={20} />
                            </div>
                            <div>
                                <span className="block text-[10px] uppercase font-bold text-slate-500 tracking-wider">Mejor momento en las próximas 48h</span>
                                <span className="text-sm font-bold text-blue-200">{nextOp || "No encontrado"}</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ActivityModal;