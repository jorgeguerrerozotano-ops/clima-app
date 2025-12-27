import React, { useState, useEffect, useRef } from 'react';
import { Home, Briefcase, MapPin, Plus, Trash2, Save, X } from 'lucide-react';
import LocationSearchInput from './LocationSearchInput';
import MapSelector from './MapSelector'; // IMPORTAMOS MAPA
import { formatStandardLocation } from '../utils/helpers'; // IMPORTAMOS HELPER

const RouteFavorites = ({ onSelect }) => {
    const [places, setPlaces] = useState([null, null, null]);
    const [editingSlot, setEditingSlot] = useState(null);
    
    // Formulario de edición
    const [editName, setEditName] = useState('');
    const [tempLocation, setTempLocation] = useState(null); 
    
    // Estado Mapa
    const [showMap, setShowMap] = useState(false);

    useEffect(() => {
        const saved = localStorage.getItem('route_places');
        if (saved) { try { setPlaces(JSON.parse(saved)); } catch (e) {} }
    }, []);

    const savePlaces = (newPlaces) => { 
        setPlaces(newPlaces); 
        localStorage.setItem('route_places', JSON.stringify(newPlaces)); 
    };

    const startEdit = (index) => {
        const place = places[index];
        setEditName(place ? place.name : (index === 0 ? 'Casa' : (index === 1 ? 'Trabajo' : 'Gym')));
        setTempLocation(place || null); 
        setEditingSlot(index);
    };

    const confirmSave = () => { 
        if (!tempLocation || !editName) return; 
        const newPlaces = [...places]; 
        newPlaces[editingSlot] = { 
            name: editName, 
            lat: tempLocation.lat, 
            lon: tempLocation.lon, 
            address: tempLocation.name 
        }; 
        savePlaces(newPlaces); 
        setEditingSlot(null); 
    };

    const deletePlace = () => { 
        const newPlaces = [...places]; 
        newPlaces[editingSlot] = null; 
        savePlaces(newPlaces); 
        setEditingSlot(null); 
    };

    const handleMapConfirm = async (coords) => {
        setShowMap(false);
        // Geocodificación inversa para obtener nombre
        try {
            const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.lat}&lon=${coords.lon}&addressdetails=1&accept-language=es`);
            const rd = await r.json();
            const name = formatStandardLocation(rd);
            setTempLocation({
                name: name,
                lat: coords.lat,
                lon: coords.lon,
                address: name
            });
        } catch (e) {
            // Fallback si falla la API
            setTempLocation({
                name: "Ubicación Mapa",
                lat: coords.lat,
                lon: coords.lon,
                address: "Seleccionado en mapa"
            });
        }
    };

    const timerRef = useRef(null);
    const handleTouchStart = (index) => { timerRef.current = setTimeout(() => startEdit(index), 800); };
    const handleTouchEnd = () => { if (timerRef.current) clearTimeout(timerRef.current); };

    const icons = [Home, Briefcase, MapPin];

    return (
        <div className="mb-4">
            {/* MAPA FLOTANTE (Encima de todo si está activo) */}
            <MapSelector 
                initialCenter={tempLocation ? {lat: parseFloat(tempLocation.lat), lon: parseFloat(tempLocation.lon)} : { lat: 40.4168, lon: -3.7038 }}
                isOpen={showMap}
                onConfirm={handleMapConfirm}
                onCancel={() => setShowMap(false)}
            />

            <div className="flex gap-2">
                {places.map((place, index) => {
                    const Icon = icons[index];
                    const isEmpty = !place;
                    return (
                        <button
                            key={index}
                            onMouseDown={() => handleTouchStart(index)}
                            onMouseUp={handleTouchEnd}
                            onTouchStart={() => handleTouchStart(index)}
                            onTouchEnd={handleTouchEnd}
                            onClick={() => { if (isEmpty) startEdit(index); else onSelect(place); }}
                            className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-2 text-xs font-bold border transition-all active:scale-95 select-none ${isEmpty ? 'border-dashed border-slate-600 text-slate-500 hover:bg-slate-800' : 'bg-indigo-900/30 border-indigo-500/30 text-indigo-200 hover:bg-indigo-900/50'}`}
                        >
                            {isEmpty ? <Plus size={14}/> : <Icon size={14}/>}
                            {isEmpty ? (index === 0 ? 'Casa' : (index === 1 ? 'Trabajo' : 'Lugar')) : place.name}
                        </button>
                    );
                })}
            </div>
            <p className="text-[9px] text-slate-500 mt-1 text-center italic">Mantén pulsado para editar o borrar</p>

            {editingSlot !== null && !showMap && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
                    <div className="bg-slate-900 border border-slate-700 w-full max-w-xs rounded-2xl p-4 shadow-2xl">
                        <div className="flex justify-between items-center mb-4"><h3 className="text-white font-bold">Editar Lugar</h3><button onClick={() => setEditingSlot(null)}><X size={18} className="text-slate-400"/></button></div>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Etiqueta</label>
                                <input 
                                    type="text" value={editName} onChange={e => setEditName(e.target.value)} 
                                    className="w-full bg-slate-800 border border-slate-600 rounded-xl p-3 text-white text-sm font-bold focus:border-blue-500 outline-none"
                                />
                            </div>
                            
                            <div>
                                <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Dirección</label>
                                {/* BUSCADOR CON BOTÓN DE MAPA */}
                                <LocationSearchInput 
                                    placeholder="Buscar dirección..."
                                    initialValue={tempLocation?.address || ''}
                                    onSelect={(place) => setTempLocation(place)}
                                    // Activamos el botón de mapa
                                    onMapClick={() => setShowMap(true)}
                                />
                            </div>

                            {tempLocation && (
                                <div className="bg-emerald-900/20 border border-emerald-500/30 p-2 rounded-lg text-[10px] text-emerald-200 truncate">
                                    ✅ {tempLocation.name || "Ubicación seleccionada"}
                                </div>
                            )}

                            <div className="flex gap-2 pt-2 border-t border-slate-800">
                                {places[editingSlot] && (
                                    <button onClick={deletePlace} className="flex-1 py-3 bg-red-900/30 text-red-300 rounded-xl text-xs font-bold flex justify-center items-center gap-1"><Trash2 size={14}/> Borrar</button>
                                )}
                                <button onClick={confirmSave} disabled={!tempLocation} className={`flex-1 py-3 rounded-xl text-xs font-bold flex justify-center items-center gap-1 ${tempLocation ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-800 text-slate-500'}`}>
                                    <Save size={14}/> Guardar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
export default RouteFavorites;