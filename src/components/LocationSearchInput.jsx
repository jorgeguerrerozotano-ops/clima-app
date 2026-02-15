import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Search, MapPin, X, Loader2, CornerDownRight } from 'lucide-react'; 
import { getDistanceFromLatLonInKm, formatStandardLocation, formatForList, searchLocationNominatim, searchLocationORS } from '../utils/helpers';

// Cambiar a 'ors' para usar OpenRouteService como proveedor principal (mejor calidad, consume cuota).
const DEFAULT_GEOCODER = 'nominatim';
import { getUIIcon } from '../utils/iconMap';
import Button from './ui/Button';
import Card from './ui/Card';

const CrosshairIcon = getUIIcon('crosshair');
const MapIcon = getUIIcon('map');

const LocationSearchInput = ({ 
    placeholder, 
    onSelect, 
    onGPS, 
    onMapClick, 
    initialValue = "", 
    proximityCoords = null,
    // Nuevas props visuales para integrar el diseño aquí dentro
    icon: LeadingIcon = Search, 
    iconColor = "text-slate-400"
}) => {
    const { t } = useTranslation();
    const [query, setQuery] = useState(initialValue);
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [dropdownRect, setDropdownRect] = useState({ top: 0, left: 0, width: 0 });
    const wrapperRef = useRef(null);
    const dropdownRef = useRef(null);

    // Calcular posición del dropdown para Portal (evita clipping por overflow de padres)
    const updateDropdownPosition = () => {
        if (wrapperRef.current && isOpen) {
            const rect = wrapperRef.current.getBoundingClientRect();
            setDropdownRect({
                top: rect.bottom + 6,
                left: rect.left,
                width: rect.width
            });
        }
    };

    useLayoutEffect(() => {
        if (isOpen && results.length > 0 && wrapperRef.current) {
            updateDropdownPosition();
            const ro = new ResizeObserver(updateDropdownPosition);
            ro.observe(wrapperRef.current);
            const handleScrollOrResize = () => requestAnimationFrame(updateDropdownPosition);
            window.addEventListener('scroll', handleScrollOrResize, true);
            window.addEventListener('resize', handleScrollOrResize);
            return () => {
                ro.disconnect();
                window.removeEventListener('scroll', handleScrollOrResize, true);
                window.removeEventListener('resize', handleScrollOrResize);
            };
        }
    }, [isOpen, results.length]);

    // Sincronizar valor inicial
    useEffect(() => { if (initialValue !== query) setQuery(initialValue); }, [initialValue]);

    // Cerrar al hacer click fuera (incluir dropdown en portal)
    useEffect(() => {
        const handleClickOutside = (event) => {
            const inWrapper = wrapperRef.current?.contains(event.target);
            const inDropdown = dropdownRef.current?.contains(event.target);
            if (!inWrapper && !inDropdown) setIsOpen(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Debounce 800ms + AbortController: cancelar peticiones si el usuario sigue escribiendo o el componente se desmonta
    const DEBOUNCE_MS = 800;

    useEffect(() => {
        const abortController = new AbortController();
        const signal = abortController.signal;

        const timeoutId = setTimeout(async () => {
            if (!query || query.length < 3) { setResults([]); return; }
            if (!isOpen) return;

            setLoading(true);
            let data = [];
            const useORSFirst = DEFAULT_GEOCODER === 'ors' && import.meta.env.VITE_ORS_API_KEY;
            const searchOpts = { limit: 8, signal };

            if (useORSFirst) {
                try {
                    data = await searchLocationORS(query, searchOpts);
                } catch (e) {
                    if (e.name === 'AbortError') return;
                    if (import.meta.env.DEV) console.warn('ORS error:', e);
                }
                if (signal.aborted) return;
                if (data.length === 0) {
                    try {
                        data = await searchLocationNominatim(query, searchOpts);
                } catch (e) {
                    if (e.name === 'AbortError') return;
                    if (import.meta.env.DEV) console.warn('Nominatim fallback error:', e);
                }
                }
            } else {
                try {
                    data = await searchLocationNominatim(query, searchOpts);
                } catch (e) {
                    if (e.name === 'AbortError') return;
                    if (import.meta.env.DEV) console.warn('Nominatim error:', e);
                }
                if (signal.aborted) return;
                if (data.length === 0 && import.meta.env.VITE_ORS_API_KEY) {
                    try {
                        data = await searchLocationORS(query, searchOpts);
                    } catch (orsErr) {
                        if (orsErr.name === 'AbortError') return;
                        console.warn('ORS fallback error:', orsErr);
                    }
                }
            }

            if (signal.aborted) return;

            try {
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

                const uniqueResults = [];
                const seen = new Set();
                formatted.forEach(item => {
                    const key = item.mainText + item.subText;
                    if (!seen.has(key)) { seen.add(key); uniqueResults.push(item); }
                });

                setResults(uniqueResults.slice(0, 5));
            } catch (e) {
                if (e.name === 'AbortError') return;
                if (import.meta.env.DEV) console.error(e);
                setResults([]);
            } finally {
                if (!signal.aborted) setLoading(false);
            }
        }, DEBOUNCE_MS);

        return () => {
            clearTimeout(timeoutId);
            abortController.abort();
        };
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
                    <LeadingIcon size={20} strokeWidth={2} />
                </div>

                {/* 2. INPUT REAL: flex reserva espacio fijo para la X, el texto nunca la tapa */}
                <div className="flex-1 min-w-0 flex items-center h-full">
                    <input 
                        type="text" 
                        value={query} 
                        onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }} 
                        onClick={() => setIsOpen(true)} 
                        placeholder={placeholder ?? t('location.searchPlaceholder')} 
                        className="flex-1 min-w-0 h-full bg-transparent border-none text-white font-medium placeholder-slate-500 focus:ring-0 outline-none p-0 pr-2 text-base"
                        autoComplete="off"
                    />
                    <div className="shrink-0 w-9 flex items-center justify-center">
                        {loading ? (
                            <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                        ) : query ? (
                            <Button variant="ghost" size="icon" onClick={() => { setQuery(''); onSelect(null); }} className="p-1 rounded-full" title={t('common.delete')} aria-label={t('common.delete')}>
                                <X size={14} />
                            </Button>
                        ) : null}
                    </div>
                </div>

                {/* 3. BOTONES DERECHA (Integrados visualmente) */}
                <div className="flex items-center pr-2 gap-0.5 h-full">
                    {/* Separador vertical */}
                    <div className="h-5 w-px bg-slate-700/50 mx-1"></div>
                    
                    {onGPS && (
                        <Button variant="ghost" size="iconLg" onClick={onGPS} className="p-2 rounded-lg hover:text-primary hover:bg-slate-700/30" title={t('location.useMyLocation')} aria-label={t('location.useMyLocation')}>
                            <CrosshairIcon size={20} />
                        </Button>
                    )}
                    {onMapClick && (
                        <Button variant="ghost" size="iconLg" onClick={onMapClick} className="p-2 rounded-lg hover:text-primary hover:bg-slate-700/30" title={t('location.selectOnMap')} aria-label={t('location.selectOnMap')}>
                            <MapIcon size={20} />
                        </Button>
                    )}
                </div>
            </div>

            {/* 4. DESPLEGABLE DE RESULTADOS (Portal para evitar clipping por overflow) */}
            {isOpen && results.length > 0 && createPortal(
                <Card
                    ref={dropdownRef}
                    data-location-dropdown
                    variant="default"
                    padding="none"
                    className="fixed rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.8)] z-[9999] overflow-hidden animate-fade-in max-h-60 overflow-y-auto custom-scrollbar ring-1 ring-white/10"
                    style={{
                        top: dropdownRect.top,
                        left: dropdownRect.left,
                        width: dropdownRect.width,
                        maxWidth: 'min(100vw - 2rem, 24rem)'
                    }}
                >
                    {results.map((item, idx) => (
                        <Button
                            key={idx}
                            variant="ghost"
                            onClick={() => handleSelect(item)}
                            className="w-full text-left px-4 py-3 rounded-none border-b border-slate-800/50 last:border-0 flex items-center gap-3 group"
                        >
                            <div className="shrink-0 mt-0.5 bg-slate-800 p-1.5 rounded-lg group-hover:bg-slate-700 transition-colors">
                                <MapPin className="w-4 h-4 text-slate-400 group-hover:text-blue-400 transition-colors" />
                            </div>
                            <div className="flex-grow overflow-hidden min-w-0">
                                <div className="flex justify-between items-baseline gap-2">
                                    <span className="text-sm font-bold text-slate-200 group-hover:text-white truncate">{item.mainText}</span>
                                    {item.distTxt && (
                                        <span className="text-xs font-bold text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded-md whitespace-nowrap shrink-0 flex items-center gap-1">
                                            <CornerDownRight size={10} /> {item.distTxt}
                                        </span>
                                    )}
                                </div>
                                <div className="text-xs text-slate-500 truncate group-hover:text-slate-400">{item.subText}</div>
                            </div>
                        </Button>
                    ))}
                </Card>,
                document.body
            )}
        </div>
    );
};

export default LocationSearchInput;