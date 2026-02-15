import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
    ChevronDown, ChevronUp, Clock, Calendar, Check, AlertTriangle, XCircle, Plus, 
    Thermometer, Wind, Play, Star, Pencil, Trash2, HelpCircle, ChevronRight, Info
} from 'lucide-react';
import LocationSearchInput from './LocationSearchInput'; 
import { PREDEFINED_ACTIVITIES, checkActivityRules, getIconComponent, getActivityDisplayLabel, getActivityDurationLabel, getRainRiskState, hadRedRainInPreviousHours } from '../utils/activitiesConfig';
import { getIndexOfCurrentTime, interpolateHourlyValue, getWeekDaysForSelector } from '../utils/helpers';
import Button from './ui/Button';
import Card from './ui/Card';
import FactorCard from './ui/FactorCard';
import { getWeatherInfo } from '../hooks/useWeather';
import CreateActivityModal from './CreateActivityModal';
import ActivityAnalysisModal from './ActivityAnalysisModal';

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
    const { t, i18n } = useTranslation();
    const [scheduleMode, setScheduleMode] = useState('now'); 
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedTime, setSelectedTime] = useState(new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false}));
    const [expandedId, setExpandedId] = useState(null); 
    const [expandedFactorsId, setExpandedFactorsId] = useState(null);
    const [analysisModalData, setAnalysisModalData] = useState(null);
    const analysisModalRef = useRef(null);
    const expandedCardRef = useRef(null);
    const [showAnalysis, setShowAnalysis] = useState(true); 
    const [searchInput, setSearchInput] = useState('');
    
    // ESTADOS PARA EL MODAL DE CREAR/EDITAR ACTIVIDAD
    const [isCreating, setIsCreating] = useState(false);
    const [editingActivity, setEditingActivity] = useState(null);

    const handleSave = (newAct) => {
        onSaveActivity(newAct);
        closeForm();
    };

    const handleEditClick = (act) => {
        setEditingActivity(act);
        setIsCreating(true); // Activamos modo formulario
    }

    // Auto-scroll al modal de análisis al abrirlo
    useEffect(() => {
        if (analysisModalData && analysisModalRef.current) {
            setTimeout(() => {
                analysisModalRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 200);
        }
    }, [analysisModalData]);

    // Auto-scroll a la tarjeta expandida para que quede visible (factores, mejor momento)
    useEffect(() => {
        if (expandedId && expandedCardRef.current) {
            const t = setTimeout(() => {
                expandedCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 150);
            return () => clearTimeout(t);
        }
    }, [expandedId]);

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

    const weekDays = useMemo(() => getWeekDaysForSelector(t, i18n.language, 7), [t, i18n.language]);

    const getStartIndex = () => {
        if (!weatherData || !weatherData.rawHourly) return 0;
        const targetDate = scheduleMode === 'scheduled' ? new Date(`${selectedDate}T${selectedTime}`) : new Date();
        const index = getIndexOfCurrentTime(weatherData.rawHourly.time, weatherData.timezone, targetDate);
        return index !== -1 ? index : 0;
    };

    const findRecommendation = (act, targetIndex) => {
        if (!weatherData.rawHourly) return null;
        const raw = weatherData.rawHourly;
        const rainPreference = act.rules?.rainPreference ?? 'strict';
        const checkWetFloor = !!act.rules?.checkWetFloor;
        const windowHours = Math.min(12, Math.max(1, Math.ceil(act.duration / 60)));

        let startSearch, endSearch;
        const maxLen = raw.time.length - 1;
        if (scheduleMode === 'now') {
            startSearch = targetIndex + 1;
            endSearch = Math.min(maxLen, targetIndex + 48);
        } else {
            const now = new Date();
            const nowIndex = raw.time.findIndex(t => new Date(t) >= now);
            startSearch = Math.max(nowIndex >= 0 ? nowIndex : 0, targetIndex - 24);
            endSearch = Math.min(maxLen, targetIndex + 24);
        }

        const passesRainFilter = (rainRisk) => {
            if (rainPreference === 'strict') return rainRisk === 'green';
            if (rainPreference === 'flexible') return rainRisk !== 'red';
            return true;
        };
        const passesWetFloor = (i) => !checkWetFloor || !hadRedRainInPreviousHours(raw, i);

        let bestIndex = -1, minDist = Infinity;
        for (let i = startSearch; i <= endSearch; i++) {
            if (i === targetIndex) continue;
            const r = checkActivityRules(raw, i, act.duration, act.rules);
            if (r.status === 'red') continue;
            const rainRisk = getRainRiskState(raw, i, windowHours);
            if (!passesRainFilter(rainRisk)) continue;
            if (!passesWetFloor(i)) continue;
            const ok = rainPreference === 'strict' ? r.status === 'green' : true;
            if (!ok) continue;
            if (scheduleMode === 'now') return formatResult(i);
            const dist = Math.abs(i - targetIndex);
            if (dist < minDist) { minDist = dist; bestIndex = i; }
        }
        if (bestIndex !== -1) return formatResult(bestIndex);
        return null;
    };

    const formatResult = (index) => {
        const d = new Date(weatherData.rawHourly.time[index]);
        const dNow = new Date();
        let dayStr = "";
        if (d.getDate() === dNow.getDate()) dayStr = t('common.today');
        else if (d.getDate() === dNow.getDate() + 1) dayStr = t('common.tomorrow');
        else dayStr = d.toLocaleDateString(i18n.language, { weekday: 'short', day: 'numeric' });
        return `${dayStr} ${d.toLocaleTimeString(i18n.language, {hour:'2-digit', minute:'2-digit'})}`;
    };

    if (!weatherData) return null;

    const startIndex = getStartIndex();
    const raw = weatherData.rawHourly;
    const tz = weatherData.timezone;
    const interpolatedTemp = scheduleMode === 'now' ? interpolateHourlyValue(raw.temperature_2m, raw.time, new Date(), tz) : null;
    const interpolatedFeelsLike = scheduleMode === 'now' ? interpolateHourlyValue(raw.apparent_temperature, raw.time, new Date(), tz) : null;
    const forecastTemp = Math.round((scheduleMode === 'now' && interpolatedTemp != null) ? interpolatedTemp : raw.temperature_2m[startIndex]);
    const forecastWind = Math.round(raw.wind_speed_10m[startIndex]);
    const forecastCode = raw.weather_code[startIndex];
    const forecastInfo = getWeatherInfo(forecastCode);

    return (
        <div className="pb-24 animate-fade-in space-y-4">
            
            <Card variant="glass" padding="sm" className="rounded-2xl border-b border-white/10">
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
                        <Button variant={scheduleMode === 'now' ? 'primary' : 'ghost'} size="sm" onClick={() => { setScheduleMode('now'); setShowAnalysis(true); }} className="flex-1 flex justify-center gap-2 py-2 rounded-lg text-xs font-bold shadow-lg"><Clock size={12}/> {t('activities.now')}</Button>
                        <Button variant={scheduleMode === 'scheduled' ? 'primary' : 'ghost'} size="sm" onClick={() => { setScheduleMode('scheduled'); resetAnalysis(); }} className="flex-1 flex justify-center gap-2 py-2 rounded-lg text-xs font-bold shadow-lg"><Calendar size={12}/> {t('activities.schedule')}</Button>
                    </div>
                    {scheduleMode === 'scheduled' && (
                        <div className="p-2 animate-fade-in border-t border-slate-700/50 mt-1">
                            <div className="flex overflow-x-auto gap-2 pb-2 no-scrollbar mb-2">
                                {weekDays.map((day, i) => (
                                    <Button key={i} variant="secondary" size="sm" onClick={() => { setSelectedDate(day.value); resetAnalysis(); }} className={`whitespace-nowrap px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors ${selectedDate === day.value ? 'bg-success border-success text-white' : 'text-slate-300'}`}>{day.label}</Button>
                                ))}
                            </div>
                            <input type="time" value={selectedTime} onChange={e => { setSelectedTime(e.target.value); resetAnalysis(); }} className="bg-slate-900 text-white text-center w-full py-2 rounded-lg font-bold border border-slate-600 outline-none" />
                        </div>
                    )}
                </div>

                {(!showAnalysis || scheduleMode === 'scheduled') && (
                    <Button variant={showAnalysis ? 'secondary' : 'primary'} size="lg" onClick={() => setShowAnalysis(true)} className={`w-full mt-3 font-bold py-3 rounded-xl shadow-lg flex items-center justify-center gap-2 ${showAnalysis ? 'text-muted' : ''}`}>
                        {showAnalysis ? t('activities.updateAnalysis') : <><Play className="w-4 h-4 fill-current"/> {t('activities.analyze')}</>}
                    </Button>
                )}
            </Card>

            {showAnalysis && (
                <div className="animate-fade-in space-y-3">
                    <div className="flex items-center justify-between bg-slate-800/50 border border-slate-700/50 p-3 rounded-xl">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{scheduleMode === 'now' ? t('activities.currentConditions') : `${t('activities.forecast')} ${selectedTime}`}</span>
                        <div className="flex items-center gap-3 text-xs font-bold text-white">
                            <span className="flex items-center gap-1"><Thermometer size={14} className="text-orange-400"/> {forecastTemp}°</span>
                            <span className="flex items-center gap-1"><Wind size={14} className="text-blue-400"/> {forecastWind} km/h</span>
                            <span className={`${forecastInfo.color}`}>{forecastInfo.label}</span>
                        </div>
                    </div>

                    <Button variant="secondary" size="lg" onClick={() => { setEditingActivity(null); setIsCreating(true); }} className="w-full py-3 rounded-xl border border-dashed border-border-default text-muted text-sm font-bold hover:bg-slate-800/50 hover:border-primary/50 hover:text-primary flex items-center justify-center gap-2 animate-fade-in">
                        <Plus className="w-5 h-5" /> {t('activities.newActivity')}
                    </Button>

                    {allActivities.map((act) => {
                        const Icon = typeof act.icon === 'string' ? getIconComponent(act.icon) : act.icon;
                        const result = checkActivityRules(weatherData.rawHourly, startIndex, act.duration, act.rules, scheduleMode === 'now' ? {
                            interpolatedTemp: interpolatedTemp ?? undefined,
                            interpolatedFeelsLike: interpolatedFeelsLike ?? undefined
                        } : {});
                        const isExpanded = expandedId === act.id;
                        const isCustom = !PREDEFINED_ACTIVITIES.some(p => p.id === act.id);
                        const isFav = favorites.includes(act.id);
                        const isLimitReached = favorites.length >= 4;
                        const isButtonDisabled = !isFav && isLimitReached;

                        let colorClass = 'bg-emerald-500/10 border-emerald-500/50 text-emerald-300';
                        let iconBg = 'bg-emerald-500/20';
                        let StatusIcon = Check;
                        if (result.status === 'yellow') { colorClass = 'bg-yellow-500/10 border-yellow-500/50 text-yellow-300'; iconBg = 'bg-yellow-500/20'; StatusIcon = AlertTriangle; }
                        else if (result.status === 'red') { colorClass = 'bg-red-500/10 border-red-500/50 text-red-300'; iconBg = 'bg-red-500/20'; StatusIcon = XCircle; }
                        else if (result.status === 'gray') { colorClass = 'bg-slate-800/50 border-slate-700/50 text-slate-400'; iconBg = 'bg-slate-700'; StatusIcon = HelpCircle; }

                        const nextOp = (result.status !== 'green' && isExpanded) ? findRecommendation(act, startIndex) : null;
                                        const labelNext = scheduleMode === 'now' ? t('activities.bestNext48h') : t('activities.alternative24h');

                        const toggleExpand = () => {
                            setExpandedId(isExpanded ? null : act.id);
                            if (!isExpanded) setExpandedFactorsId(null);
                        };
                        const handleCardKeyDown = (e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                toggleExpand();
                            }
                        };
                        return (
                            <div
                                key={act.id}
                                ref={isExpanded ? expandedCardRef : null}
                                role="button"
                                tabIndex={0}
                                aria-label={isExpanded ? t('activities.collapseDetails', { name: getActivityDisplayLabel(act) }) : t('activities.expandDetails', { name: getActivityDisplayLabel(act) })}
                                onClick={toggleExpand}
                                onKeyDown={handleCardKeyDown}
                                className={`rounded-xl border transition-all duration-300 overflow-hidden cursor-pointer ${colorClass} ${isExpanded ? 'bg-opacity-20' : 'bg-opacity-10'}`}
                            >
                                <div className="p-4 flex items-center justify-between cursor-pointer">
                                    <div className="flex items-center gap-4">
                                        <div className={`p-2.5 rounded-full ${iconBg} backdrop-blur-sm`}><Icon className="w-5 h-5 fill-current bg-transparent" /></div>
                                        <div>
                                            <h3 className="font-bold text-white text-sm">
                                                {getActivityDisplayLabel(act)} <span className="opacity-60 font-normal">{getActivityDurationLabel(act)}</span>
                                            </h3>
                                            <div className="flex items-center gap-1.5 mt-0.5"><span className="text-xs font-bold opacity-90 uppercase tracking-wide">{result.message}</span></div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setAnalysisModalData({ activity: act, result }); }} className="p-1.5 rounded-lg bg-slate-800/50 hover:bg-primary/20 hover:text-primary" title={t('routes.viewFullAnalysis')} aria-label={t('routes.viewFullAnalysis')}>
                                            <Info size={16} />
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); if (!isButtonDisabled) onToggleFavorite(act.id); }} disabled={isButtonDisabled} className={`p-1.5 rounded-full ${isFav ? 'text-yellow-400 bg-yellow-400/10' : isButtonDisabled ? 'text-slate-700 cursor-not-allowed opacity-50' : 'text-slate-600 hover:text-slate-400'}`} title={t('activities.toggleFavorite')} aria-label={t('activities.toggleFavorite')}><Star size={18} fill={isFav ? "currentColor" : "none"} /></Button>
                                        {isCustom && (<><Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleEditClick(act); }} className="p-1.5 text-slate-500 hover:text-primary" title={t('activities.editActivity')} aria-label={t('activities.editActivity')}><Pencil size={16} /></Button><Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onDeleteActivity(act.id); }} className="p-1.5 text-slate-500 hover:text-danger" title={t('activities.deleteActivity')} aria-label={t('activities.deleteActivity')}><Trash2 size={16} /></Button></>)}
                                        {isExpanded ? <ChevronUp className="w-4 h-4 opacity-70" /> : <ChevronDown className="w-4 h-4 opacity-70" />}
                                    </div>
                                </div>
                                {isExpanded && (
                                    <div className="px-4 pb-4 pt-0 animate-fade-in border-t border-white/10 mt-1">
                                        <div className="mt-3 mb-3 text-center"><p className="text-xs text-slate-300 leading-relaxed italic">"{result.analysis}"</p></div>
                                        {(() => {
                                            const sorted = result.sortedFactors ?? [];
                                            const top4 = sorted.slice(0, 4);
                                            const hasMore = sorted.length > 4;
                                            const showAll = expandedFactorsId === act.id;
                                            const displayFactors = showAll ? sorted : top4;
                                            return (
                                                <>
                                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                                                    {displayFactors.map((f, i) => (
                                                        <FactorCard key={i} factor={f} size="sm" showLabel={true} />
                                                    ))}
                                                </div>
                                                {hasMore && !showAll && (
                                                    <Button variant="secondary" size="sm" onClick={(e) => { e.stopPropagation(); setExpandedFactorsId(act.id); }} className="w-full py-2 flex items-center justify-center gap-1 text-xs font-bold text-primary hover:text-primary-light border border-dashed border-border-default rounded-lg hover:border-primary/50 mb-3">
                                                        <ChevronRight size={14} /> {t('activities.seeMore')} ({sorted.length - 4})
                                                    </Button>
                                                )}
                                                {hasMore && showAll && (
                                                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setExpandedFactorsId(null); }} className="w-full py-1.5 text-xs font-bold text-slate-500 hover:text-slate-400 mb-3">↑ {t('common.back')}</Button>
                                                )}
                                                </>
                                            );
                                        })()}
                                        {result.status !== 'green' && (
                                            <div className="bg-slate-900/50 border border-slate-700/50 p-3 rounded-lg flex items-start gap-2">
                                                <Clock className="w-4 h-4 text-blue-300 shrink-0 mt-0.5" />
                                                <div><span className="block text-xs uppercase font-bold text-slate-500">{labelNext}</span><span className="text-xs font-bold text-blue-200">{nextOp || t('common.noData')}</span></div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* MODAL: Análisis completo (misma lógica que Rutas) */}
            {analysisModalData && (
                <ActivityAnalysisModal
                    ref={analysisModalRef}
                    activity={analysisModalData.activity}
                    result={analysisModalData.result}
                    onClose={() => setAnalysisModalData(null)}
                />
            )}

            {/* POPUP MODAL: Crear / Editar actividad */}
            {(isCreating || editingActivity) && (
                <div 
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
                    onClick={closeForm}
                >
                    <Card 
                        variant="default" 
                        padding="none" 
                        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl animate-fade-in"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <CreateActivityModal 
                            onClose={closeForm}
                            onSave={handleSave}
                            initialData={editingActivity}
                        />
                    </Card>
                </div>
            )}
        </div>
    );
};

export default ActivitiesTab;