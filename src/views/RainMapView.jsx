import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Play, Pause, Loader2, ZoomIn, ZoomOut, CloudRain, Lock, Unlock } from 'lucide-react';

// --- CONFIGURACIÓN LEAFLET ---
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const MAX_RADAR_FRAMES = 8;

const RainMapView = ({ lat, lon }) => {
    const { t } = useTranslation();
    const mapContainerRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const layersRef = useRef({ radarCurrent: null, satelliteCurrent: null });
    const rainviewerHostRef = useRef(null);
    const timerRef = useRef(null);
    const crossfadeRef = useRef({ timeoutId: null, newRadar: null, newSat: null });

    // ESTADOS
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [frames, setFrames] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [mapLocked, setMapLocked] = useState(true); 

    // 1. INICIALIZAR MAPA
    useEffect(() => {
        if (!mapContainerRef.current) return;

        if (mapInstanceRef.current) {
            mapInstanceRef.current.remove();
            mapInstanceRef.current = null;
        }

        const map = L.map(mapContainerRef.current, {
            zoomControl: false, 
            attributionControl: false,
            minZoom: 4,  
            maxZoom: 7, 
            maxBounds: [[-65, -180], [85, 180]], 
            maxBoundsViscosity: 1.0 
        }).setView([lat, lon], 6);

        // MAPA CLARO (Voyager)
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            maxZoom: 18,
            subdomains: 'abcd'
        }).addTo(map);

        // Marcador Posición
        const pulseIcon = L.divIcon({
            className: 'custom-pulse-marker',
            html: '<div class="w-4 h-4 bg-blue-600 rounded-full border-2 border-white shadow-[0_0_15px_rgba(37,99,235,0.6)] animate-pulse"></div>',
            iconSize: [16, 16],
            iconAnchor: [8, 8]
        });
        L.marker([lat, lon], { icon: pulseIcon }).addTo(map);

        mapInstanceRef.current = map;
        map.dragging.disable();
        map.scrollWheelZoom.disable();

        fetchHybridData(map);

        return () => {
            stopAnimation();
            if (mapInstanceRef.current) {
                const m = mapInstanceRef.current;
                if (layersRef.current.radarCurrent && m.hasLayer(layersRef.current.radarCurrent)) m.removeLayer(layersRef.current.radarCurrent);
                if (layersRef.current.satelliteCurrent && m.hasLayer(layersRef.current.satelliteCurrent)) m.removeLayer(layersRef.current.satelliteCurrent);
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
            }
        };
    }, [lat, lon]);

    useEffect(() => {
        const map = mapInstanceRef.current;
        if (!map) return;
        if (mapLocked) {
            map.dragging.disable();
            map.scrollWheelZoom.disable();
        } else {
            map.dragging.enable();
            map.scrollWheelZoom.enable();
        }
    }, [mapLocked]);

    // 1b. REFRESCO AUTOMÁTICO (polling 5 min)
    useEffect(() => {
        const interval = setInterval(() => {
            const map = mapInstanceRef.current;
            if (map) fetchHybridData(map);
        }, 300000);
        return () => clearInterval(interval);
    }, [lat, lon]);

    // 2. MOTOR DE DATOS HÍBRIDO
    const RAINVIEWER_HOST_WHITELIST = ['https://tilecache.rainviewer.com', 'https://api.rainviewer.com'];
    const isSafeHost = (h) => typeof h === 'string' && RAINVIEWER_HOST_WHITELIST.some(allowed => h.startsWith(allowed));
    const isSafePath = (p) => typeof p === 'string' && !p.includes('//') && !p.includes(':');

    const SAFE_DELAY_SEC = 90;

    const fetchHybridData = async (map) => {
        try {
            setError(null);
            const res = await fetch('https://api.rainviewer.com/public/weather-maps.json');
            const data = await res.json();

            const radarFrames = data.radar?.past || [];
            const satFrames = data.satellite?.infrared || [];

            if (!radarFrames.length) {
                setError(t('rainMap.errorNoRadar'));
                setFrames([]);
                setLoading(false);
                return;
            }

            const closestSatFor = (rFrame) => {
                if (!satFrames.length) return undefined;
                return satFrames.reduce((prev, curr) =>
                    Math.abs(curr.time - rFrame.time) < Math.abs(prev.time - rFrame.time) ? curr : prev);
            };

            let unifiedFrames = radarFrames.map(rFrame => ({
                time: rFrame.time,
                radarPath: rFrame.path,
                satPath: closestSatFor(rFrame)?.path
            }));
            unifiedFrames = unifiedFrames.slice(-MAX_RADAR_FRAMES);

            const generated = data.generated;
            const newestFrameTime = unifiedFrames[unifiedFrames.length - 1]?.time ?? 0;
            const isNewestTooRecent = generated && unifiedFrames.length >= 2 &&
                (generated - newestFrameTime) < SAFE_DELAY_SEC;
            const startIdx = isNewestTooRecent ? unifiedFrames.length - 2 : unifiedFrames.length - 1;

            const rawHost = data.host || 'https://tilecache.rainviewer.com';
            const host = isSafeHost(rawHost) ? rawHost : 'https://tilecache.rainviewer.com';
            rainviewerHostRef.current = host;

            setFrames(unifiedFrames);
            setCurrentIndex(Math.max(0, startIdx));

            const isMapStillValid = () => mapInstanceRef.current === map && map.getContainer()?.parentNode;
            if (!isMapStillValid()) {
                setLoading(false);
                return;
            }

            setLoading(false);
            setIsPlaying(true);
        } catch (e) {
            console.error("Error hybrid data:", e);
            setError(t('rainMap.errorLoadRadar'));
            setLoading(false);
        }
    };

    // 2b. UNA SOLA CAPA ACTIVA POR FRAME + CROSSFADE (evita 429 y suaviza el cambio)
    const CROSSFADE_MS = 180;
    const CROSSFADE_STEPS = 5;

    useEffect(() => {
        const map = mapInstanceRef.current;
        if (!map || !frames.length || currentIndex < 0 || currentIndex >= frames.length) return;
        const host = rainviewerHostRef.current;
        if (!host) return;

        if (crossfadeRef.current.timeoutId) clearTimeout(crossfadeRef.current.timeoutId);
        if (crossfadeRef.current.newRadar && map.hasLayer(crossfadeRef.current.newRadar)) map.removeLayer(crossfadeRef.current.newRadar);
        if (crossfadeRef.current.newSat && map.hasLayer(crossfadeRef.current.newSat)) map.removeLayer(crossfadeRef.current.newSat);
        crossfadeRef.current.newRadar = null;
        crossfadeRef.current.newSat = null;

        const oldRadar = layersRef.current.radarCurrent;
        const oldSat = layersRef.current.satelliteCurrent;
        const hasOld = (oldRadar && map.hasLayer(oldRadar)) || (oldSat && map.hasLayer(oldSat));

        const frame = frames[currentIndex];
        let newRadar = null;
        let newSat = null;
        if (frame.satPath && isSafePath(frame.satPath)) {
            newSat = L.tileLayer(`${host}${frame.satPath}/256/{z}/{x}/{y}/0/1_1.png`, {
                opacity: 0, zIndex: 10, tileSize: 256
            });
            newSat.addTo(map);
        }
        if (frame.radarPath && isSafePath(frame.radarPath)) {
            newRadar = L.tileLayer(`${host}${frame.radarPath}/256/{z}/{x}/{y}/6/1_1.png`, {
                opacity: 0, zIndex: 20, tileSize: 256
            });
            newRadar.addTo(map);
        }

        if (!hasOld) {
            if (newRadar) newRadar.setOpacity(1);
            if (newSat) newSat.setOpacity(0.5);
            layersRef.current.radarCurrent = newRadar;
            layersRef.current.satelliteCurrent = newSat;
            return;
        }

        crossfadeRef.current.newRadar = newRadar;
        crossfadeRef.current.newSat = newSat;
        const stepMs = CROSSFADE_MS / CROSSFADE_STEPS;
        let step = 0;
        const runStep = () => {
            step++;
            const t = step / CROSSFADE_STEPS;
            if (oldRadar && map.hasLayer(oldRadar)) oldRadar.setOpacity(1 - t);
            if (oldSat && map.hasLayer(oldSat)) oldSat.setOpacity(0.5 * (1 - t));
            if (newRadar && map.hasLayer(newRadar)) newRadar.setOpacity(t);
            if (newSat && map.hasLayer(newSat)) newSat.setOpacity(0.5 * t);
            if (step < CROSSFADE_STEPS) {
                crossfadeRef.current.timeoutId = setTimeout(runStep, stepMs);
            } else {
                if (oldRadar && map.hasLayer(oldRadar)) map.removeLayer(oldRadar);
                if (oldSat && map.hasLayer(oldSat)) map.removeLayer(oldSat);
                layersRef.current.radarCurrent = newRadar;
                layersRef.current.satelliteCurrent = newSat;
                crossfadeRef.current.newRadar = null;
                crossfadeRef.current.newSat = null;
                crossfadeRef.current.timeoutId = null;
            }
        };
        crossfadeRef.current.timeoutId = setTimeout(runStep, stepMs);

        return () => {
            if (crossfadeRef.current.timeoutId) clearTimeout(crossfadeRef.current.timeoutId);
            if (crossfadeRef.current.newRadar && map.hasLayer(crossfadeRef.current.newRadar)) map.removeLayer(crossfadeRef.current.newRadar);
            if (crossfadeRef.current.newSat && map.hasLayer(crossfadeRef.current.newSat)) map.removeLayer(crossfadeRef.current.newSat);
        };
    }, [frames, currentIndex]);

    // 3. ANIMACIÓN (avanza frame; la capa visible se actualiza por el efecto anterior)
    useEffect(() => {
        if (!isPlaying || !frames.length) return;
        timerRef.current = setTimeout(() => {
            setCurrentIndex(prev => (prev + 1) % frames.length);
        }, 500);
        return () => clearTimeout(timerRef.current);
    }, [currentIndex, isPlaying, frames]);

    const stopAnimation = () => {
        setIsPlaying(false);
        if (timerRef.current) clearTimeout(timerRef.current);
    };

    const togglePlay = () => setIsPlaying(!isPlaying);

    const getTimeLabel = () => {
        if (!frames.length) return "--:--";
        const ts = frames[currentIndex].time;
        return new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const getProgressPercent = () => {
        if (!frames.length) return 0;
        return ((currentIndex + 1) / frames.length) * 100;
    };

    return (
        <div className="h-[75vh] w-full relative rounded-3xl overflow-hidden shadow-2xl border border-slate-200 bg-[#d6dde0] group">
            
            <div ref={mapContainerRef} className="w-full h-full z-0 bg-[#d6dde0]" />

            {/* LOADER */}
            {loading && !error && (
                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/60 backdrop-blur-sm">
                    <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-3" />
                    <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">Cargando Satélites...</span>
                </div>
            )}

            {/* ESTADO VACÍO / ERROR */}
            {error && (
                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-900/90 backdrop-blur-sm p-6">
                    <CloudRain className="w-12 h-12 text-slate-500 mb-4" />
                    <p className="text-sm font-bold text-slate-300 text-center max-w-[280px]">{typeof error === 'string' ? error : (error?.message ?? String(error ?? ''))}</p>
                </div>
            )}

            {/* INFO SUPERIOR */}
            <div className="absolute top-4 left-4 z-[400] pointer-events-none">
                <div className="glass-panel px-4 py-2 rounded-xl flex items-center gap-3 shadow-lg bg-slate-900/90 backdrop-blur-xl border border-slate-700/50 pointer-events-auto">
                    <div className="flex flex-col">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{t('rainMap.historical2h')}</span>
                        <div className="flex items-center gap-2">
                            <span className="text-xl font-black text-white font-mono">{getTimeLabel()}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* CONTROLES ZOOM + BLOQUEO MAPA */}
            <div className="absolute top-4 right-4 z-[400] flex flex-col gap-2">
                <button onClick={() => setMapLocked(prev => !prev)} className="p-2 bg-white text-slate-700 rounded-lg border border-slate-200 shadow-lg hover:bg-slate-50 active:scale-95 transition-all" title={mapLocked ? 'Desbloquear mapa (permite arrastrar y zoom)' : 'Fijar mapa (evita muchas peticiones al servidor)'} aria-label={mapLocked ? 'Desbloquear mapa' : 'Fijar mapa'}>
                    {mapLocked ? <Lock size={20} /> : <Unlock size={20} />}
                </button>
                <button onClick={() => mapInstanceRef.current?.setZoom(mapInstanceRef.current.getZoom() + 1)} className="p-2 bg-white text-slate-700 rounded-lg border border-slate-200 shadow-lg hover:bg-slate-50 active:scale-95 transition-all"><ZoomIn size={20}/></button>
                <button onClick={() => mapInstanceRef.current?.setZoom(mapInstanceRef.current.getZoom() - 1)} className="p-2 bg-white text-slate-700 rounded-lg border border-slate-200 shadow-lg hover:bg-slate-50 active:scale-95 transition-all"><ZoomOut size={20}/></button>
            </div>

            {/* PLAYER INFERIOR + LEYENDA MEJORADA */}
            <div className="absolute bottom-6 left-4 right-4 z-[400]">
                <div className="glass-panel p-3 rounded-2xl border border-slate-600/50 shadow-2xl bg-slate-900/90 backdrop-blur-xl">
                    {/* Barra de Progreso */}
                    <div className="w-full h-1 bg-slate-700 rounded-full mb-3 overflow-hidden">
                        <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${getProgressPercent()}%` }}></div>
                    </div>

                    <div className="flex items-center justify-between gap-4">
                        {/* Botón Play */}
                        <button 
                            onClick={togglePlay}
                            className="w-10 h-10 flex items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-500 transition-all shadow-lg active:scale-95 shrink-0"
                        >
                            {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
                        </button>

                        {/* --- LEYENDA DE COLORES FIX --- */}
                        <div className="flex-1 flex items-center justify-end gap-4">
                            
                            {/* Leyenda 1: Satélite (Nubes) */}
                            <div className="flex flex-col items-center gap-1">
                                <div className="w-10 h-2 bg-white/40 rounded-full border border-white/20"></div>
                                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wide">{t('rainMap.clouds')}</span>
                            </div>

                            {/* Divisor Vertical */}
                            <div className="w-px h-6 bg-slate-700"></div>

                            {/* Leyenda 2: Radar (TITAN Scale) con FIX de Borde */}
                            <div className="flex flex-col gap-1 min-w-[120px]">
                                <div className="w-full h-2 rounded-full border border-white/10 overflow-hidden relative">
                                    <div 
                                        className="absolute inset-0"
                                        style={{ background: 'linear-gradient(to right, #85c7f0, #009696, #ffd700, #ff0000, #ff00ff)' }}
                                    ></div>
                                </div>
                                <div className="flex justify-between w-full text-[8px] font-bold text-slate-400 uppercase tracking-wide px-0.5">
                                    <span>{t('rainMap.shower')}</span>
                                    <span>{t('rainMap.storm')}</span>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RainMapView;