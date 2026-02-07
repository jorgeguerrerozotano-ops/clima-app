import React, { useState, useEffect, useRef } from 'react';
import { AlertCircle, MapPin, Search } from 'lucide-react';

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
import { useTranslation } from 'react-i18next';
import { formatStandardLocation, getNominatimHeaders } from './utils/helpers';

function App() {
  const { t } = useTranslation();
  // --- ESTADO NEGOCIO ---
  const { weatherData, loading, error, loadWeatherData } = useWeather();
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState('inicio');

  // --- ESTADO UI ---
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [mapTarget, setMapTarget] = useState('main'); 
  const [mapCenter, setMapCenter] = useState({ lat: 40.4168, lon: -3.7038 }); 
  const [selectedActivityForModal, setSelectedActivityForModal] = useState(null);
  const [historyMapUpdate, setHistoryMapUpdate] = useState(null);
  const [gpsError, setGpsError] = useState(null);
  const [tryingInitialLocation, setTryingInitialLocation] = useState(true);
  const [locationDeniedOrFailed, setLocationDeniedOrFailed] = useState(false);
  const searchBarRef = useRef(null);

  // --- ESTADO PERSISTENTE ---
  const [customActivities, setCustomActivities] = useLocalStorage('my_activities', []);
  const [favorites, setFavorites] = useLocalStorage('my_favorites', ['moto', 'running', 'laundry']);

  // --- INICIALIZACIÓN: ubicación del usuario al arranque ---
  useEffect(() => {
    if (!navigator.geolocation) {
      setTryingInitialLocation(false);
      setLocationDeniedOrFailed(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (p) => {
        setTryingInitialLocation(false);
        setLocationDeniedOrFailed(false);
        try {
          const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${p.coords.latitude}&lon=${p.coords.longitude}&addressdetails=1`, { headers: getNominatimHeaders() });
          const rd = await r.json();
          const formattedName = formatStandardLocation(rd);
          setQuery(formattedName);
          setMapCenter({ lat: p.coords.latitude, lon: p.coords.longitude });
          loadWeatherData(p.coords.latitude, p.coords.longitude, formattedName, true, { altitude: p.coords.altitude, altitudeAccuracy: p.coords.altitudeAccuracy });
        } catch {
          loadWeatherData(p.coords.latitude, p.coords.longitude, t('location.gpsLocation'), true, { altitude: p.coords.altitude, altitudeAccuracy: p.coords.altitudeAccuracy });
          setQuery(t('location.gpsLocation'));
        }
      },
      () => {
        setTryingInitialLocation(false);
        setLocationDeniedOrFailed(true);
      },
      { timeout: 8000, maximumAge: 300000 }
    );
  }, []);

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
      if(confirm(t('activities.deleteConfirm'))) {
          setCustomActivities(prev => prev.filter(a => a.id !== id));
          if(favorites.includes(id)) {
              setFavorites(prev => prev.filter(favId => favId !== id));
          }
      }
  };

  const toggleFavorite = (id) => {
      setFavorites(prev => {
          if (prev.includes(id)) return prev.filter(favId => favId !== id);
          if (prev.length >= 4) return prev;
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
      setLocationDeniedOrFailed(false);
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
    if (!navigator.geolocation) {
      setGpsError(t('location.geolocationNotSupported'));
      return;
    }
    setGpsError(null);
    navigator.geolocation.getCurrentPosition(
        async p => {
            setGpsError(null);
            setLocationDeniedOrFailed(false);
            try {
                const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${p.coords.latitude}&lon=${p.coords.longitude}&addressdetails=1`, { headers: getNominatimHeaders() });
                const rd = await r.json();
                const formattedName = formatStandardLocation(rd);
                loadWeatherData(p.coords.latitude, p.coords.longitude, formattedName, true, { altitude: p.coords.altitude, altitudeAccuracy: p.coords.altitudeAccuracy });
                setQuery(formattedName);
            } catch { 
                loadWeatherData(p.coords.latitude, p.coords.longitude, t('location.gpsLocation'), true, { altitude: p.coords.altitude, altitudeAccuracy: p.coords.altitudeAccuracy }); 
            }
        },
        (err) => {
          const msg = err.code === 1 ? t('location.permissionDenied') : err.code === 2 ? t('location.positionUnavailable') : err.code === 3 ? t('location.timeout') : t('location.unknownError');
          setGpsError(msg);
        },
        { timeout: 15000, maximumAge: 60000 }
    );
  };

  const handleMapConfirm = async (coords) => {
      setShowMapPicker(false);
      try {
          const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.lat}&lon=${coords.lon}&addressdetails=1`, { headers: getNominatimHeaders() });
          const rd = await r.json();
          const name = formatStandardLocation(rd);
          
          if (mapTarget === 'history') {
             setHistoryMapUpdate({ lat: coords.lat, lon: coords.lon, name, country: rd.address?.country || t('location.map') });
          } else {
              loadWeatherData(coords.lat, coords.lon, name);
              setQuery(name);
          }
      } catch {
          if (mapTarget !== 'history') loadWeatherData(coords.lat, coords.lon, t('location.mapLocation'));
      }
  };

  // LÓGICA VISIBILIDAD BARRA: Ocultar en 'historia', 'rutas' y 'colada'; si ubicación denegada, siempre mostrar para poder buscar
  const showGlobalSearch = (activeTab !== 'historia' && activeTab !== 'rutas' && activeTab !== 'colada') || locationDeniedOrFailed;

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-slate-900 text-slate-100 font-sans selection:bg-blue-500/30" style={{ paddingBottom: 'var(--nav-total-height)' }}>
        <MapSelector initialCenter={mapCenter} isOpen={showMapPicker} onConfirm={handleMapConfirm} onCancel={() => setShowMapPicker(false)} />
        <ActivityModal activity={selectedActivityForModal} weatherData={weatherData} onClose={() => setSelectedActivityForModal(null)} />

        <div className="flex-1 min-h-0 flex flex-col max-w-lg mx-auto w-full animate-fade-in relative z-10">
            {/* BARRA SUPERIOR CONDICIONAL */}
            {showGlobalSearch && (
                <div ref={searchBarRef} className="shrink-0 relative z-30 bg-slate-900/95 border-b border-white/10 p-4 shadow-lg backdrop-blur-md">
                    <LocationSearchInput 
                        placeholder={t('location.searchPlaceholder')}
                        initialValue={query}
                        proximityCoords={weatherData?.location}
                        onSelect={handleGlobalSelect}
                        onGPS={handleGPS}
                        onMapClick={() => openMapFor('main')}
                    />
                </div>
            )}

            <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 flex flex-col gap-4 no-scrollbar relative z-0">
                {(error || gpsError) && <div className="bg-red-500/90 p-3 rounded-xl text-sm font-bold shadow-lg">{error || gpsError}</div>}

                {tryingInitialLocation && (
                    <div className="flex flex-col items-center justify-center py-16 gap-4 animate-fade-in">
                        <div className="animate-spin text-blue-500"><AlertCircle size={40} /></div>
                        <p className="text-sm font-bold text-slate-300 text-center">{t('location.loading')}</p>
                        <p className="text-xs text-slate-500 text-center max-w-[260px]">{t('location.loadingHint')}</p>
                    </div>
                )}

                {!tryingInitialLocation && locationDeniedOrFailed && !weatherData && !loading && (
                    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 space-y-4 animate-fade-in">
                        <div className="flex items-start gap-3">
                            <div className="p-2 rounded-full bg-amber-500/20 shrink-0">
                                <MapPin size={22} className="text-amber-400" />
                            </div>
                            <div>
                                <h3 className="font-bold text-amber-200 text-sm mb-1">{t('location.unavailable')}</h3>
                                <p className="text-xs text-slate-300 leading-relaxed">
                                    {t('location.unavailableDesc')}
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => searchBarRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold text-sm transition-all active:scale-[0.98]"
                        >
                            <Search size={18} /> {t('location.searchInBar')}
                        </button>
                    </div>
                )}
                
                {loading && !tryingInitialLocation ? (
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
                                onGoToActivities={() => setActiveTab('colada')}
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