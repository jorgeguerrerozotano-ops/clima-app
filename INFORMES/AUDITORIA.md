# Informe de Auditoría — Mi Clima App

**Fecha:** Febrero 2025  
**Objetivo:** Documentar el funcionamiento interno, APIs, UI y conceptos técnicos para que un lector comprenda la aplicación en su totalidad.

---

## 1. Resumen Ejecutivo

**Mi Clima App** es una aplicación web de clima orientada a móvil, construida con **React 19** y **Vite 7**. Ofrece:

- Pronóstico del tiempo en tiempo real
- Análisis de rutas con clima por segmentos (origen, paradas, destino)
- Actividades personalizables (moto, running, colada, etc.) con reglas climáticas
- Radar de precipitaciones animado
- Historial climático desde 1950 con gráficos
- Internacionalización (español/inglés)

**Stack tecnológico:** JavaScript (ESM), React 19, Vite 7, Tailwind CSS, Leaflet, Recharts, i18next.

---

## 2. Arquitectura General

### 2.1 Estructura del Proyecto

```
src/
├── main.jsx           # Punto de entrada, StrictMode, i18n, CSS
├── App.jsx            # Orquestador: estado global, navegación, handlers
├── i18n/              # Internacionalización (es, en)
├── hooks/             # useWeather, useRouteWeather, useLocalStorage, useInterpolatedTemperature
├── utils/             # helpers, activitiesConfig, modelConsensus
├── views/             # HomeView, RouteView, RainMapView
└── components/        # UI, modales, inputs, mapas
```

### 2.2 Flujo de Datos

1. **Inicialización:** Al montar `App`, se obtiene la ubicación GPS del usuario.
2. **Geocodificación inversa:** Nominatim convierte lat/lon en nombre legible.
3. **Clima:** `useWeather` llama a Open-Meteo y (opcionalmente) Air Quality API.
4. **Persistencia:** `localStorage` guarda favoritos y actividades; `IndexedDB` cachea histórico.

---

## 3. APIs Externas

### 3.1 Open-Meteo (Clima principal)

**Base URL:** `https://api.open-meteo.com/v1/forecast`

| Parámetro | Descripción |
|-----------|-------------|
| latitude, longitude | Coordenadas |
| current | temperature_2m, relative_humidity_2m, apparent_temperature, is_day, weather_code, wind_speed_10m, precipitation, snowfall, snow_depth, cloud_cover |
| daily | weather_code, temperature_2m_max/min, precipitation_probability_max, sunrise, sunset |
| hourly | temperature_2m, apparent_temperature, precipitation_probability, weather_code, is_day, cloud_cover, wind_speed_10m, precipitation, snowfall, snow_depth, relative_humidity_2m |
| timezone | `auto` |
| elevation | Opcional: altitud GPS si `altitudeAccuracy < 100m` |

**Procesamiento:**
- Búsqueda del índice horario actual en `hourly.time`
- Sanitización de códigos WMO (`sanitizeCode`) para evitar "falsos positivos" de lluvia (prob < 30%, precip < 0.15mm)
- Generación de `nextRainText`, `laundrySafe`, `avgClouds`, etc.

### 3.2 Air Quality API

**URL:** `https://air-quality-api.open-meteo.com/v1/air-quality`

- Parámetros: latitude, longitude, hourly=us_aqi, timezone=auto
- Si falla, no bloquea: se usa `us_aqi: null` (Running > AQI 150 se omite)

### 3.3 Nominatim (OpenStreetMap)

**Búsqueda:** `https://nominatim.openstreetmap.org/search`
- `format=json`, `q=`, `limit=8`, `addressdetails=1`, `accept-language`
- **User-Agent obligatorio:** `MiClimaApp/1.0 (https://github.com/mi-clima-app)`

**Geocodificación inversa:** `https://nominatim.openstreetmap.org/reverse`
- `format=json`, `lat=`, `lon=`, `addressdetails=1`

### 3.4 OSRM (Rutas)

**URL:** `https://router.project-osrm.org/route/v1/driving/{coords}?overview=full&geometries=geojson`

- Formato coords: `lon1,lat1;lon2,lat2` o con waypoints intermedios
- Devuelve: distancia, duración, legs, geometría de la ruta
- Cálculo de duración por modo: coche/moto = segundos/60; bici = km/20*60; caminar = km/5*60

