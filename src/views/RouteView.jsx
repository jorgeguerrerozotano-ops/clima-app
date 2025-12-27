import React, { useState, useMemo, useRef, useEffect } from 'react';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import { 
    NavigationArrow, Clock, Calendar, 
    ArrowsDownUp, Motorcycle, Car, Bicycle, PersonSimpleWalk,
    MapPin as MapPinMarker
} from '@phosphor-icons/react';

import MapSelector from '../components/MapSelector';
import LocationSearchInput from '../components/LocationSearchInput'; 
import RouteFavorites from '../components/RouteFavorites';
import { formatStandardLocation } from '../utils/helpers';
import { useRouteWeather } from '../hooks/useRouteWeather';

const RouteView = ({ weatherData, onViewLocation }) => {
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
    const { calculateRoute, routeResult, loading, error, resetRoute } = useRouteWeather();
    const resultsRef = useRef(null);

    // Auto-scroll
    useEffect(() => {
        if (routeResult && resultsRef.current) {
            setTimeout(() => {
                resultsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 500);
        }
    }, [routeResult]);

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
        const loc = { lat: coords.lat, lon: coords.lon, name: "Punto Mapa", country: "" };
        try {
            const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.lat}&lon=${coords.lon}&addressdetails=1&accept-language=es`);
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
            const loc = { lat: p.coords.latitude, lon: p.coords.longitude, name: "Mi Ubicación" };
            try {
                const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${p.coords.latitude}&lon=${p.coords.longitude}&addressdetails=1&accept-language=es`);
                const rd = await r.json(); loc.name = formatStandardLocation(rd);
            } catch {}
            if(target === 'origin') { setSelectedOrigin(loc); setOriginQuery(loc.name); } else { setSelectedDest(loc); setDestQuery(loc.name); }
            resetRoute();
        });
    };

    const handleAnalyzeClick = () => {
        let depDate = new Date();
        if (departureType === 'scheduled') depDate = new Date(`${scheduleDate}T${scheduleTime}`);
        calculateRoute(selectedOrigin, selectedDest, routeMode, depDate);
    };

    const TransportOption = ({ id, label, icon: Icon }) => {
        const isActive = routeMode === id;
        return (
            <button onClick={() => { setRouteMode(id); resetRoute(); }} className="flex-1 relative group flex flex-col items-center justify-center py-2 rounded-xl outline-none">
                {isActive && <div className="absolute top-1 left-1/2 -translate-x-1/2 w-8 h-8 bg-blue-500/20 rounded-full blur-md animate-fade-in"></div>}
                <Icon size={24} weight={isActive ? "duotone" : "regular"} className={`relative z-10 mb-1 transition-all duration-300 ${isActive ? 'text-blue-400 drop-shadow-[0_0_6px_rgba(96,165,250,0.8)] scale-110' : 'text-slate-500 group-hover:text-slate-300 scale-100'}`} />
                <span className={`relative z-10 text-[9px] font-bold uppercase tracking-widest transition-all duration-300 ${isActive ? 'text-blue-300 opacity-100' : 'text-slate-500 opacity-70'}`}>{label}</span>
            </button>
        );
    };

    return (
        <div className="animate-fade-in pb-20 space-y-6">
            <MapSelector initialCenter={mapCenter} isOpen={showMapPicker} onConfirm={handleMapConfirm} onCancel={() => setShowMapPicker(false)} />
            
            <div className="glass-panel rounded-2xl p-5 border border-slate-700">
                <div className="mb-6">
                    <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 px-1">Lugares Frecuentes</h3>
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
                            placeholder="Ubicación de origen..."
                            initialValue={originQuery}
                            proximityCoords={weatherData?.location}
                            icon={MapPinMarker} iconColor="text-blue-400"
                            onSelect={(item) => { if(item) { setSelectedOrigin(item); setOriginQuery(item.name); } else { setSelectedOrigin(null); setOriginQuery(''); } resetRoute(); }}
                            onGPS={() => handleRouteGPS('origin')}
                            onMapClick={() => openMapFor('origin')}
                            minimal={true}
                        />
                    </div>

                    <div className="absolute right-8 top-1/2 -translate-y-1/2 z-[60]">
                        <button onClick={() => { const tempLoc = selectedOrigin; const tempQuery = originQuery; setSelectedOrigin(selectedDest); setOriginQuery(destQuery); setSelectedDest(tempLoc); setDestQuery(tempQuery); resetRoute(); }} className="p-1.5 bg-slate-800 border border-slate-600/50 rounded-full text-slate-400 hover:text-blue-400 hover:border-blue-500/50 shadow-lg active:rotate-180 transition-all">
                            <ArrowsDownUp size={16} />
                        </button>
                    </div>

                    <div className="relative z-[40]">
                        <LocationSearchInput 
                            placeholder="¿A dónde vas?"
                            initialValue={destQuery}
                            proximityCoords={selectedOrigin || weatherData?.location}
                            icon={NavigationArrow} iconColor="text-emerald-400"
                            onSelect={(item) => { if(item) { setSelectedDest(item); setDestQuery(item.name); } else { setSelectedDest(null); setDestQuery(''); } resetRoute(); }}
                            onGPS={() => handleRouteGPS('dest')}
                            onMapClick={() => openMapFor('dest')}
                            minimal={true}
                        />
                    </div>
                </div>

                <div className="relative z-10 mt-6">
                    <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 px-1">Medio de transporte</h3>
                    <div className="flex p-1 bg-slate-950/60 rounded-2xl border border-slate-800/80 shadow-inner">
                        <TransportOption id="moto" label="Moto" icon={Motorcycle} />
                        <TransportOption id="car" label="Coche" icon={Car} />
                        <TransportOption id="bicycle" label="Bici" icon={Bicycle} />
                        <TransportOption id="walk" label="Pie" icon={PersonSimpleWalk} />
                    </div>
                </div>

                <div className="space-y-4 pt-4 relative z-0">
                    <div className="flex gap-3 px-1">
                        <button onClick={() => { setDepartureType('now'); resetRoute(); }} className={`flex-1 flex justify-center items-center gap-2 py-3 rounded-xl text-xs font-bold transition-all border ${departureType === 'now' ? 'bg-blue-500/10 border-blue-500/50 text-blue-300 shadow-sm' : 'bg-transparent border-slate-700/50 text-slate-500 hover:border-slate-500'}`}>
                            <Clock size={16} weight={departureType === 'now' ? 'duotone' : 'regular'}/> Salir Ahora
                        </button>
                        <button onClick={() => { setDepartureType('scheduled'); resetRoute(); }} className={`flex-1 flex justify-center items-center gap-2 py-3 rounded-xl text-xs font-bold transition-all border ${departureType === 'scheduled' ? 'bg-blue-500/10 border-blue-500/50 text-blue-300 shadow-sm' : 'bg-transparent border-slate-700/50 text-slate-500 hover:border-slate-500'}`}>
                            <Calendar size={16} weight={departureType === 'scheduled' ? 'duotone' : 'regular'}/> Programar
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
                        {loading ? <NavigationArrow className="animate-spin" size={20}/> : <NavigationArrow size={20} weight="duotone" className="animate-pulse"/>}
                        {loading ? "Analizando..." : "ANALIZAR RUTA"}
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
                                <span className="text-[10px] uppercase text-slate-400 font-bold mb-1 group-hover:text-blue-400 flex items-center gap-1">Origen <ExternalLink size={8}/></span>
                                <span className="font-bold text-white text-sm line-clamp-1">{selectedOrigin.name.split(',')[0]}</span>
                                <span className="text-xl font-bold">{routeResult.originWeather.temp}</span>
                            </button>
                            <div className="flex-1 px-2 flex flex-col items-center">
                                <span className="text-[10px] text-slate-500 font-bold mb-1">{routeResult.dist} km</span>
                                <div className="w-full h-0.5 bg-slate-700 relative"><div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-slate-900 bg-blue-500 shadow-lg"></div></div>
                                <span className="text-xs font-bold text-white mt-1">~ {routeResult.time}</span>
                            </div>
                            <button onClick={() => onViewLocation && onViewLocation(selectedDest)} className="flex flex-col items-center w-1/3 group hover:bg-white/5 p-1 rounded-lg transition-colors cursor-pointer active:scale-95">
                                <span className="text-[10px] uppercase text-slate-400 font-bold mb-1 group-hover:text-blue-400 flex items-center gap-1">Destino <ExternalLink size={8}/></span>
                                <span className="font-bold text-white text-sm line-clamp-1">{selectedDest.name.split(',')[0]}</span>
                                <span className="text-xl font-bold">{routeResult.destWeather.temp}</span>
                            </button>
                        </div>

                        {/* LISTA DE SEGMENTOS (GRID 4X) */}
                        {['origin', 'mid', 'dest'].map(seg => {
                            const data = routeResult.segments[seg];
                            return (
                                <div key={seg} className={`p-4 rounded-xl border flex flex-col justify-between ${data.colorClass} mb-2 animate-fade-in`}>
                                    <div className="flex justify-between items-center mb-3 border-b border-white/10 pb-2">
                                        <span className="text-xs font-black uppercase tracking-wide opacity-90">{data.name} • {data.time}</span>
                                        <span className="text-[10px] font-bold uppercase tracking-widest">{data.message}</span>
                                    </div>
                                    
                                    {/* GRID 4 FACTORES */}
                                    <div className="grid grid-cols-4 gap-2">
                                        {data.factors.map((f, i) => {
                                            let fColor = 'text-emerald-400', fBg = 'bg-emerald-500/10 border-emerald-500/20';
                                            if (f.status === 'yellow') { fColor = 'text-yellow-400'; fBg = 'bg-yellow-500/10 border-yellow-500/20'; }
                                            if (f.status === 'red') { fColor = 'text-red-400'; fBg = 'bg-red-500/10 border-red-500/20'; }
                                            
                                            const Icon = f.icon;
                                            return (
                                                <div key={i} className={`flex flex-col items-center p-1.5 rounded-lg border ${fBg}`}>
                                                    <Icon size={14} className={`${fColor} mb-1`} />
                                                    <span className={`text-xs font-bold ${fColor}`}>{f.value}</span>
                                                    <span className="text-[9px] text-slate-400 uppercase font-bold hidden sm:block">{f.name}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};
export default RouteView;