import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
    ChevronDown, ChevronUp, Clock, Calendar, Check, AlertTriangle, XCircle, Plus, 
    Thermometer, Wind, Play, Star, Pencil, Trash2, HelpCircle
} from 'lucide-react';
import LocationSearchInput from './LocationSearchInput'; 
import { PREDEFINED_ACTIVITIES, checkActivityRules, getIconComponent } from '../utils/activitiesConfig';
import { getWeatherInfo } from '../hooks/useWeather';
import CreateActivityModal from './CreateActivityModal'; // Ahora se comporta como formulario inline

const ActivitiesTab = ({ 
    weatherData, 
    onLocationSelect, 
    onGPS, 
    onOpenMap, 
    favorites, 
    onToggleFavorite, 
    customActivities, 
    onSaveActivity, 
    onDeleteActivity 
}) => {
    const [scheduleMode, setScheduleMode] = useState('now'); 
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedTime, setSelectedTime] = useState(new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false}));
    const [expandedId, setExpandedId] = useState(null); 
    const [showAnalysis, setShowAnalysis] = useState(true); 
    const [searchInput, setSearchInput] = useState('');
    
    // ESTADOS PARA EL FORMULARIO INLINE
    const [isCreating, setIsCreating] = useState(false);
    const [editingActivity, setEditingActivity] = useState(null);
    
    // REFERENCIA PARA EL AUTO-SCROLL
    const formRef = useRef(null);

    // EFECTO: SCROLL AUTOMÁTICO AL ABRIR FORMULARIO
    useEffect(() => {
        if ((isCreating || editingActivity) && formRef.current) {
            // Pequeño timeout para dar tiempo a que el DOM se pinte
            setTimeout(() => {
                formRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
        }
    }, [isCreating, editingActivity]);

    const handleSave = (newAct) => {
        onSaveActivity(newAct);
        closeForm();
    };

    const handleEditClick = (act) => {
        setEditingActivity(act);
        setIsCreating(true); // Activamos modo formulario
    }

    const closeForm = () => {
        setIsCreating(false);
        setEditingActivity(null);
    };

    const handleLocalSelect = (item) => {
        if (item) {
            onLocationSelect(item); 
            setSearchInput(item.name);
            resetAnalysis();
        }
    };

    const allActivities = [...PREDEFINED_ACTIVITIES, ...customActivities];
    const resetAnalysis = () => setShowAnalysis(false);

    const weekDays = useMemo(() => {
        const days = [];
        const today = new Date();
        for (let i = 0; i < 7; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() + i);
            let label = i === 0 ? "Hoy" : i === 1 ? "Mañana" : date.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' });
            days.push({ value: date.toISOString().split('T')[0], label: label.charAt(0).toUpperCase() + label.slice(1) });
        }
        return days;
    }, []);

    const getStartIndex = () => {
        if (!weatherData || !weatherData.rawHourly) return 0;
        const now = new Date();
        let targetDate = scheduleMode === 'scheduled' ? new Date(`${selectedDate}T${selectedTime}`) : now;
        const index = weatherData.rawHourly.time.findIndex(t => {
            const d = new Date(t);
            return d.getFullYear() === targetDate.getFullYear() && d.getMonth() === targetDate.getMonth() && d.getDate() === targetDate.getDate() && d.getHours() === targetDate.getHours();
        });
        return index !== -1 ? index : 0;
    };

    const findRecommendation = (act, targetIndex) => {
        if (!weatherData.rawHourly) return null;
        let startSearch, endSearch;
        const maxLen = weatherData.rawHourly.time.length - 1;
        if (scheduleMode === 'now') {
            startSearch = targetIndex + 1;
            endSearch = Math.min(maxLen, targetIndex + 48);
        } else {
            const now = new Date();
            const nowIndex = weatherData.rawHourly.time.findIndex(t => new Date(t) >= now);
            startSearch = Math.max(nowIndex, targetIndex - 24);
            endSearch = Math.min(maxLen, targetIndex + 24);
        }
        let bestIndex = -1, minDist = Infinity;
        for (let i = startSearch; i <= endSearch; i++) {
            if (i === targetIndex) continue;
            const r = checkActivityRules(weatherData.rawHourly, i, act.duration, act.rules);
            if (r.status === 'green') {
                if (scheduleMode === 'now') { return formatResult(i); } 
                else {
                    const dist = Math.abs(i - targetIndex);
                    if (dist < minDist) { minDist = dist; bestIndex = i; }
                }
            }
        }
        if (bestIndex !== -1) return formatResult(bestIndex);
        return null;
    };

    const formatResult = (index) => {
        const d = new Date(weatherData.rawHourly.time[index]);
        const dNow = new Date();
        let dayStr = "";
        if (d.getDate() === dNow.getDate()) dayStr = "Hoy";
        else if (d.getDate() === dNow.getDate() + 1) dayStr = "Mañana";
        else dayStr = d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' });
        return `${dayStr} ${d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`;
    };

    if (!weatherData) return null;

    const startIndex = getStartIndex();
    const forecastTemp = Math.round(weatherData.rawHourly.temperature_2m[startIndex]);
    const forecastWind = Math.round(weatherData.rawHourly.wind_speed_10m[startIndex]);
    const forecastCode = weatherData.rawHourly.weather_code[startIndex];
    const forecastInfo = getWeatherInfo(forecastCode);

    return (
        <div className="pb-24 animate-fade-in space-y-4">
            
            <div className="glass-panel p-4 rounded-2xl sticky top-0 z-20 backdrop-blur-xl border-b border-white/10 shadow-xl">
                <div className="mb-4">
                    <LocationSearchInput 
                        placeholder={weatherData.location.name} 
                        initialValue={searchInput}
                        proximityCoords={weatherData.location} 
                        onSelect={handleLocalSelect}
                        onGPS={onGPS}
                        onMapClick={onOpenMap}
                    />
                </div>

                <div className="bg-slate-800/80 p-1 rounded-xl flex flex-col gap-2">
                    <div className="flex gap-1">
                        <button onClick={() => { setScheduleMode('now'); setShowAnalysis(true); }} className={`flex-1 flex justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${scheduleMode === 'now' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}><Clock size={12}/> Ahora</button>
                        <button onClick={() => { setScheduleMode('scheduled'); resetAnalysis(); }} className={`flex-1 flex justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${scheduleMode === 'scheduled' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400'}`}><Calendar size={12}/> Programar</button>
                    </div>
                    {scheduleMode === 'scheduled' && (
                        <div className="p-2 animate-fade-in border-t border-slate-700/50 mt-1">
                            <div className="flex overflow-x-auto gap-2 pb-2 no-scrollbar mb-2">
                                {weekDays.map((day, i) => (
                                    <button key={i} onClick={() => { setSelectedDate(day.value); resetAnalysis(); }} className={`whitespace-nowrap px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors ${selectedDate === day.value ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-700 border-slate-600 text-slate-300'}`}>{day.label}</button>
                                ))}
                            </div>
                            <input type="time" value={selectedTime} onChange={e => { setSelectedTime(e.target.value); resetAnalysis(); }} className="bg-slate-900 text-white text-center w-full py-2 rounded-lg font-bold border border-slate-600 outline-none" />
                        </div>
                    )}
                </div>

                {(!showAnalysis || scheduleMode === 'scheduled') && (
                    <button onClick={() => setShowAnalysis(true)} className={`w-full mt-3 font-bold py-3 rounded-xl shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all ${showAnalysis ? 'bg-slate-700 text-slate-400' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}>
                        {showAnalysis ? 'Actualizar Análisis' : <><Play className="w-4 h-4 fill-current"/> Analizar Planes</>}
                    </button>
                )}
            </div>

            {showAnalysis && (
                <div className="animate-fade-in space-y-3">
                    <div className="flex items-center justify-between bg-slate-800/50 border border-slate-700/50 p-3 rounded-xl">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{scheduleMode === 'now' ? 'Condiciones actuales' : `Previsión ${selectedTime}`}</span>
                        <div className="flex items-center gap-3 text-xs font-bold text-white">
                            <span className="flex items-center gap-1"><Thermometer size={14} className="text-orange-400"/> {forecastTemp}°</span>
                            <span className="flex items-center gap-1"><Wind size={14} className="text-blue-400"/> {forecastWind} km/h</span>
                            <span className={`${forecastInfo.color}`}>{forecastInfo.label}</span>
                        </div>
                    </div>

                    {allActivities.map((act) => {
                        const Icon = typeof act.icon === 'string' ? getIconComponent(act.icon) : act.icon;
                        const result = checkActivityRules(weatherData.rawHourly, startIndex, act.duration, act.rules);
                        const isExpanded = expandedId === act.id;
                        const isCustom = !PREDEFINED_ACTIVITIES.some(p => p.id === act.id);
                        const isFav = favorites.includes(act.id);
                        const isLimitReached = favorites.length >= 3;
                        const isButtonDisabled = !isFav && isLimitReached;

                        let colorClass = 'bg-emerald-500/10 border-emerald-500/50 text-emerald-300';
                        let iconBg = 'bg-emerald-500/20';
                        let StatusIcon = Check;
                        if (result.status === 'yellow') { colorClass = 'bg-yellow-500/10 border-yellow-500/50 text-yellow-300'; iconBg = 'bg-yellow-500/20'; StatusIcon = AlertTriangle; }
                        else if (result.status === 'red') { colorClass = 'bg-red-500/10 border-red-500/50 text-red-300'; iconBg = 'bg-red-500/20'; StatusIcon = XCircle; }
                        else if (result.status === 'gray') { colorClass = 'bg-slate-800/50 border-slate-700/50 text-slate-400'; iconBg = 'bg-slate-700'; StatusIcon = HelpCircle; }

                        const nextOp = (result.status !== 'green' && isExpanded) ? findRecommendation(act, startIndex) : null;
                        const labelNext = scheduleMode === 'now' ? "Mejor momento en las próximas 48h" : "Alternativa (+/- 24h)";

                        return (
                            <div key={act.id} onClick={() => setExpandedId(isExpanded ? null : act.id)} className={`rounded-xl border transition-all duration-300 overflow-hidden ${colorClass} ${isExpanded ? 'bg-opacity-20' : 'bg-opacity-10'}`}>
                                <div className="p-4 flex items-center justify-between cursor-pointer">
                                    <div className="flex items-center gap-4">
                                        <div className={`p-2.5 rounded-full ${iconBg} backdrop-blur-sm`}><Icon className="w-5 h-5 fill-current bg-transparent" /></div>
                                        <div>
                                            <h3 className="font-bold text-white text-sm">
                                                {act.label} <span className="opacity-60 font-normal">{act.durationLabel}</span>
                                            </h3>
                                            <div className="flex items-center gap-1.5 mt-0.5"><span className="text-xs font-bold opacity-90 uppercase tracking-wide">{result.message}</span></div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <button onClick={(e) => { e.stopPropagation(); if (!isButtonDisabled) onToggleFavorite(act.id); }} className={`p-1.5 rounded-full transition-colors ${isFav ? 'text-yellow-400 bg-yellow-400/10' : isButtonDisabled ? 'text-slate-700 cursor-not-allowed opacity-50' : 'text-slate-600 hover:text-slate-400'}`} disabled={isButtonDisabled}><Star size={18} fill={isFav ? "currentColor" : "none"} /></button>
                                        {isCustom && (<><button onClick={(e) => { e.stopPropagation(); handleEditClick(act); }} className="p-1.5 text-slate-500 hover:text-blue-400"><Pencil size={16} /></button><button onClick={(e) => { e.stopPropagation(); onDeleteActivity(act.id); }} className="p-1.5 text-slate-500 hover:text-red-400"><Trash2 size={16} /></button></>)}
                                        {isExpanded ? <ChevronUp className="w-4 h-4 opacity-70" /> : <ChevronDown className="w-4 h-4 opacity-70" />}
                                    </div>
                                </div>
                                {isExpanded && (
                                    <div className="px-4 pb-4 pt-0 animate-fade-in border-t border-white/10 mt-1">
                                        <div className="mt-3 mb-3 text-center"><p className="text-xs text-slate-300 leading-relaxed italic">"{result.analysis}"</p></div>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                                            {result.factors.map((f, i) => {
                                                let fColor = 'text-emerald-400', fBg = 'bg-emerald-500/10 border-emerald-500/20';
                                                if (f.status === 'yellow') { fColor = 'text-yellow-400'; fBg = 'bg-yellow-500/10 border-yellow-500/20'; }
                                                if (f.status === 'red') { fColor = 'text-red-400'; fBg = 'bg-red-500/10 border-red-500/20'; }
                                                if (f.status === 'gray') { fColor = 'text-slate-400'; fBg = 'bg-slate-700/30 border-slate-600/30'; }
                                                return (
                                                    <div key={i} className={`flex flex-col items-center p-2 rounded-lg border ${fBg}`}>
                                                        <span className={`text-[9px] uppercase font-bold text-slate-400 mb-0.5`}>{f.name}</span>
                                                        <span className={`text-sm font-bold ${fColor}`}>{f.value}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        {result.status !== 'green' && (
                                            <div className="bg-slate-900/50 border border-slate-700/50 p-3 rounded-lg flex items-start gap-2">
                                                <Clock className="w-4 h-4 text-blue-300 shrink-0 mt-0.5" />
                                                <div><span className="block text-[10px] uppercase font-bold text-slate-500">{labelNext}</span><span className="text-xs font-bold text-blue-200">{nextOp || "No encontrado"}</span></div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    
                    {/* AQUÍ ESTÁ LA MAGIA DEL FORMULARIO INLINE */}
                    {isCreating ? (
                        <div ref={formRef} className="animate-fade-in scroll-mt-24 mb-10">
                            <CreateActivityModal 
                                onClose={closeForm}
                                onSave={handleSave}
                                initialData={editingActivity}
                            />
                        </div>
                    ) : (
                        <button onClick={() => setIsCreating(true)} className="w-full py-4 rounded-xl border border-dashed border-slate-600 text-slate-400 text-sm font-bold hover:bg-slate-800/50 hover:border-slate-500 transition-all flex items-center justify-center gap-2 mb-6 active:scale-[0.98]">
                            <Plus className="w-5 h-5" /> Crear Actividad Personalizada
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export default ActivitiesTab;