### 3.5 RainViewer (Radar)

**URL:** `https://api.rainviewer.com/public/weather-maps.json`

- Devuelve: `radar.past`, `satellite.infrared`, `host`, `generated`
- Combinación radar + satélite (IR) para cada frame
- Tiles: `{host}{path}/256/{z}/{x}/{y}/6/1_1.png` (radar), `0/1_1.png` (satélite)

### 3.6 Open-Meteo Archive (Histórico)

**URL:** `https://archive-api.open-meteo.com/v1/archive`

- Parámetros: latitude, longitude, start_date=1950-01-01, end_date=hoy
- Daily: temperature_2m_mean, precipitation_sum, temperature_2m_max/min

### 3.7 Model Consensus (disponible, no integrado)

**Módulo:** `src/utils/modelConsensus.js`

- Permite obtener temperatura consensuada entre ECMWF, GFS e ICON
- `buildConsensusUrl`, `fetchModelConsensus` — actualmente no importados en la app

---

## 4. Hooks Principales

### 4.1 useWeather

- `fetchAPI`: Open-Meteo forecast
- `fetchAirQuality`: Air Quality API
- `mergeAirQualityIntoHourly`: fusiona us_aqi en datos horarios
- `processWeatherData`: índices, sanitización, nextRainText, laundrySafe, hourlyForecast
- `resolveElevation`: usa altitud GPS solo si accuracy < 100m y con debounce 50m
- Devuelve: `{ weatherData, loading, error, loadWeatherData }`

### 4.2 useRouteWeather

- `calculateRoute`: OSRM + Open-Meteo en origen, destino y punto medio
- `getForecastAtTime`: pronóstico en hora concreta + suelo mojado (2h previas)
- Evaluadores por modo: `evaluateMotoLike`, `evaluateCar`, `evaluateWalk`
- Waypoints: `addWaypoint`, `updateWaypoint`, `removeWaypoint` con recálculo OSRM
- Devuelve: `{ calculateRoute, routeResult, loading, error, resetRoute, addWaypoint, updateWaypoint, removeWaypoint }`

### 4.3 useLocalStorage

- Lazy initialization con `useState(() => …)`
- Sincroniza con `localStorage` en cada `setValue`
- Claves usadas: `my_activities`, `my_favorites`

### 4.4 useInterpolatedTemperature

- LERP entre horas para temperatura y sensación térmica
- Actualización cada 60s (`setInterval`)
- Usa `interpolateHourlyValue` de helpers (timezone-aware)

---

## 5. Lógica de Negocio

### 5.1 Códigos WMO (Weather Codes)

- `helpers.getWeatherInfo(code)`: mapea WMO a etiqueta y color
- `helpers.sanitizeCode(originalCode, precipMM, rainProb)`:
  - Prob < 30%: lluvia/llovizna → nublado (3)
  - Precip < 0.15mm: códigos de precipitación → nublado (salvo tormenta/nieve)
  - Degradación de intensidad si precip < 1.5mm (65→63, 82→81, etc.)

### 5.2 Actividades (activitiesConfig.js)

- **Predefinidas:** moto, running, laundry (con `rules.mode`)
- **Evaluadores:** `evaluateStandardActivity` (running), `evaluateMotoActivity`, `evaluateLaundryActivity`
- Límites: RUNNING_HEAT_CRITICAL 32°, MOTO_WIND_CRITICAL 45 km/h, AQI_CRITICAL 150, etc.
- `checkActivityRules(hourlyData, startIndex, durationMinutes, rules)` → status, message, factors

### 5.3 Geolocalización y Geometría (helpers.js)

- `pointAlongRoute(geometry, fraction)`: punto en polilínea por fracción
- `closestPointOnPolyline(point, polyline)`: snap a ruta
- `fractionAlongPolyline(point, polyline)`: fracción 0–1
- `pointOnRouteInFreeZone(geometry, existingPoints)`: punto alejado de paradas
- `getDistanceFromLatLonInKm`: Haversine
- `formatStandardLocation`: dirección formateada desde Nominatim

### 5.4 Histórico

- `getClimateKey(lat, lon)`: clave de caché con redondeo a 1 decimal (~11 km)
- IndexedDB: `ClimaRetroDB`, store `history_store`, caducidad 30 días
- `calculateClimateTrends`: evolución temp/lluvia, probabilidad de lluvia en la semana

