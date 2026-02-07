import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ExternalLink, Info, RefreshCw } from 'lucide-react';
import { getTransportIcon, getUIIcon } from '../utils/iconMap';

const ArrowUpDownIcon = getUIIcon('arrowUpDown');
const ClockIcon = getUIIcon('clock');
const CalendarIcon = getUIIcon('calendar');
const NavigationIcon = getUIIcon('navigation');

import MapSelector from '../components/MapSelector';
import RouteSegmentAnalysisModal from '../components/RouteSegmentAnalysisModal';
import FactorCard from '../components/ui/FactorCard';
import LocationSearchInput from '../components/LocationSearchInput';
import RouteFavorites from '../components/RouteFavorites';
import RouteMapView from '../components/RouteMapView';
import { formatStandardLocation, getNominatimHeaders } from '../utils/helpers';
import { useRouteWeather } from '../hooks/useRouteWeather';

const RouteView = ({ weatherData, onViewLocation }) => {
    const { t, i18n } = useTranslation();
    // ESTADOS UI LOCALES
    const [originQuery, setOriginQuery] = useState('');
    const [destQuery, setDestQuery] = useState('');
    const [selectedOrigin, setSelectedOrigin] = useState(null);
    const [selectedDest, setSelectedDest] = useState(null);
    
    const [routeMode, setRouteMode] = useState('moto');
    const [departureType, setDepartureType] = useState('now');
    const [scheduleDate, setScheduleDate] = useState(new Date().toISOString().split('T')[0]);
    const [scheduleTime, setScheduleTime] = useState(new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false}));
    
    const [showMapPicker, setShowMapPicker] = useState(false);
    const [mapTarget, setMapTarget] = useState('origin');
    const [mapCenter, setMapCenter] = useState({ lat: 40.4168, lon: -3.7038 });

    // ESTADO NEGOCIO
    const { calculateRoute, routeResult, loading, error, resetRoute, addWaypoint, updateWaypoint, removeWaypoint, cycleAlternative, resetWaypointsAndLoadAlternatives, hasAlternatives, alternativesCount, alternativeIndex } = useRouteWeather();
    const resultsRef = useRef(null);
    const reportRef = useRef(null);
    const [editingWaypointIndex, setEditingWaypointIndex] = useState(null);
    const [resultView, setResultView] = useState('map');
    const [analysisModalSegment, setAnalysisModalSegment] = useState(null);

    // Auto-scroll al resultado (sin cambiar pestaña: al confirmar en mapa se queda en mapa)
    useEffect(() => {
        if (routeResult && resultsRef.current) {
            setTimeout(() => {
                resultsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 500);
        }
    }, [routeResult]);

    // Auto-scroll al informe cuando se cambia a "Ver informe" (desde mapa o pestaña)
    useEffect(() => {
        if (resultView === 'modules' && reportRef.current && routeResult) {
            setTimeout(() => {
                reportRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 200);
        }
    }, [resultView, routeResult]);

    // Inicializar Origen
    useMemo(() => {
        if (weatherData && !selectedOrigin && originQuery === '') {
            setSelectedOrigin(weatherData.location);
            setOriginQuery(weatherData.location.name);
        }
    }, [weatherData]);

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

    // --- HANDLERS MEJORADOS ---
    
    const openMapFor = (target) => { 
        setMapTarget(target); 
        // LÓGICA DE CONTEXTO: Centrar mapa en la ubicación ya seleccionada
        if (target === 'origin' && selectedOrigin && selectedOrigin.lat) {
            setMapCenter({ lat: parseFloat(selectedOrigin.lat), lon: parseFloat(selectedOrigin.lon) });
        } else if (target === 'dest' && selectedDest && selectedDest.lat) {
            setMapCenter({ lat: parseFloat(selectedDest.lat), lon: parseFloat(selectedDest.lon) });
        } else if (weatherData) {
            setMapCenter({ lat: weatherData.location.lat, lon: weatherData.location.lon });
        }
        setShowMapPicker(true); 
    };
    
    const handleMapConfirm = async (coords) => {
        setShowMapPicker(false); 
        resetRoute();
        const loc = { lat: coords.lat, lon: coords.lon, name: t('location.pointMap'), country: "" };
        try {
            const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.lat}&lon=${coords.lon}&addressdetails=1`, { headers: getNominatimHeaders() });
            const rd = await r.json();
            loc.name = formatStandardLocation(rd); 
            loc.country = rd.address?.country;
        } catch(e) {}
        
        if(mapTarget === 'dest') { setSelectedDest(loc); setDestQuery(loc.name); } 
        else { setSelectedOrigin(loc); setOriginQuery(loc.name); }
    };

    const handleRouteFavorite = (place) => {
        const loc = { lat: place.lat, lon: place.lon, name: place.name, displayName: place.address || place.name };
        if (!selectedDest) { setSelectedDest(loc); setDestQuery(loc.name); } 
        else if (!selectedOrigin) { setSelectedOrigin(loc); setOriginQuery(loc.name); } 
        else { setSelectedDest(loc); setDestQuery(loc.name); }
        resetRoute();
    };

    const handleRouteGPS = (target) => {
        if(!navigator.geolocation) return;
        navigator.geolocation.getCurrentPosition(async p => {
            const loc = { lat: p.coords.latitude, lon: p.coords.longitude, name: t('location.myPosition') };
            try {
                const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${p.coords.latitude}&lon=${p.coords.longitude}&addressdetails=1`, { headers: getNominatimHeaders() });
                const rd = await r.json(); loc.name = formatStandardLocation(rd);
            } catch {}
            if(target === 'origin') { setSelectedOrigin(loc); setOriginQuery(loc.name); } else { setSelectedDest(loc); setDestQuery(loc.name); }
            resetRoute();
        });
    };

    const handleAnalyzeClick = () => {
        setResultView('map');
        let depDate = new Date();
        if (departureType === 'scheduled') depDate = new Date(`${scheduleDate}T${scheduleTime}`);
        calculateRoute(selectedOrigin, selectedDest, routeMode, depDate);
    };

    const TransportOption = ({ id, label }) => {
        const Icon = getTransportIcon(id);
        const isActive = routeMode === id;
        return (
            <button onClick={() => { setRouteMode(id); resetRoute(); }} className="flex-1 relative group flex flex-col items-center justify-center py-2 rounded-xl outline-none">
                {isActive && <div className="absolute top-1 left-1/2 -translate-x-1/2 w-8 h-8 bg-blue-500/20 rounded-full blur-md animate-fade-in"></div>}
                <Icon size={24} strokeWidth={isActive ? 2.5 : 1.5} className={`relative z-10 mb-1 transition-all duration-300 ${isActive ? 'text-blue-400 drop-shadow-[0_0_6px_rgba(96,165,250,0.8)] scale-110' : 'text-slate-500 group-hover:text-slate-300 scale-100'}`} />
                <span className={`relative z-10 text-[9px] font-bold uppercase tracking-widest transition-all duration-300 ${isActive ? 'text-blue-300 opacity-100' : 'text-slate-500 opacity-70'}`}>{label}</span>
            </button>
        );
    };

    const segmentKeys = routeResult
        ? (routeResult.waypoints?.length ? ['origin', ...routeResult.waypoints.map((_, i) => 'wp' + i), 'dest'] : ['origin', 'mid', 'dest'])
        : [];
    const waypointCount = routeResult?.waypoints?.length ?? 0;
    const canAddWaypoint = waypointCount < 3;

    const handleWaypointConfirm = (idx, lat, lon) => {
        updateWaypoint(idx, lat, lon);
        setEditingWaypointIndex(null);
    };

    const handleViewReportFromMap = () => {
        setResultView('modules');
    };

    return (
        <div className="animate-fade-in pb-20 space-y-6">
            <MapSelector initialCenter={mapCenter} isOpen={showMapPicker} onConfirm={handleMapConfirm} onCancel={() => setShowMapPicker(false)} />
            
            <div className="glass-panel rounded-2xl p-5 border border-slate-700">
                <div className="mb-6">
                    <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 px-1">{t('routes.frequentPlaces')}</h3>
                    <RouteFavorites onSelect={handleRouteFavorite} />
                </div>

                {error && (
                    <div className="mb-4 px-4 py-3 bg-slate-800/80 border-l-4 border-orange-500 rounded-r-xl flex items-start gap-3 animate-fade-in shadow-lg">
                        <AlertTriangle className="text-orange-500 shrink-0 mt-0.5" size={18} />
                        <div><p className="text-sm font-bold text-slate-200 leading-tight">Ups, algo no cuadra</p><p className="text-xs text-slate-400 mt-1 leading-relaxed">{error}</p></div>
                    </div>
                )}

                <div className="relative space-y-3">
                    <div className="absolute left-[1.6rem] top-8 bottom-8 w-0.5 bg-gradient-to-b from-blue-500/50 to-emerald-500/30 z-0"></div>

                    <div className="relative z-[50]">
                        <LocationSearchInput 
                            placeholder={t('location.originPlaceholder')}
                            initialValue={originQuery}
                            proximityCoords={weatherData?.location}
                            icon={getUIIcon('mapPin')} iconColor="text-blue-400"
                            onSelect={(item) => { if(item) { setSelectedOrigin(item); setOriginQuery(item.name); } else { setSelectedOrigin(null); setOriginQuery(''); } resetRoute(); }}
                            onGPS={() => handleRouteGPS('origin')}
                            onMapClick={() => openMapFor('origin')}
                            minimal={true}
                        />
                    </div>

                    <div className="absolute right-8 top-1/2 -translate-y-1/2 z-[60]">
                        <button onClick={() => { const tempLoc = selectedOrigin; const tempQuery = originQuery; setSelectedOrigin(selectedDest); setOriginQuery(destQuery); setSelectedDest(tempLoc); setDestQuery(tempQuery); resetRoute(); }} className="p-1.5 bg-slate-800 border border-slate-600/50 rounded-full text-slate-400 hover:text-blue-400 hover:border-blue-500/50 shadow-lg active:rotate-180 transition-all">
                            <ArrowUpDownIcon size={16} />
                        </button>
                    </div>

                    <div className="relative z-[40]">
                        <LocationSearchInput 
                            placeholder="¿A dónde vas?"
                            initialValue={destQuery}
                            proximityCoords={selectedOrigin || weatherData?.location}
                            icon={getUIIcon('navigation')} iconColor="text-emerald-400"
                            onSelect={(item) => { if(item) { setSelectedDest(item); setDestQuery(item.name); } else { setSelectedDest(null); setDestQuery(''); } resetRoute(); }}
                            onGPS={() => handleRouteGPS('dest')}
                            onMapClick={() => openMapFor('dest')}
                            minimal={true}
                        />
                    </div>
                </div>

                <div className="relative z-10 mt-6">
                    <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 px-1">{t('routes.transport')}</h3>
                    <div className="flex p-1 bg-slate-950/60 rounded-2xl border border-slate-800/80 shadow-inner">
                        <TransportOption id="moto" label={t('activities.moto')} />
                        <TransportOption id="car" label={t('routes.car')} />
                        <TransportOption id="bicycle" label={t('routes.bicycle')} />
                        <TransportOption id="walk" label={t('routes.walk')} />
                    </div>
                </div>

                <div className="space-y-4 pt-4 relative z-0">
                    <div className="flex gap-3 px-1">
                        <button onClick={() => { setDepartureType('now'); resetRoute(); }} className={`flex-1 flex justify-center items-center gap-2 py-3 rounded-xl text-xs font-bold transition-all border ${departureType === 'now' ? 'bg-blue-500/10 border-blue-500/50 text-blue-300 shadow-sm' : 'bg-transparent border-slate-700/50 text-slate-500 hover:border-slate-500'}`}>
                            <ClockIcon size={16} strokeWidth={departureType === 'now' ? 2.5 : 1.5}/> {t('routes.leaveNow')}
                        </button>
                        <button onClick={() => { setDepartureType('scheduled'); resetRoute(); }} className={`flex-1 flex justify-center items-center gap-2 py-3 rounded-xl text-xs font-bold transition-all border ${departureType === 'scheduled' ? 'bg-blue-500/10 border-blue-500/50 text-blue-300 shadow-sm' : 'bg-transparent border-slate-700/50 text-slate-500 hover:border-slate-500'}`}>
                            <CalendarIcon size={16} strokeWidth={departureType === 'scheduled' ? 2.5 : 1.5}/> Programar
                        </button>
                    </div>
                    {departureType === 'scheduled' && (
                        <div className="p-3 animate-fade-in bg-slate-800/30 rounded-xl border border-slate-700/30">
                            <div className="flex overflow-x-auto gap-2 pb-2 no-scrollbar mb-2">
                                {weekDays.map((day, i) => (
                                    <button key={i} onClick={() => { setScheduleDate(day.value); resetRoute(); }} className={`whitespace-nowrap px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors ${scheduleDate === day.value ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>{day.label}</button>
                                ))}
                            </div>
                            <input type="time" value={scheduleTime} onChange={e => { setScheduleTime(e.target.value); resetRoute(); }} className="bg-slate-900 text-white text-center w-full py-2 rounded-lg font-bold border border-slate-700 outline-none focus:border-blue-500" />
                        </div>
                    )}
                    <button onClick={handleAnalyzeClick} disabled={loading || !selectedOrigin || !selectedDest} className={`w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-blue-900/40 flex items-center justify-center gap-3 transition-all active:scale-[0.98] mt-2 ${(loading || !selectedOrigin || !selectedDest) ? 'opacity-50 cursor-not-allowed grayscale' : ''}`}>
                        {loading ? <NavigationIcon className="animate-spin" size={20}/> : <NavigationIcon size={20} strokeWidth={2.5} className="animate-pulse"/>}
                        {loading ? t('routes.analyzing') : t('routes.analyzeRoute')}
                    </button>
                </div>
            </div>

            <div ref={resultsRef}>
                {routeResult && (
                    <div className="glass-panel mt-6 p-4 rounded-2xl border border-slate-700 animate-fade-in">
                        <h4 className="text-center text-[10px] font-bold text-blue-300 uppercase tracking-widest mb-4">Análisis del trayecto</h4>
                        
                        {/* RESUMEN RUTA */}
                        <div className="bg-slate-800/50 p-4 rounded-xl mb-4 flex justify-between items-center relative border border-white/5">
                            <button onClick={() => onViewLocation && onViewLocation(selectedOrigin)} className="flex flex-col items-center w-1/3 group hover:bg-white/5 p-1 rounded-lg transition-colors cursor-pointer active:scale-95">
                                <span className="text-[10px] uppercase text-slate-400 font-bold mb-1 group-hover:text-blue-400 flex items-center gap-1">{t('routes.origin')} <ExternalLink size={8}/></span>
                                <span className="font-bold text-white text-sm line-clamp-1">{selectedOrigin.name.split(',')[0]}</span>
                                <span className="text-xl font-bold">{routeResult.originWeather.temp}</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => { setEditingWaypointIndex(0); setResultView('map'); }}
                                className="flex-1 px-2 flex flex-col items-center group hover:bg-white/5 rounded-lg py-2 transition-colors cursor-pointer active:scale-95"
                            >
                                <span className="text-[10px] text-slate-500 font-bold mb-1">{routeResult.dist} km</span>
                                <div className="w-full h-0.5 bg-slate-700 relative">
                                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-slate-900 bg-blue-500 shadow-lg group-hover:ring-2 group-hover:ring-blue-400/50"></div>
                                </div>
                                <span className="text-xs font-bold text-white mt-1">~ {routeResult.time}</span>
                                                <span className="text-[9px] text-blue-400 font-bold mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {waypointCount ? `${waypointCount} ${waypointCount > 1 ? t('routes.intermediatePointsPlural') : t('routes.intermediatePoints')}` : t('routes.goToMap')}
                                </span>
                            </button>
                            <button onClick={() => onViewLocation && onViewLocation(selectedDest)} className="flex flex-col items-center w-1/3 group hover:bg-white/5 p-1 rounded-lg transition-colors cursor-pointer active:scale-95">
                                <span className="text-[10px] uppercase text-slate-400 font-bold mb-1 group-hover:text-blue-400 flex items-center gap-1">Destino <ExternalLink size={8}/></span>
                                <span className="font-bold text-white text-sm line-clamp-1">{selectedDest.name.split(',')[0]}</span>
                                <span className="text-xl font-bold">{routeResult.destWeather.temp}</span>
                            </button>
                        </div>

                        {/* Tabs Informe | Mapa + Ruta alternativa */}
                        <div ref={reportRef} className="flex flex-wrap items-center gap-2 mb-4">
                            <div className="flex rounded-xl bg-slate-800/50 p-1 border border-slate-700/50 flex-1 min-w-0">
                                <button
                                    type="button"
                                    onClick={() => setResultView('modules')}
                                    className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${resultView === 'modules' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                                >
                                    {t('routes.report')}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setResultView('map')}
                                    className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${resultView === 'map' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                                >
                                    {t('routes.map')}
                                </button>
                            </div>
                            <button
                                type="button"
                                onClick={waypointCount > 0 ? resetWaypointsAndLoadAlternatives : cycleAlternative}
                                disabled={waypointCount > 0 ? loading : !hasAlternatives}
                                className={`flex items-center gap-2 px-3 py-2 rounded-xl border shrink-0 text-xs font-bold uppercase tracking-wider transition-colors ${hasAlternatives || waypointCount > 0 ? 'border-slate-600 bg-slate-800/50 text-slate-300 hover:bg-blue-500/20 hover:border-blue-500/50 hover:text-blue-300' : 'border-slate-700 bg-slate-800/30 text-slate-500'}`}
                                title={waypointCount > 0 ? t('routes.alternativeRoute') : (hasAlternatives ? t('routes.alternativeRoute') : `${t('routes.alternativeRoute')} (1/1)`)}
                            >
                                <RefreshCw size={14} strokeWidth={2.5} />
                                {waypointCount > 0 ? t('routes.alternativeRoute') : (hasAlternatives ? `${t('routes.alternativeRoute')} (${alternativeIndex + 1}/${alternativesCount})` : `${t('routes.alternativeRoute')} (1/1)`)}
                            </button>
                        </div>

                        {resultView === 'modules' && (
                        <>
                        {/* LISTA DE SEGMENTOS: origen + paradas, luego botón Añadir parada, luego destino */}
                        {segmentKeys.filter(seg => seg !== 'dest').map(seg => {
                            const data = routeResult.segments[seg];
                            if (!data) return null;
                            const isWaypoint = seg === 'mid' || seg.startsWith('wp');
                            const wpIndex = seg === 'mid' ? 0 : seg.startsWith('wp') ? parseInt(seg.replace('wp', ''), 10) : -1;
                            return (
                                <div key={seg} className={`p-4 rounded-xl flex flex-col justify-between ${data.colorClass} mb-2 animate-fade-in ${isWaypoint ? 'border-2 border-dashed border-blue-500/70' : 'border border-solid'}`}>
                                    <div className="flex justify-between items-center mb-3 border-b border-white/10 pb-2">
                                        <span className="text-xs font-black uppercase tracking-wide opacity-90 flex items-center gap-2">
                                            {data.name} • {data.time}
                                            {data.remainingKm != null && data.remainingKm > 0 && (
                                                <span className="text-[9px] text-slate-500 font-bold">• {data.remainingKm} km al destino</span>
                                            )}
                                        </span>
                                        <div className="flex items-center gap-2 flex-wrap justify-end">
                                            {isWaypoint && (
                                                <>
                                                    <button type="button" onClick={(e) => { e.stopPropagation(); setEditingWaypointIndex(wpIndex); setResultView('map'); }} className="text-[9px] font-bold text-blue-400 hover:text-blue-300 whitespace-nowrap">{t('routes.editOnMap')}</button>
                                                    {waypointCount > 0 && (
                                                        <button type="button" onClick={(e) => { e.stopPropagation(); removeWaypoint(wpIndex); }} className="text-[9px] font-bold text-slate-400 hover:text-red-400 whitespace-nowrap">{t('routes.remove')}</button>
                                                    )}
                                                </>
                                            )}
                                            <button type="button" onClick={(e) => { e.stopPropagation(); setAnalysisModalSegment(data); }} className="p-1.5 rounded-lg bg-slate-800/50 hover:bg-blue-500/20 text-blue-400 hover:text-blue-300 transition-colors" title={t('routes.viewFullAnalysis')}>
                                                <Info size={14} />
                                            </button>
                                            <span className="text-[10px] font-bold uppercase tracking-widest">{data.message}</span>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-4 gap-2">
                                        {(data.sortedFactors ?? []).slice(0, 4).map((f, i) => (
                                            <FactorCard key={i} factor={f} size="sm" showLabel={true} />
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                        {canAddWaypoint && (
                            <div className="mb-4">
                                <button
                                    type="button"
                                    onClick={addWaypoint}
                                    disabled={loading}
                                    className="w-full py-2.5 rounded-xl border border-dashed border-slate-600 text-slate-400 hover:border-blue-500 hover:text-blue-400 hover:bg-blue-500/5 font-bold text-xs uppercase tracking-wider transition-colors disabled:opacity-50"
                                >
                                    {t('routes.addStop')}
                                </button>
                            </div>
                        )}
                        {routeResult.segments.dest && (
                            <div className={`p-4 rounded-xl border flex flex-col justify-between ${routeResult.segments.dest.colorClass} mb-2 animate-fade-in`}>
                                <div className="flex justify-between items-center mb-3 border-b border-white/10 pb-2">
                                    <span className="text-xs font-black uppercase tracking-wide opacity-90">{routeResult.segments.dest.name} • {routeResult.segments.dest.time}</span>
                                    <div className="flex items-center gap-2">
                                        <button type="button" onClick={() => setAnalysisModalSegment(routeResult.segments.dest)} className="p-1.5 rounded-lg bg-slate-800/50 hover:bg-blue-500/20 text-blue-400 hover:text-blue-300 transition-colors" title={t('routes.viewFullAnalysis')}>
                                            <Info size={14} />
                                        </button>
                                        <span className="text-[10px] font-bold uppercase tracking-widest">{routeResult.segments.dest.message}</span>
                                    </div>
                                </div>
                                <div className="grid grid-cols-4 gap-2">
                                    {(routeResult.segments.dest.sortedFactors ?? []).slice(0, 4).map((f, i) => (
                                        <FactorCard key={i} factor={f} size="sm" showLabel={true} />
                                    ))}
                                </div>
                            </div>
                        )}
                        </>
                        )}

                        {analysisModalSegment && (
                            <RouteSegmentAnalysisModal segment={analysisModalSegment} onClose={() => setAnalysisModalSegment(null)} />
                        )}

                        {resultView === 'map' && (
                            <RouteMapView
                                routeResult={routeResult}
                                onAddWaypoint={addWaypoint}
                                onEditWaypoint={setEditingWaypointIndex}
                                onUpdateWaypoint={handleWaypointConfirm}
                                onCancelEdit={() => setEditingWaypointIndex(null)}
                                onViewReport={handleViewReportFromMap}
                                editingWaypointIndex={editingWaypointIndex}
                                loading={loading}
                                canAddWaypoint={canAddWaypoint}
                            />
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
export default RouteView;