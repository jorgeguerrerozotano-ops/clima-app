import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, X, Loader2, Locate, CornerDownRight } from 'lucide-react'; 
import { getDistanceFromLatLonInKm, formatStandardLocation } from '../utils/helpers';
// Importamos iconos de Phosphor para usarlos si no nos pasan uno específico
import { Crosshair, MapTrifold } from '@phosphor-icons/react';

const LocationSearchInput = ({ 
    placeholder = "Buscar...", 
    onSelect, 
    onGPS, 
    onMapClick, 
    initialValue = "", 
    proximityCoords = null,
    // Nuevas props visuales para integrar el diseño aquí dentro
    icon: LeadingIcon = Search, 
    iconColor = "text-slate-400"
}) => {
    const [query, setQuery] = useState(initialValue);
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef(null);

    // Sincronizar valor inicial
    useEffect(() => { if (initialValue !== query) setQuery(initialValue); }, [initialValue]);

    // Cerrar al hacer click fuera
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setIsOpen(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // ... (Lógica de formateo y búsqueda API se mantiene igual para ahorrar espacio visual, 
    // pero asegúrate de mantenerla completa como en tu archivo original) ...
    const formatForList = (item) => {
        const a = item.address;
        let main = item.name || a.road || a.pedestrian;
        if (!main && (a.house_number)) main = `${a.road} ${a.house_number}`;
        if (!main) main = a.neighbourhood || a.suburb || a.city_district || a.city || a.town;
        const cleanContext = formatStandardLocation(item);
        const sub = cleanContext.startsWith(main) ? cleanContext.replace(main + ", ", "") : cleanContext;
        return { mainText: main, subText: sub, original: item };
    };

    useEffect(() => {
        const timeoutId = setTimeout(async () => {
            if (!query || query.length < 3) { setResults([]); return; }
            if (!isOpen) return; // Solo buscamos si el usuario está interactuando
            
            setLoading(true);
            try {
                let url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=8&addressdetails=1&accept-language=es`;
                const res = await fetch(url);
                const data = await res.json();
                
                let formatted = data.map(item => ({ 
                    ...formatForList(item), 
                    lat: parseFloat(item.lat), 
                    lon: parseFloat(item.lon), 
                    rawName: item.display_name, 
                    distVal: Infinity, 
                    distTxt: null 
                }));

                if (proximityCoords && proximityCoords.lat) {
                    formatted.forEach(item => {
                        const d = getDistanceFromLatLonInKm(proximityCoords.lat, proximityCoords.lon, item.lat, item.lon);
                        item.distVal = d;
                        item.distTxt = d < 1 ? `${Math.round(d * 1000)} m` : `${Math.round(d)} km`;
                    });
                    formatted.sort((a, b) => a.distVal - b.distVal);
                }

                // Filtrar duplicados
                const uniqueResults = []; const seen = new Set();
                formatted.forEach(item => { const key = item.mainText + item.subText; if (!seen.has(key)) { seen.add(key); uniqueResults.push(item); } });
                
                setResults(uniqueResults.slice(0, 5));
            } catch (e) { console.error(e); setResults([]); } 
            finally { setLoading(false); }
        }, 300); 
        return () => clearTimeout(timeoutId);
    }, [query, isOpen, proximityCoords]);

    const handleSelect = (item) => {
        const cleanName = formatStandardLocation(item.original);
        setQuery(cleanName); setIsOpen(false);
        onSelect({ name: cleanName, displayName: cleanName, lat: item.lat, lon: item.lon, country: item.original.address?.country || "" });
    };

    return (
        // CONTENEDOR PRINCIPAL: Este es ahora "La Barra" visualmente
        <div className="relative w-full group/input" ref={wrapperRef}>
            <div className={`
                relative flex items-center rounded-2xl bg-slate-800/40 border border-slate-700/50 
                focus-within:border-blue-500/50 focus-within:bg-slate-800/60 transition-all h-[54px]
            `}>
                {/* 1. ICONO IZQUIERDA (Pasado por props) */}
                <div className={`pl-4 pr-3 ${iconColor} transition-colors z-10 pointer-events-none flex items-center h-full`}>
                    <LeadingIcon size={20} weight="duotone" />
                </div>

                {/* 2. INPUT REAL (Transparente, llena el hueco) */}
                <div className="flex-1 h-full relative">
                    <input 
                        type="text" 
                        value={query} 
                        onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }} 
                        onClick={() => setIsOpen(true)} 
                        placeholder={placeholder} 
                        className="w-full h-full bg-transparent border-none text-white font-medium placeholder-slate-500 focus:ring-0 outline-none p-0 text-base"
                        autoComplete="off"
                    />
                     {/* LOADER O 'X' (Absoluto dentro del área del input) */}
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center pr-2">
                        {loading ? (
                            <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                        ) : query ? (
                            <button onClick={() => { setQuery(''); onSelect(null); }} className="p-1 hover:bg-slate-700 rounded-full text-slate-400 transition-colors">
                                <X size={14} />
                            </button>
                        ) : null}
                    </div>
                </div>

                {/* 3. BOTONES DERECHA (Integrados visualmente) */}
                <div className="flex items-center pr-2 gap-0.5 h-full">
                    {/* Separador vertical */}
                    <div className="h-5 w-px bg-slate-700/50 mx-1"></div>
                    
                    {onGPS && (
                        <button onClick={onGPS} className="p-2 text-slate-400 hover:text-blue-400 transition-colors rounded-lg hover:bg-slate-700/30" title="Usar mi ubicación">
                            <Crosshair size={20} />
                        </button>
                    )}
                    {onMapClick && (
                        <button onClick={onMapClick} className="p-2 text-slate-400 hover:text-blue-400 transition-colors rounded-lg hover:bg-slate-700/30" title="Seleccionar en mapa">
                            <MapTrifold size={20} />
                        </button>
                    )}
                </div>
            </div>

            {/* 4. DESPLEGABLE DE RESULTADOS (Anclado al contenedor padre) */}
            {isOpen && results.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1.5 bg-slate-900 border border-slate-700 rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.8)] z-[100] overflow-hidden animate-fade-in max-h-60 overflow-y-auto custom-scrollbar ring-1 ring-white/10">
                    {results.map((item, idx) => (
                        <button 
                            key={idx} 
                            onClick={() => handleSelect(item)} 
                            className="w-full text-left px-4 py-3 hover:bg-slate-800 border-b border-slate-800/50 last:border-0 transition-colors flex items-center gap-3 group"
                        >
                            <div className="shrink-0 mt-0.5 bg-slate-800 p-1.5 rounded-lg group-hover:bg-slate-700 transition-colors">
                                <MapPin className="w-4 h-4 text-slate-400 group-hover:text-blue-400 transition-colors" />
                            </div>
                            <div className="flex-grow overflow-hidden min-w-0">
                                <div className="flex justify-between items-baseline gap-2">
                                    <span className="text-sm font-bold text-slate-200 group-hover:text-white truncate">{item.mainText}</span>
                                    {item.distTxt && (
                                        <span className="text-[10px] font-bold text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded-md whitespace-nowrap shrink-0 flex items-center gap-1">
                                            <CornerDownRight size={10} /> {item.distTxt}
                                        </span>
                                    )}
                                </div>
                                <div className="text-[10px] text-slate-500 truncate group-hover:text-slate-400">{item.subText}</div>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default LocationSearchInput;