---

## 6. UI / UX

### 6.1 Navegación

- **BottomNavigation:** 5 pestañas (inicio, rutas, colada, historia, mapa)
- Fija en `bottom-4`, glass panel con `backdrop-blur-xl`
- Clase activa: neón azul, escala 1.1, `drop-shadow`

### 6.2 Barra de Búsqueda

- **Condiciones:** visible en inicio y mapa; oculta en historia, rutas, colada
- Si ubicación denegada: siempre visible
- `LocationSearchInput`: debounce 300ms, Nominatim, portal para dropdown
- Portal con `createPortal` para evitar clipping por overflow

### 6.3 Estilos Globales (index.css)

- Variables: `--nav-bar-height`, `--nav-total-height` (incl. safe-area)
- `glass-panel`: fondo semitransparente, blur 12px, borde blanco/10
- `no-scrollbar`: oculta scrollbar en webkit/ms
- `animate-fade-in`: opacity 0→1 en 0.3s

### 6.4 Componentes Reutilizables

- **MapSelector:** Leaflet, modo normal o ruta con waypoints
- **RouteMapView:** mapa con polilínea, marcadores, edición de paradas
- **WeatherIconMain:** react-icons Wi, colores según temp/código/día
- **HomeSummary:** grid de actividades favoritas
- **WeeklyForecast:** previsión diaria
- **ErrorBoundary:** captura errores de render

### 6.5 Patrones de Diseño UI

- Dark theme: slate-900, slate-800, blanco/10
- Acentos: azul (blue-500/600), emerald (destinos), amber (alertas)
- Tarjetas con bordes sutiles y glass effect
- Animaciones: fade-in, pulse, float (icono principal)

---

## 7. Internacionalización (i18n)

- **Biblioteca:** i18next, react-i18next, i18next-browser-languagedetector
- **Idiomas:** es, en (fallback es)
- **Detección:** localStorage → navigator
- **Archivos:** `locales/es.json`, `locales/en.json`
- Claves: `location.*`, `tabs.*`, `weather.*`, `activities.*`, `routes.*`, `history.*`, etc.

---

## 8. Dependencias Principales

| Paquete | Uso |
|---------|-----|
| react 19, react-dom | Framework |
| vite 7 | Build, HMR |
| tailwindcss | Estilos |
| leaflet, react-leaflet | Mapas |
| recharts | Gráficos histórico |
| i18next, react-i18next | i18n |
| lucide-react, @phosphor-icons/react | Iconos |
| date-fns | Fechas |
| clsx, tailwind-merge | Clases condicionales |
| lottie-react | Animaciones (si se usa) |

---

## 9. Conceptos Técnicos Aplicados

- **Lazy initialization:** useLocalStorage, useState(() => …)
- **Debouncing:** búsqueda Nominatim 300ms
- **Interpolación lineal (LERP):** temperatura entre horas
- **Geometría:** Haversine, punto en polilínea, snap a ruta
- **Portales:** dropdown de búsqueda en `document.body`
- **ResizeObserver:** reposicionamiento del dropdown
- **AbortController:** cancelación de fetch en HistoryTab
- **IndexedDB:** caché histórico (30 días)
- **Sanitización de códigos:** anti-ruido en pronósticos
- **Error Boundary:** aislamiento de fallos de render
- **Refs:** mapas, marcadores, contenedores para evitar re-renders

---

## 10. Despliegue

- **Configuración:** `vercel.json` (preset Vite)
- **Build:** `vite build` (chunkSizeWarningLimit 1600)
- **Preview:** `vite preview`

---

## 11. Notas para Mantenimiento

1. **modelConsensus.js** está implementado pero no integrado; podría usarse para mejorar confianza del pronóstico.
2. Nominatim exige User-Agent identificable; mantener `getNominatimHeaders()`.
3. RainViewer usa whitelist de hosts (`tilecache.rainviewer.com`, `api.rainviewer.com`) por seguridad.
4. OSRM solo soporta `driving`; bici/caminar se simulan con duración manual.
5. El histórico usa Archive API con posible límite 429; IndexedDB reduce llamadas repetidas.

---

*Documento generado por auditoría de código. Última revisión: Febrero 2025.*
