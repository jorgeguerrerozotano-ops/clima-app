import React, { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';

// --- COMPONENTES UI ---
import MapSelector from './components/MapSelector';
import LocationSearchInput from './components/LocationSearchInput'; 
import ActivityModal from './components/ActivityModal';
import BottomNavigation from './components/BottomNavigation';
import ErrorBoundary from './components/ErrorBoundary'; 

// --- VISTAS Y PESTAÑAS ---
import HomeView from './views/HomeView';
import RouteView from './views/RouteView';
import ActivitiesTab from './components/ActivitiesTab'; 
import HistoryTab from './components/HistoryTab';
import RainMapView from './views/RainMapView'; 

// --- LOGICA ---
import { useWeather } from './hooks/useWeather';
import useLocalStorage from './hooks/useLocalStorage'; 
import { formatStandardLocation } from './utils/helpers';

function App() {
  // --- ESTADO NEGOCIO ---
  const { weatherData, loading, error, loadWeatherData } = useWeather();
  const [query, setQuery] = useState('Madrid');
  const [activeTab, setActiveTab] = useState('inicio');

  // --- ESTADO UI ---
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [mapTarget, setMapTarget] = useState('main'); 
  const [mapCenter, setMapCenter] = useState({ lat: 40.4168, lon: -3.7038 }); 
  const [selectedActivityForModal, setSelectedActivityForModal] = useState(null);
  const [historyMapUpdate, setHistoryMapUpdate] = useState(null);

  // --- ESTADO PERSISTENTE ---
  const [customActivities, setCustomActivities] = useLocalStorage('my_activities', []);
  const [favorites, setFavorites] = useLocalStorage('my_favorites', ['moto', 'running', 'laundry']);

  // --- INICIALIZACIÓN ---
  useEffect(() => { loadWeatherData(40.4168, -3.7038, 'Madrid, Spain'); }, []);

  useEffect(() => {
    if ((activeTab === 'inicio' || activeTab === 'mapa') && weatherData) {
        setQuery(weatherData.location.name);
    }
  }, [weatherData, activeTab]);

  // --- HANDLERS ---
  const handleSaveActivity = (newAct) => {
      setCustomActivities(prev => {
          const exists = prev.some(a => a.id === newAct.id);
          if (exists) return prev.map(a => a.id === newAct.id ? newAct : a);
          return [...prev, newAct];
      });
  };

  const handleDeleteActivity = (id) => {
      if(confirm('¿Borrar esta actividad?')) {
          setCustomActivities(prev => prev.filter(a => a.id !== id));
          if(favorites.includes(id)) {
              setFavorites(prev => prev.filter(favId => favId !== id));
          }
      }
  };

  const toggleFavorite = (id) => {
      setFavorites(prev => {
          if (prev.includes(id)) return prev.filter(favId => favId !== id);
          if (prev.length >= 3) return prev;
          return [...prev, id];
      });
  };

  const openMapFor = (target) => {
    setMapTarget(target);
    if (weatherData) setMapCenter({ lat: weatherData.location.lat, lon: weatherData.location.lon });
    setShowMapPicker(true);
  };

  const handleGlobalSelect = (item) => {
      if (!item) return;
      setQuery(item.name);
      loadWeatherData(item.lat, item.lon, item.name);
  };

  const handleViewLocation = (location) => {
      if (!location) return;
      setActiveTab('inicio'); 
      setQuery(location.name); 
      loadWeatherData(location.lat, location.lon, location.name); 
  };

  const handleGPS = () => {
    if(!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
        async p => {
            try {
                const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${p.coords.latitude}&lon=${p.coords.longitude}&addressdetails=1&accept-language=es`);
                const rd = await r.json();
                const formattedName = formatStandardLocation(rd);
                loadWeatherData(p.coords.latitude, p.coords.longitude, formattedName, true);
                setQuery(formattedName);
            } catch { 
                loadWeatherData(p.coords.latitude, p.coords.longitude, "Ubicación GPS", true); 
            }
        },
        () => alert("Error GPS")
    );
  };

  const handleMapConfirm = async (coords) => {
      setShowMapPicker(false);
      try {
          const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.lat}&lon=${coords.lon}&addressdetails=1&accept-language=es`);
          const rd = await r.json();
          const name = formatStandardLocation(rd);
          
          if (mapTarget === 'history') {
             setHistoryMapUpdate({ lat: coords.lat, lon: coords.lon, name, country: rd.address?.country || "Mapa" });
          } else {
              loadWeatherData(coords.lat, coords.lon, name);
              setQuery(name);
          }
      } catch {
          if (mapTarget !== 'history') loadWeatherData(coords.lat, coords.lon, "Ubicación Mapa");
      }
  };

  // LÓGICA VISIBILIDAD BARRA: Ocultar en 'historia', 'rutas' Y AHORA TAMBIÉN en 'colada' (Planes)
  const showGlobalSearch = activeTab !== 'historia' && activeTab !== 'rutas' && activeTab !== 'colada';

  return (
    <div className="min-h-screen pb-20 relative bg-slate-900 text-slate-100 font-sans selection:bg-blue-500/30">
        <MapSelector initialCenter={mapCenter} isOpen={showMapPicker} onConfirm={handleMapConfirm} onCancel={() => setShowMapPicker(false)} />
        <ActivityModal activity={selectedActivityForModal} weatherData={weatherData} onClose={() => setSelectedActivityForModal(null)} />

        <div className="relative z-10 max-w-lg mx-auto animate-fade-in">
            {/* BARRA SUPERIOR CONDICIONAL */}
            {showGlobalSearch && (
                <div className="sticky top-0 z-50 bg-slate-900/95 border-b border-white/10 p-4 shadow-lg backdrop-blur-md">
                    <LocationSearchInput 
                        placeholder="Buscar ciudad..."
                        initialValue={query}
                        proximityCoords={weatherData?.location}
                        onSelect={handleGlobalSelect}
                        onGPS={handleGPS}
                        onMapClick={() => openMapFor('main')}
                    />
                </div>
            )}

            <main className="p-4 flex flex-col gap-4">
                {error && <div className="bg-red-500/90 p-3 rounded-xl text-sm font-bold shadow-lg">{error}</div>}
                
                {loading ? (
                    <div className="h-[50vh] flex items-center justify-center">
                        <div className="animate-spin text-blue-500"><AlertCircle size={40} /></div>
                    </div>
                ) : weatherData && (
                    <ErrorBoundary>
                        
                        {activeTab === 'inicio' && (
                            <HomeView 
                                weatherData={weatherData} 
                                favorites={favorites} 
                                onSelectActivity={setSelectedActivityForModal} 
                            />
                        )}
                        
                        {activeTab === 'rutas' && (
                            <RouteView 
                                weatherData={weatherData}
                                onViewLocation={handleViewLocation} 
                            />
                        )}

                        {activeTab === 'colada' && (
                             <ActivitiesTab 
                                weatherData={weatherData} 
                                onLocationSelect={(item) => {
                                    // Actualizamos estado global
                                    setQuery(item.name);
                                    loadWeatherData(item.lat, item.lon, item.name);
                                }} 
                                onGPS={handleGPS}
                                onOpenMap={() => openMapFor('main')}
                                favorites={favorites} 
                                onToggleFavorite={toggleFavorite}
                                customActivities={customActivities}
                                onSaveActivity={handleSaveActivity}
                                onDeleteActivity={handleDeleteActivity}
                             />
                        )}

                        {activeTab === 'mapa' && (
                            <RainMapView lat={weatherData.location.lat} lon={weatherData.location.lon} />
                        )}

                        {activeTab === 'historia' && (
                            <HistoryTab 
                                initialLat={weatherData.location.lat}
                                initialLon={weatherData.location.lon}
                                initialCity={weatherData.location.name}
                                onOpenMap={() => openMapFor('history')}
                                mapUpdate={historyMapUpdate}
                                onGPS={handleGPS} 
                            />
                        )}
                    </ErrorBoundary>
                )}
            </main>

            <BottomNavigation activeTab={activeTab} onChange={setActiveTab} />
        </div>
    </div>
  );
}

export default App;