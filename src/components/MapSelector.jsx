import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, X, Check, Crosshair, Activity } from 'lucide-react';

// Corrige el problema de los iconos rotos de Leaflet en Vite/React
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const MapSelector = ({ initialCenter, onConfirm, onCancel, isOpen }) => {
    const mapContainerRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const markerRef = useRef(null);
    const [selectedCoords, setSelectedCoords] = useState(initialCenter);
    const [isLocating, setIsLocating] = useState(false);

    // Efecto para inicializar y limpiar el mapa
    useEffect(() => {
        if (!isOpen) return;

        // Pequeño retraso para asegurar que el DOM (la ventana) ya existe visualmente
        const timer = setTimeout(() => {
            if (!mapContainerRef.current) return;

            // Si ya hay mapa, lo destruimos para empezar limpio (evita errores de gris)
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
            }

            // 1. Crear el mapa
            const map = L.map(mapContainerRef.current).setView([initialCenter.lat, initialCenter.lon], 13);
            
            // 2. Cargar las baldosas (Tiles)
            L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; CARTO',
                subdomains: 'abcd',
                maxZoom: 20 
            }).addTo(map);

            // 3. Crear el marcador personalizado
            const customIcon = L.divIcon({ 
                className: 'custom-pin', 
                html: '<div style="background-color: #ef4444; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 8px rgba(0,0,0,0.4);"></div>', 
                iconSize: [24, 24], 
                iconAnchor: [12, 12] 
            });

            const marker = L.marker([initialCenter.lat, initialCenter.lon], { icon: customIcon }).addTo(map);
            markerRef.current = marker;

            // 4. Evento Click
            map.on('click', (e) => { 
                const { lat, lng } = e.latlng; 
                marker.setLatLng([lat, lng]); 
                setSelectedCoords({ lat, lon: lng }); 
            });

            mapInstanceRef.current = map;

            // FUERZA BRUTA: Obligar al mapa a recalcular su tamaño
            setTimeout(() => {
                map.invalidateSize();
            }, 100);

        }, 100); // Esperamos 100ms a que la animación de apertura termine

        // Limpieza al cerrar
        return () => {
            clearTimeout(timer);
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
            }
        };

    }, [isOpen]); // Se ejecuta cada vez que se abre/cierra

    // Manejo de "Mi Ubicación"
    const handleLocateMe = () => {
        if (!navigator.geolocation) return;
        setIsLocating(true);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                if (mapInstanceRef.current) {
                    mapInstanceRef.current.setView([latitude, longitude], 15);
                    if(markerRef.current) markerRef.current.setLatLng([latitude, longitude]);
                    setSelectedCoords({ lat: latitude, lon: longitude });
                    // Otra invalidación por si acaso
                    setTimeout(() => mapInstanceRef.current.invalidateSize(), 250);
                }
                setIsLocating(false);
            },
            (error) => {
                console.error("Error GPS", error);
                setIsLocating(false);
                alert("No se pudo obtener tu ubicación");
            }
        );
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[1000] animate-fade-in">
            <div className="bg-slate-900 w-full max-w-md rounded-3xl overflow-hidden border border-slate-700 shadow-2xl flex flex-col h-auto">
                <div className="flex justify-between items-center p-4 border-b border-slate-800 bg-slate-900/50">
                    <h3 className="text-white font-bold text-sm flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-blue-400" /> Elige Ubicación
                    </h3>
                    <button onClick={onCancel} className="bg-slate-800 hover:bg-slate-700 p-1.5 rounded-full transition-colors">
                        <X className="w-5 h-5 text-slate-400" />
                    </button>
                </div>
                
                <div className="relative h-[55vh] w-full bg-slate-800">
                    {/* El contenedor del mapa */}
                    <div ref={mapContainerRef} className="h-full w-full z-0"></div>
                    
                    <button 
                        onClick={handleLocateMe}
                        className="absolute bottom-4 right-4 z-[500] bg-blue-600 hover:bg-blue-500 text-white px-4 py-3 rounded-xl shadow-xl border border-blue-400/30 active:scale-95 transition-all flex items-center gap-2"
                    >
                        {isLocating ? <Activity className="w-5 h-5 animate-spin" /> : <Crosshair className="w-5 h-5" />}
                        <span className="font-bold text-xs">Mi Ubicación</span>
                    </button>
                </div>

                <div className="p-4 bg-slate-900 border-t border-slate-800">
                    <button onClick={() => onConfirm(selectedCoords)} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95 text-sm">
                        <Check className="w-5 h-5" /> Confirmar Ubicación
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MapSelector;