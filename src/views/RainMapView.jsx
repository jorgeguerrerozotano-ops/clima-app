import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Play, Pause, Loader2, ZoomIn, ZoomOut, Cloud, CloudRain } from 'lucide-react';

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

const RainMapView = ({ lat, lon }) => {
    const mapContainerRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const layersRef = useRef({ radar: {}, satellite: {} }); 
    const timerRef = useRef(null);

    // ESTADOS
    const [loading, setLoading] = useState(true);
    const [isPlaying, setIsPlaying] = useState(false);
    const [frames, setFrames] = useState([]); 
    const [currentIndex, setCurrentIndex] = useState(0); 

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
            maxZoom: 11, 
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

        fetchHybridData(map);

        return () => {
            stopAnimation();
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
            }
        };
    }, [lat, lon]);

    // 2. MOTOR DE DATOS HÍBRIDO
    const fetchHybridData = async (map) => {
        try {
            const res = await fetch('https://api.rainviewer.com/public/weather-maps.json');
            const data = await res.json();
            
            let radarFrames = data.radar?.past || [];
            let satFrames = data.satellite?.infrared || [];

            // Sincronización Temporal
            const unifiedFrames = radarFrames.map(rFrame => {
                const closestSat = satFrames.reduce((prev, curr) => {
                    return (Math.abs(curr.time - rFrame.time) < Math.abs(prev.time - rFrame.time) ? curr : prev);
                });

                return {
                    time: rFrame.time,
                    radarPath: rFrame.path,
                    satPath: closestSat?.path
                };
            });

            setFrames(unifiedFrames);
            setCurrentIndex(unifiedFrames.length - 1); 
            
            const host = data.host || 'https://tile.cache.rainviewer.com';

            unifiedFrames.forEach(frame => {
                // CAPA SATÉLITE
                if (frame.satPath) {
                    const satUrl = `${host}${frame.satPath}/256/{z}/{x}/{y}/0/1_1.png`;
                    const satLayer = L.tileLayer(satUrl, {
                        opacity: 0, 
                        zIndex: 10, 
                        tileSize: 256
                    });
                    satLayer.addTo(map);
                    layersRef.current.satellite[frame.time] = satLayer;
                }

                // CAPA RADAR (TITAN)
                if (frame.radarPath) {
                    const radarUrl = `${host}${frame.radarPath}/256/{z}/{x}/{y}/6/1_1.png`;
                    const radarLayer = L.tileLayer(radarUrl, {
                        opacity: 0,
                        zIndex: 20, 
                        tileSize: 256
                    });
                    radarLayer.addTo(map);
                    layersRef.current.radar[frame.time] = radarLayer;
                }
            });

            setLoading(false);
            setIsPlaying(true); 

        } catch (e) {
            console.error("Error hybrid data:", e);
            setLoading(false);
        }
    };

    // 3. ANIMACIÓN
    useEffect(() => {
        const updateLayers = () => {
            if (!frames.length) return;
            const currentTs = frames[currentIndex].time;

            Object.keys(layersRef.current.satellite).forEach(ts => {
                const layer = layersRef.current.satellite[ts];
                layer.setOpacity(parseInt(ts) === currentTs ? 0.5 : 0); 
            });

            Object.keys(layersRef.current.radar).forEach(ts => {
                const layer = layersRef.current.radar[ts];
                layer.setOpacity(parseInt(ts) === currentTs ? 1 : 0);
            });
        };

        updateLayers();

        if (isPlaying) {
            timerRef.current = setTimeout(() => {
                setCurrentIndex(prev => (prev + 1) % frames.length);
            }, 600); 
        }
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
            {loading && (
                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/60 backdrop-blur-sm">
                    <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-3" />
                    <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">Cargando Satélites...</span>
                </div>
            )}

            {/* INFO SUPERIOR */}
            <div className="absolute top-4 left-4 z-[400] pointer-events-none">
                <div className="glass-panel px-4 py-2 rounded-xl flex items-center gap-3 shadow-lg bg-slate-900/90 backdrop-blur-xl border border-slate-700/50 pointer-events-auto">
                    <div className="flex flex-col">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">HISTÓRICO (2h)</span>
                        <div className="flex items-center gap-2">
                            <span className="text-xl font-black text-white font-mono">{getTimeLabel()}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* CONTROLES ZOOM */}
            <div className="absolute top-4 right-4 z-[400] flex flex-col gap-2">
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
                                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wide">Nubes</span>
                            </div>

                            {/* Divisor Vertical */}
                            <div className="w-px h-6 bg-slate-700"></div>

                            {/* Leyenda 2: Radar (TITAN Scale) con FIX de Borde */}
                            <div className="flex flex-col gap-1 min-w-[120px]">
                                {/* FIX: 'overflow-hidden' en el contenedor padre + gradiente en div hijo */}
                                <div className="w-full h-2 rounded-full border border-white/10 overflow-hidden relative">
                                    <div 
                                        className="absolute inset-0"
                                        style={{ background: 'linear-gradient(to right, #85c7f0, #009696, #ffd700, #ff0000, #ff00ff)' }}
                                    ></div>
                                </div>
                                <div className="flex justify-between w-full text-[8px] font-bold text-slate-400 uppercase tracking-wide px-0.5">
                                    <span>Chubasco</span>
                                    <span>Tormenta</span>
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