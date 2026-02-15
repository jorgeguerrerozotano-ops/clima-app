import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ExternalLink, Info } from 'lucide-react';
import { getTransportIcon, getUIIcon } from '../utils/iconMap';

const ArrowUpDownIcon = getUIIcon('arrowUpDown');
const ClockIcon = getUIIcon('clock');
const CalendarIcon = getUIIcon('calendar');
const NavigationIcon = getUIIcon('navigation');

import MapSelector from '../components/MapSelector';
import RouteSegmentAnalysisModal from '../components/RouteSegmentAnalysisModal';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import FactorCard from '../components/ui/FactorCard';
import LocationSearchInput from '../components/LocationSearchInput';
import RouteFavorites from '../components/RouteFavorites';
import RouteMapView from '../components/RouteMapView';
import { resolveLocationFromCoords, getCurrentPositionWithName, getWeekDaysForSelector } from '../utils/helpers';
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
    const { calculateRoute, routeResult, loading, error, resetRoute, addWaypoint, updateWaypoint, removeWaypoint, smartSafeRoute, spatialRoute, applySpatialRoute, originalRouteResult, revertToOriginalRoute } = useRouteWeather();
    const resultsRef = useRef(null);
    const reportRef = useRef(null);
    const mapSectionRef = useRef(null);
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

    // Auto-scroll al mapa cuando hay ruta y estamos en pestaña mapa (mostrar mapa y barra inferior)
    useEffect(() => {
        if (routeResult && resultView === 'map' && mapSectionRef.current) {
            const t = setTimeout(() => {
                mapSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 600);
            return () => clearTimeout(t);
        }
    }, [routeResult, resultView]);

    // Auto-scroll al mapa cuando se detecta ruta alternativa (para que se vea el botón)
    useEffect(() => {
        if (spatialRoute != null && resultView === 'map' && mapSectionRef.current) {
            const t = setTimeout(() => {
                mapSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 300);
            return () => clearTimeout(t);
        }
    }, [spatialRoute, resultView]);

    // Inicializar origen desde ubicación actual cuando hay weatherData y aún no hay origen seleccionado
    useEffect(() => {
        if (weatherData?.location && !selectedOrigin && originQuery === '') {
            setSelectedOrigin(weatherData.location);
            setOriginQuery(weatherData.location.name ?? '');
        }
    }, [weatherData]);

    const weekDays = useMemo(() => getWeekDaysForSelector(t, i18n.language, 7), [t, i18n.language]);

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
        const loc = await resolveLocationFromCoords(coords.lat, coords.lon, t('location.pointMap'));
        const locObj = { lat: loc.lat, lon: loc.lon, name: loc.name, country: loc.country ?? '' };
        if (mapTarget === 'dest') { setSelectedDest(locObj); setDestQuery(locObj.name); }
        else { setSelectedOrigin(locObj); setOriginQuery(locObj.name); }
    };

    const handleRouteFavorite = (place) => {
        const loc = { lat: place.lat, lon: place.lon, name: place.name, displayName: place.address || place.name };
        if (!selectedDest) { setSelectedDest(loc); setDestQuery(loc.name); } 
        else if (!selectedOrigin) { setSelectedOrigin(loc); setOriginQuery(loc.name); } 
        else { setSelectedDest(loc); setDestQuery(loc.name); }
        resetRoute();
    };

    const handleRouteGPS = (target) => {
        getCurrentPositionWithName(t('location.myPosition'))
            .then((loc) => {
                const locObj = { lat: loc.lat, lon: loc.lon, name: loc.name, country: loc.country ?? '' };
                if (target === 'origin') { setSelectedOrigin(locObj); setOriginQuery(locObj.name); }
                else { setSelectedDest(locObj); setDestQuery(locObj.name); }
                resetRoute();
            })
            .catch(() => {});
    };

    const handleAnalyzeClick = () => {
        setResultView('map');
        let depDate = new Date();
        if (departureType === 'scheduled') depDate = new Date(`${scheduleDate}T${scheduleTime}`);
        calculateRoute(selectedOrigin, selectedDest, routeMode, depDate, { isScheduled: departureType === 'scheduled' });
    };

    const handleApplySpatialRoute = () => {
        setResultView('map');
        applySpatialRoute();
        setTimeout(() => mapSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 150);
    };

    const handleRevertToOriginalRoute = () => {
        revertToOriginalRoute();
        setTimeout(() => mapSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
    };

    const TransportOption = ({ id, label }) => {
        const Icon = getTransportIcon(id);
        const isActive = routeMode === id;
        return (
            <Button variant="ghost" onClick={() => { setRouteMode(id); resetRoute(); }} className="flex-1 relative group flex flex-col items-center justify-center py-2 rounded-xl outline-none rounded-xl">
                {isActive && <div className="absolute top-1 left-1/2 -translate-x-1/2 w-8 h-8 bg-primary/20 rounded-full blur-md animate-fade-in"></div>}
                <Icon size={24} strokeWidth={isActive ? 2.5 : 1.5} className={`relative z-10 mb-1 transition-all duration-300 ${isActive ? 'text-primary-light drop-shadow-[0_0_6px_rgba(96,165,250,0.8)] scale-110' : 'text-slate-500 group-hover:text-slate-300 scale-100'}`} />
                <span className={`relative z-10 text-xxxs font-bold uppercase tracking-widest transition-all duration-300 ${isActive ? 'text-primary-light opacity-100' : 'text-slate-500 opacity-70'}`}>{label}</span>
            </Button>
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
            
            <Card variant="glass" padding="sm" className="rounded-2xl p-5 border border-border-default">
                <div className="mb-6">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 px-1">{t('routes.frequentPlaces')}</h3>
                    <RouteFavorites onSelect={handleRouteFavorite} />
                </div>

                {error && (
                    <div className="mb-4 px-4 py-3 bg-slate-800/80 border-l-4 border-orange-500 rounded-r-xl flex items-start gap-3 animate-fade-in shadow-lg">
                        <AlertTriangle className="text-orange-500 shrink-0 mt-0.5" size={18} />
                        <div><p className="text-sm font-bold text-slate-200 leading-tight">{t('routes.somethingWrong')}</p><p className="text-xs text-slate-400 mt-1 leading-relaxed">{error}</p></div>
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
                        />
                    </div>

                    <div className="absolute right-8 top-1/2 -translate-y-1/2 z-[60]">
                        <Button variant="secondary" size="icon" onClick={() => { const tempLoc = selectedOrigin; const tempQuery = originQuery; setSelectedOrigin(selectedDest); setOriginQuery(destQuery); setSelectedDest(tempLoc); setDestQuery(tempQuery); resetRoute(); }} className="p-1.5 rounded-full border-slate-600/50 hover:text-primary hover:border-primary/50 shadow-lg active:rotate-180 transition-all" title={t('routes.swapOriginDest')} aria-label={t('routes.swapOriginDest')}>
                            <ArrowUpDownIcon size={16} />
                        </Button>
                    </div>

                    <div className="relative z-[40]">
                        <LocationSearchInput 
                            placeholder={t('location.destPlaceholder')}
                            initialValue={destQuery}
                            proximityCoords={selectedOrigin || weatherData?.location}
                            icon={getUIIcon('navigation')} iconColor="text-emerald-400"
                            onSelect={(item) => { if(item) { setSelectedDest(item); setDestQuery(item.name); } else { setSelectedDest(null); setDestQuery(''); } resetRoute(); }}
                            onGPS={() => handleRouteGPS('dest')}
                            onMapClick={() => openMapFor('dest')}
                        />
                    </div>
                </div>

                <div className="relative z-10 mt-6">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 px-1">{t('routes.transport')}</h3>
                    <div className="flex p-1 bg-slate-950/60 rounded-2xl border border-slate-800/80 shadow-inner">
                        <TransportOption id="moto" label={t('activities.moto')} />
                        <TransportOption id="car" label={t('routes.car')} />
                        <TransportOption id="bicycle" label={t('routes.bicycle')} />
                        <TransportOption id="walk" label={t('routes.walk')} />
                    </div>
                </div>

                <div className="space-y-4 pt-4 relative z-0">
                    <div className="flex gap-3 px-1">
                        <Button variant={departureType === 'now' ? 'primary' : 'ghost'} size="md" onClick={() => { setDepartureType('now'); resetRoute(); }} className={`flex-1 flex justify-center items-center gap-2 py-3 rounded-xl text-xs font-bold border ${departureType === 'now' ? 'bg-primary/10 border-primary/50 text-primary-light shadow-sm' : 'bg-transparent border-slate-700/50 text-slate-500 hover:border-slate-500'}`}>
                            <ClockIcon size={16} strokeWidth={departureType === 'now' ? 2.5 : 1.5}/> {t('routes.leaveNow')}
                        </Button>
                        <Button variant={departureType === 'scheduled' ? 'primary' : 'ghost'} size="md" onClick={() => { setDepartureType('scheduled'); resetRoute(); }} className={`flex-1 flex justify-center items-center gap-2 py-3 rounded-xl text-xs font-bold border ${departureType === 'scheduled' ? 'bg-primary/10 border-primary/50 text-primary-light shadow-sm' : 'bg-transparent border-slate-700/50 text-slate-500 hover:border-slate-500'}`}>
                            <CalendarIcon size={16} strokeWidth={departureType === 'scheduled' ? 2.5 : 1.5}/> {t('routes.schedule')}
                        </Button>
                    </div>
                    {departureType === 'scheduled' && (
                        <div className="p-3 animate-fade-in bg-slate-800/30 rounded-xl border border-slate-700/30">
                            <div className="flex overflow-x-auto gap-2 pb-2 no-scrollbar mb-2">
                                {weekDays.map((day, i) => (
                                    <Button key={i} variant="secondary" size="sm" onClick={() => { setScheduleDate(day.value); resetRoute(); }} className={`whitespace-nowrap px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors ${scheduleDate === day.value ? 'bg-success border-success text-white' : 'text-muted'}`}>{day.label}</Button>
                                ))}
                            </div>
                            <input type="time" value={scheduleTime} onChange={e => { setScheduleTime(e.target.value); resetRoute(); }} className="bg-slate-900 text-white text-center w-full py-2 rounded-lg font-bold border border-slate-700 outline-none focus:border-blue-500" />
                        </div>
                    )}
                    <Button variant="primary" size="lg" onClick={handleAnalyzeClick} disabled={loading || !selectedOrigin || !selectedDest} isLoading={loading} className={`w-full py-3.5 rounded-2xl shadow-lg shadow-primary/40 flex items-center justify-center gap-3 mt-2 ${(loading || !selectedOrigin || !selectedDest) ? 'opacity-50 cursor-not-allowed grayscale' : ''}`}>
                        {!loading && <NavigationIcon size={20} strokeWidth={2.5} className="animate-pulse"/>}
                        {loading ? t('routes.analyzing') : t('routes.analyzeRoute')}
                    </Button>
                </div>
            </Card>

            <div ref={resultsRef}>
                {routeResult && (
                    <Card variant="glass" padding="sm" className="mt-6 rounded-2xl border border-border-default animate-fade-in">
                        <h4 className="text-center text-xs font-bold text-blue-300 uppercase tracking-widest mb-4">{t('routes.analysis')}</h4>
                        
                        {/* RESUMEN RUTA */}
                        <div className="bg-slate-800/50 p-4 rounded-xl mb-4 flex justify-between items-center relative border border-white/5">
                            <Button variant="ghost" onClick={() => onViewLocation && onViewLocation(selectedOrigin)} className="flex flex-col items-center w-1/3 group hover:bg-white/5 p-1 rounded-lg transition-colors cursor-pointer active:scale-95">
                                <span className="text-xs uppercase text-muted font-bold mb-1 group-hover:text-primary flex items-center gap-1">{t('routes.origin')} <ExternalLink size={8}/></span>
                                <span className="font-bold text-white text-sm line-clamp-1">{selectedOrigin.name.split(',')[0]}</span>
                                <span className="text-xl font-bold">{routeResult.originWeather.temp}</span>
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => { setEditingWaypointIndex(0); setResultView('map'); }}
                                className="flex-1 px-2 flex flex-col items-center group hover:bg-white/5 rounded-lg py-2 transition-colors cursor-pointer active:scale-95"
                            >
                                <span className="text-xs text-slate-500 font-bold mb-1">{routeResult.dist} km</span>
                                <div className="w-full h-0.5 bg-slate-700 relative">
                                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-slate-900 bg-blue-500 shadow-lg group-hover:ring-2 group-hover:ring-blue-400/50"></div>
                                </div>
                                <span className="text-xs font-bold text-white mt-1">~ {routeResult.time}</span>
                                                <span className="text-xxxs text-primary font-bold mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {waypointCount ? `${waypointCount} ${waypointCount > 1 ? t('routes.intermediatePointsPlural') : t('routes.intermediatePoints')}` : t('routes.goToMap')}
                                </span>
                            </Button>
                            <Button variant="ghost" onClick={() => onViewLocation && onViewLocation(selectedDest)} className="flex flex-col items-center w-1/3 group hover:bg-white/5 p-1 rounded-lg transition-colors cursor-pointer active:scale-95">
                                <span className="text-xs uppercase text-muted font-bold mb-1 group-hover:text-primary flex items-center gap-1">{t('routes.dest')} <ExternalLink size={8}/></span>
                                <span className="font-bold text-white text-sm line-clamp-1">{selectedDest.name.split(',')[0]}</span>
                                <span className="text-xl font-bold">{routeResult.destWeather.temp}</span>
                            </Button>
                        </div>

                        {/* Recomendación de salir a otra hora (se mantiene); la ruta más segura espacial solo en el mapa */}
                        {smartSafeRoute?.type === 'time' && (
                            <div className="mb-3 px-3 py-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-200 text-sm font-bold flex items-center gap-2">
                                <ClockIcon className="w-4 h-4 shrink-0" />
                                {t('routes.smartSafeSuggestion', { time: smartSafeRoute.suggestedDepartureLabel })}
                            </div>
                        )}

                        {/* Tabs Informe | Mapa + contenido (ref para auto-scroll al mapa) */}
                        <div ref={mapSectionRef}>
                        <div ref={reportRef} className="flex flex-wrap items-center gap-2 mb-4">
                            <div className="flex rounded-xl bg-slate-800/50 p-1 border border-slate-700/50 flex-1 min-w-0">
                                <Button
                                    type="button"
                                    variant={resultView === 'modules' ? 'primary' : 'ghost'}
                                    size="sm"
                                    onClick={() => setResultView('modules')}
                                    className="flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider shadow"
                                >
                                    {t('routes.report')}
                                </Button>
                                <Button
                                    type="button"
                                    variant={resultView === 'map' ? 'primary' : 'ghost'}
                                    size="sm"
                                    onClick={() => setResultView('map')}
                                    className="flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider shadow"
                                >
                                    {t('routes.map')}
                                </Button>
                            </div>
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
                                                <span className="text-[9px] text-slate-500 font-bold">• {data.remainingKm} {t('routes.kmToDest')}</span>
                                            )}
                                        </span>
                                        <div className="flex items-center gap-2 flex-wrap justify-end">
                                            {isWaypoint && (
                                                <>
                                                    <Button type="button" variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setEditingWaypointIndex(wpIndex); setResultView('map'); }} className="text-xxxs font-bold text-primary hover:text-primary-light whitespace-nowrap py-0 px-0 min-w-0">{t('routes.editOnMap')}</Button>
                                                    {waypointCount > 0 && (
                                                        <Button type="button" variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); removeWaypoint(wpIndex); }} className="text-xxxs font-bold text-muted hover:text-danger whitespace-nowrap py-0 px-0 min-w-0">{t('routes.remove')}</Button>
                                                    )}
                                                </>
                                            )}
                                            <Button type="button" variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setAnalysisModalSegment(data); }} className="p-1.5 rounded-lg bg-slate-800/50 hover:bg-primary/20 text-primary hover:text-primary-light" title={t('routes.viewFullAnalysis')} aria-label={t('routes.viewFullAnalysis')}>
                                                <Info size={14} />
                                            </Button>
                                            <span className="text-xs font-bold uppercase tracking-widest">{data.message}</span>
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
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="md"
                                    onClick={addWaypoint}
                                    disabled={loading}
                                    className="w-full py-2.5 rounded-xl border border-dashed border-border-default text-muted hover:border-primary hover:text-primary hover:bg-primary/5 font-bold text-xs uppercase tracking-wider"
                                >
                                    {t('routes.addStop')}
                                </Button>
                            </div>
                        )}
                        {routeResult.segments.dest && (
                            <div className={`p-4 rounded-xl border flex flex-col justify-between ${routeResult.segments.dest.colorClass} mb-2 animate-fade-in`}>
                                <div className="flex justify-between items-center mb-3 border-b border-white/10 pb-2">
                                    <span className="text-xs font-black uppercase tracking-wide opacity-90">{routeResult.segments.dest.name} • {routeResult.segments.dest.time}</span>
                                    <div className="flex items-center gap-2">
                                        <Button type="button" variant="ghost" size="icon" onClick={() => setAnalysisModalSegment(routeResult.segments.dest)} className="p-1.5 rounded-lg bg-slate-800/50 hover:bg-primary/20 text-primary hover:text-primary-light" title={t('routes.viewFullAnalysis')} aria-label={t('routes.viewFullAnalysis')}>
                                            <Info size={14} />
                                        </Button>
                                        <span className="text-xs font-bold uppercase tracking-widest">{routeResult.segments.dest.message}</span>
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
                                spatialRoute={spatialRoute}
                                originalRouteResult={originalRouteResult}
                                onApplySpatialRoute={handleApplySpatialRoute}
                                onRevertToOriginalRoute={handleRevertToOriginalRoute}
                            />
                        )}
                        </div>
                    </Card>
                )}
            </div>
        </div>
    );
};
export default RouteView;