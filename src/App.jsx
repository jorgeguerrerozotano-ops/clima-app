import React, { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from 'react';
import { AlertCircle, MapPin, Search, Trash2 } from 'lucide-react';

// --- COMPONENTES UI ---
import MapSelector from './components/MapSelector';
import LocationSearchInput from './components/LocationSearchInput';
import ActivityModal from './components/ActivityModal';
import BottomNavigation from './components/BottomNavigation';
import ErrorBoundary from './components/ErrorBoundary';

// --- VISTA PRINCIPAL (carga inmediata) ---
import HomeView from './views/HomeView';
import RouteView from './views/RouteView';
import ActivitiesTab from './components/ActivitiesTab';

// --- VISTAS PESADAS (lazy: Leaflet, Recharts) ---
const RainMapView = lazy(() => import('./views/RainMapView'));
const HistoryTab = lazy(() => import('./components/HistoryTab'));

// --- LOGICA ---
import { useWeather } from './hooks/useWeather';
import useLocalStorage from './hooks/useLocalStorage';
import { useTranslation } from 'react-i18next';
import { getCurrentPositionWithName, resolveLocationFromCoords } from './utils/helpers';

function LazyLoader() {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4" aria-hidden="true">
      <div className="loader animate-spin text-blue-500 w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full" />
      <p className="text-sm font-medium text-slate-400">Cargando…</p>
    </div>
  );
}

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
  const [deleteConfirmActivityId, setDeleteConfirmActivityId] = useState(null);
  const searchBarRef = useRef(null);
  /** Evita setState/loadWeatherData tras desmontaje (geolocalización inicial y handleGPS). */
  const isMountedRef = useRef(true);

  // --- ESTADO PERSISTENTE ---
  const [customActivities, setCustomActivities] = useLocalStorage('my_activities', []);
  const [favorites, setFavorites] = useLocalStorage('my_favorites', ['moto', 'running', 'laundry']);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // --- INICIALIZACIÓN: ubicación del usuario al arranque (lógica centralizada en helpers) ---
  useEffect(() => {
    getCurrentPositionWithName(t('location.gpsLocation'), { timeout: 8000, maximumAge: 300000 })
      .then((data) => {
        if (!isMountedRef.current) return;
        setTryingInitialLocation(false);
        setLocationDeniedOrFailed(false);
        setQuery(data.name);
        setMapCenter({ lat: data.lat, lon: data.lon });
        loadWeatherData(data.lat, data.lon, data.name, true, { altitude: data.altitude, altitudeAccuracy: data.altitudeAccuracy });
      })
      .catch(() => {
        if (!isMountedRef.current) return;
        setTryingInitialLocation(false);
        setLocationDeniedOrFailed(true);
      });
  }, []);

  useEffect(() => {
    if ((activeTab === 'inicio' || activeTab === 'mapa') && weatherData) {
        setQuery(weatherData?.location?.name ?? '');
    }
  }, [weatherData, activeTab]);

  // --- HANDLERS (useCallback para evitar re-renders de hijos) ---
  const handleSaveActivity = useCallback((newAct) => {
    setCustomActivities(prev => {
      const exists = prev.some(a => a.id === newAct.id);
      if (exists) return prev.map(a => (a.id === newAct.id ? newAct : a));
      return [...prev, newAct];
    });
  }, []);

  const handleDeleteActivity = useCallback((id) => {
    setDeleteConfirmActivityId(id);
  }, []);

  const confirmDeleteActivity = useCallback(() => {
    if (deleteConfirmActivityId == null) return;
    const id = deleteConfirmActivityId;
    setDeleteConfirmActivityId(null);
    setCustomActivities(prev => prev.filter(a => a.id !== id));
    setFavorites(prev => (prev.includes(id) ? prev.filter(favId => favId !== id) : prev));
  }, [deleteConfirmActivityId]);

  const toggleFavorite = useCallback((id) => {
    setFavorites(prev => {
      if (prev.includes(id)) return prev.filter(favId => favId !== id);
      if (prev.length >= 4) return prev;
      return [...prev, id];
    });
  }, []);

  const openMapFor = useCallback((target) => {
    setMapTarget(target);
    if (weatherData?.location) setMapCenter({ lat: weatherData?.location?.lat, lon: weatherData?.location?.lon });
    setShowMapPicker(true);
  }, [weatherData?.location?.lat, weatherData?.location?.lon]);

  const handleGlobalSelect = useCallback((item) => {
    if (!item) return;
    setLocationDeniedOrFailed(false);
    setQuery(item.name);
    loadWeatherData(item.lat, item.lon, item.name);
  }, [loadWeatherData]);

  const handleViewLocation = useCallback((location) => {
    if (!location) return;
    setActiveTab('inicio');
    setQuery(location.name);
    loadWeatherData(location.lat, location.lon, location.name);
  }, [loadWeatherData]);

  const handleGPS = useCallback(() => {
    setGpsError(null);
    getCurrentPositionWithName(t('location.gpsLocation'), { timeout: 15000, maximumAge: 60000 })
      .then((data) => {
        if (!isMountedRef.current) return;
        setLocationDeniedOrFailed(false);
        loadWeatherData(data.lat, data.lon, data.name, true, { altitude: data.altitude, altitudeAccuracy: data.altitudeAccuracy });
        setQuery(data.name);
      })
      .catch((err) => {
        if (!isMountedRef.current) return;
        const msg = err.code === 1 ? t('location.permissionDenied') : err.code === 2 ? t('location.positionUnavailable') : err.code === 3 ? t('location.timeout') : t('location.geolocationNotSupported');
        setGpsError(msg);
      });
  }, [t, loadWeatherData]);

  const handleMapConfirm = useCallback(async (coords) => {
    setShowMapPicker(false);
    const data = await resolveLocationFromCoords(coords.lat, coords.lon, t('location.mapLocation'));
    if (mapTarget === 'history') {
      setHistoryMapUpdate({ lat: data.lat, lon: data.lon, name: data.name, country: data.country || t('location.map') });
    } else {
      loadWeatherData(data.lat, data.lon, data.name);
      setQuery(data.name);
    }
  }, [t, mapTarget, loadWeatherData]);

  const handleCloseMapPicker = useCallback(() => setShowMapPicker(false), []);
  const handleActivitiesLocationSelect = useCallback((item) => {
    setQuery(item.name);
    loadWeatherData(item.lat, item.lon, item.name);
  }, [loadWeatherData]);
  const openMapMain = useCallback(() => openMapFor('main'), [openMapFor]);
  const openMapHistory = useCallback(() => openMapFor('history'), [openMapFor]);
  const handleCloseActivityModal = useCallback(() => setSelectedActivityForModal(null), []);

  const proximityCoords = useMemo(
    () => (weatherData?.location ? { lat: weatherData?.location?.lat, lon: weatherData?.location?.lon } : null),
    [weatherData?.location?.lat, weatherData?.location?.lon]
  );

  const showGlobalSearch = (activeTab !== 'historia' && activeTab !== 'rutas' && activeTab !== 'colada') || locationDeniedOrFailed;

  return (
    <div className="h-full min-h-0 flex flex-col bg-slate-900 text-slate-100 font-sans selection:bg-blue-500/30">
        <MapSelector initialCenter={mapCenter} isOpen={showMapPicker} onConfirm={handleMapConfirm} onCancel={handleCloseMapPicker} />
        <ActivityModal activity={selectedActivityForModal} weatherData={weatherData} onClose={handleCloseActivityModal} />

        {deleteConfirmActivityId != null && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in" onClick={() => setDeleteConfirmActivityId(null)}>
            <div className="bg-slate-900 w-full max-w-sm rounded-2xl border border-slate-700 shadow-2xl p-5 space-y-4 animate-fade-in" onClick={e => e.stopPropagation()}>
              <p className="text-slate-200 text-sm font-medium text-center">{t('activities.deleteConfirm')}</p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmActivityId(null)}
                  className="flex-1 py-3 rounded-xl font-bold text-sm bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors active:scale-[0.98]"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteActivity}
                  className="flex-1 py-3 rounded-xl font-bold text-sm bg-red-600 hover:bg-red-500 text-white flex items-center justify-center gap-2 transition-colors active:scale-[0.98]"
                >
                  <Trash2 size={18} /> {t('activities.delete')}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col flex-1 min-h-0 max-w-lg mx-auto w-full animate-fade-in relative z-10">
            {/* BARRA SUPERIOR CONDICIONAL (shrink-0: fija arriba, scroll solo en main) */}
            {showGlobalSearch && (
                <div ref={searchBarRef} className="shrink-0 z-30 bg-slate-900/95 border-b border-white/10 p-4 shadow-lg backdrop-blur-md">
                    <LocationSearchInput
                        placeholder={t('location.searchPlaceholder')}
                        initialValue={query}
                        proximityCoords={proximityCoords}
                        onSelect={handleGlobalSelect}
                        onGPS={handleGPS}
                        onMapClick={openMapMain}
                    />
                </div>
            )}

            <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 flex flex-col gap-4 relative z-0">
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
                                customActivities={customActivities}
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
                                onLocationSelect={handleActivitiesLocationSelect}
                                onGPS={handleGPS}
                                onOpenMap={openMapMain}
                                favorites={favorites}
                                onToggleFavorite={toggleFavorite}
                                customActivities={customActivities}
                                onSaveActivity={handleSaveActivity}
                                onDeleteActivity={handleDeleteActivity}
                            />
                        )}

                        {activeTab === 'mapa' && (
                            <Suspense fallback={<LazyLoader />}>
                                <RainMapView lat={weatherData?.location?.lat} lon={weatherData?.location?.lon} />
                            </Suspense>
                        )}

                        {activeTab === 'historia' && (
                            <Suspense fallback={<LazyLoader />}>
                                <HistoryTab
                                    initialLat={weatherData?.location?.lat}
                                    initialLon={weatherData?.location?.lon}
                                    initialCity={weatherData?.location?.name}
                                    onOpenMap={openMapHistory}
                                    mapUpdate={historyMapUpdate}
                                    onGPS={handleGPS}
                                />
                            </Suspense>
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