# AUDITORÍA FORENSE APLICACIÓN MI-CLIMA-APP

**Fecha:** 8 de febrero de 2026  
**Versión del informe:** v3  
**Alcance:** Código fuente completo, configuración, dependencias, documentación.

---

# 1. Resumen Ejecutivo (Para no técnicos)

## ¿Qué es esta App?

**mi-clima-app** es una aplicación móvil-web de **previsión meteorológica contextual** orientada al usuario final que necesita tomar decisiones cotidianas basadas en el tiempo. No es una simple app del tiempo: integra el clima con **actividades** (correr, moto, tender la colada) y con **rutas** (origen-destino por moto, coche, bici o a pie).

**Flujo de usuario principal:**
1. El usuario abre la app → se solicita geolocalización (o puede buscar ciudad manualmente).
2. La app obtiene el pronóstico de Open-Meteo y muestra la pantalla **Inicio** con temperatura, sensación, precipitaciones, horario de lluvia y recomendaciones.
3. El usuario puede:
   - **Inicio:** ver resumen y tocar actividades favoritas (moto, running, colada) para saber si "es buen momento".
   - **Rutas:** introducir origen y destino, modo de transporte y hora de salida; la app calcula la ruta (ORS/OSRM) y evalúa el clima en origen, en ruta y en destino, sugiriendo alternativas más seguras.
   - **Actividades (Colada):** gestionar actividades personalizadas, ver si es buen momento para salir a correr o tender.
   - **Historia:** consultar datos climáticos históricos (desde 1950) por semana del año, con gráficos de temperatura y precipitación.
   - **Radar:** mapa de precipitación animado (RainViewer) con satélite y radar.

La app está construida como SPA (Single Page Application) con React + Vite, desplegable en Vercel.

## Estado de Salud: **7.0 / 10**

**Resumen breve:** La base es sólida: arquitectura modular, utilidades bien separadas, reglas de seguridad centralizadas. Hay, sin embargo, **deuda técnica significativa**: uso incorrecto de hooks React (useMemo con efectos secundarios), cadenas hardcodeadas en español, dependencia crítica a una API externa sin fallback documentado, y ausencia de tests. La refactorización de utilidades (helpers → geoUtils, weatherUtils, routeUtils, etc.) está bien hecha, pero quedan vestigios de patrones antiguos y código redundante.

---

# 2. Arquitectura y Stack Tecnológico

## Mapa del Sistema

```
mi-clima-app/
├── src/
│   ├── App.jsx              ← Orquestador principal (estado global, tabs, modales)
│   ├── main.jsx             ← Entry point (React + i18n + CSS)
│   ├── components/          ← Componentes UI reutilizables
│   │   ├── LocationSearchInput.jsx   ← Búsqueda geográfica (Nominatim/ORS)
│   │   ├── MapSelector.jsx           ← Modal mapa para elegir punto
│   │   ├── RouteMapView.jsx          ← Mapa de ruta con Leaflet
│   │   ├── RouteFavorites.jsx        ← Favoritos (casa, trabajo, otro)
│   │   ├── ActivitiesTab.jsx         ← Pestaña Actividades
│   │   ├── HistoryTab.jsx            ← Historial climático
│   │   ├── RainMapView.jsx           ← Mapa radar/satélite
│   │   └── ui/                       ← FactorCard, WeatherIconMain, etc.
│   ├── views/               ← Vistas por tab
│   │   ├── HomeView.jsx
│   │   ├── RouteView.jsx
│   │   └── RainMapView.jsx
│   ├── hooks/
│   │   ├── useWeather.js            ← Pronóstico principal
│   │   ├── useRouteWeather.js       ← Rutas + clima por segmentos
│   │   ├── useInterpolatedTemperature.js
│   │   └── useLocalStorage.js
│   ├── utils/               ← Lógica de negocio y servicios
│   │   ├── helpers.js               ← Barrel (re-exports)
│   │   ├── geoUtils.js              ← Geocoding (Nominatim, ORS)
│   │   ├── routeUtils.js            ← ORS/OSRM, geometría
│   │   ├── weatherApi.js            ← Open-Meteo + calidad aire
│   │   ├── weatherUtils.js          ← Códigos WMO, luna, tendencias
│   │   ├── timeUtils.js             ← Índice horario, interpolación
│   │   ├── storageUtils.js          ← IndexedDB + localStorage
│   │   ├── safetyRules.js           ← Evaluadores moto/coche/pie
│   │   ├── activitiesConfig.js      ← Reglas actividades
│   │   ├── smartRouteLogic.js       ← Smart Safe (tiempo/espacio)
│   │   └── riskUtils.js             ← Priorización factores
│   └── i18n/                ← Español, Inglés
├── public/
├── vite.config.js
├── vercel.json              ← SPA fallback
└── package.json
```

## Stack Detectado

| Categoría | Tecnología |
|-----------|------------|
| **Framework** | React 19.2 |
| **Build** | Vite 7.2 |
| **Estilos** | Tailwind CSS 3.4 |
| **Mapas** | Leaflet 1.9, react-leaflet 5.0 |
| **Gráficos** | Recharts 3.5 |
| **Internacionalización** | i18next 25.8, react-i18next 16.5 |
| **APIs externas** | Open-Meteo (forecast + aire), Nominatim (geocoding), OpenRouteService (rutas), OSRM (fallback), RainViewer (radar) |
| **Persistencia** | IndexedDB (ClimaRetroDB), localStorage (route_places, my_activities, my_favorites) |
| **Base de datos** | Ninguna (SPA frontend-only) |

## Diagrama de Flujo de Datos (Texto)

1. **Usuario abre la app**  
   → `main.jsx` monta `App.jsx` → `useEffect` inicial llama a `navigator.geolocation.getCurrentPosition`  
   → `getLocationFromCoords` (Nominatim reverse) obtiene nombre de la ciudad  
   → `loadWeatherData(lat, lon, name)` (hook `useWeather`)  
   → `weatherApi.fetchOpenMeteoForecast` + `fetchAirQuality`  
   → `processWeatherData` transforma raw → formato interno  
   → `setWeatherData` actualiza estado global  
   → `HomeView` renderiza resumen + actividades.

2. **Usuario busca una ciudad**  
   → `LocationSearchInput` debounce 800ms → `searchLocationNominatim` o `searchLocationORS`  
   → Resultados formateados con `formatForList`  
   → `onSelect` → `handleGlobalSelect` → `loadWeatherData` → mismo flujo que arriba.

3. **Usuario calcula una ruta**  
   → `RouteView` → `useRouteWeather().calculateRoute(origin, dest, mode, depDate)`  
   → `routeUtils.getRouteData` (ORS o OSRM) → geometría + legs  
   → Para cada segmento: `fetchOpenMeteoForecastRaw` + `fetchAirQuality`  
   → `getForecastAtTime` extrae pronóstico en la hora de llegada  
   → `safetyRules.evaluateMoto/Car/Walk` → status (green/yellow/red) + factores  
   → Si adversidad > umbral: `smartRouteLogic.findBestTimeSlot` y `findBestSpatialDetour` en background  
   → `routeResult` se actualiza → `RouteMapView` dibuja mapa + segmentos.

4. **Usuario consulta Historia**  
   → `HistoryTab` → `getHistoryFromDB(cacheKey)` (IndexedDB)  
   → Si no hay caché: `fetch(archive-api.open-meteo.com)` desde 1950  
   → `saveHistoryToDB` persiste  
   → `calculateClimateTrends` procesa datos  
   → Recharts renderiza gráficos.

---

# 3. Análisis Milimétrico de Código (Deep Dive)

## Calidad del Código

- **Legibilidad:** Buena en módulos `utils` (nombres claros, JSDoc). Componentes React tienen bloques largos con lógica mezclada.
- **SOLID:** Parcial. `safetyRules` y `activitiesConfig` centralizan evaluación; `helpers.js` actúa como barrel. Falta inyección de dependencias explícita (p. ej. `getForecastAtTime`, `evaluateSegment` pasados como parámetros).
- **Nomenclatura:** Consistente en inglés/camelCase; algunas variables (`nextOp`, `d`, `t`) son abreviadas.

## Puntos Débiles Detectados

| Archivo | Línea(s) | Problema |
|---------|----------|----------|
| `RouteView.jsx` | 84–88 | **useMemo con efectos secundarios:** `useMemo(() => { setSelectedOrigin(...); setOriginQuery(...); }, [weatherData])` — useMemo debe ser puro; esto provoca renders no deterministas. Debe ser `useEffect`. |
| `LocationSearchInput.jsx` | 14–23 | Recibe `minimal={true}` desde RouteView pero **no define ni usa** la prop `minimal`. Código muerto / prop ignorada. |
| `MapSelector.jsx` | 243 | `alert("No se pudo obtener tu ubicación")` — cadena hardcodeada, sin i18n. |
| `RainMapView.jsx` | 281, 297, 299, 303–304, 355–356 | Múltiples cadenas en español: "Cargando Satélites...", "HISTÓRICO (2h)", "Chubasco", "Tormenta", "Nubes". |
| `RouteMapView.jsx` | 365, 375 | "Confirmar posición", "Confirmar parada" — sin i18n. |
| `smartRouteLogic.js` | 155–157 | Labels hardcodeados: `'Salida'`, `'En ruta 1'`, `'Llegada'` en `findBestTimeSlot`. |
| `HistoryTab.jsx` | 59 | `toLocaleString('es-ES', { month: 'short' })` — locale fijo; debería usar `i18n.language`. |
| `App.jsx` | 90 | `confirm(t('activities.deleteConfirm'))` — uso de `confirm` nativo; UX pobre en móvil. |
| `RouteFavorites.jsx` | 21–23 | `localStorage.getItem('route_places')` — acceso directo; no usa `storageUtils` ni abstracción. |
| `useRouteWeather.js` | 257, 318, 329 | Mensajes de error en español hardcodeados: "No se pudo calcular la ruta...", "No se pudo quitar la parada.". |
| `RouteView.jsx` | 228 | `t('location.pointMap')` usado como fallback para `getLocationFromCoords` — correcto, pero si falla la llamada async, el nombre puede quedar genérico. |

## Redundancias (DRY violations)

1. **Lógica de `weekDays`:** Idéntica en `RouteView.jsx` (89–98) y `ActivitiesTab.jsx` (86–96). Debería extraerse a `utils/timeUtils.js` o `utils/dateUtils.js` como `getWeekDaysForPicker(i18n)`.

2. **Patrón colorClass/iconBg por status:** Repetido en `ActivityModal.jsx` (39–46), `ActivitiesTab.jsx` (241–244), y en `useRouteWeather` (68–70). Se podría centralizar en `utils/statusColors.js` o similar.

3. **Detección de nieve en barras de precipitación:** `HomeView.jsx` (119–121) y `ActivitiesTab`/otros usan lógica similar `(h.iconCode >= 71 && h.iconCode <= 77) || (h.iconCode >= 85 && h.iconCode <= 86)`. Extraer a `weatherUtils.isSnowCode(code)`.

4. **Formateo de hora de llegada:** `toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })` repetido en varios sitios. Ya existe `formatTimeRoundingToQuarterHour`; considerar `formatTimeShort(date, timezone)` reutilizable.

5. **`getForecastAtTime` y `isFloorWet`:** La lógica de suelo mojado (precipitación 2h previas > 0.5mm) está en `useRouteWeather.getForecastAtTime` y en `activitiesConfig.checkActivityRules`. Unificar en un helper.

## Problemas Heredados (Legacy)

| Elemento | Detalle |
|----------|---------|
| **README.md** | Sigue siendo el template de Vite ("React + Vite"); no describe la app ni su propósito. |
| **index.html** | `<title>mi-clima-app</title>` — nombre técnico, no nombre de producto. |
| **Confirm nativo** | `confirm()` para borrar actividad — patrón antiguo; sustituir por modal de confirmación. |
| **getWeatherInfo desde useWeather** | `ActivitiesTab` importa `getWeatherInfo` desde `useWeather`; es una utilidad pura, debería importarse de `helpers` o `weatherUtils`. |
| **modelConsensus.js** | Archivo borrado (D en git) pero posibles referencias residuales — verificar. |
| **openrouteservice.env** | Borrado; `.env.example` documenta `VITE_ORS_API_KEY`. Correcto, pero la app falla sin esta key para rutas (ORS es primario). |
| **EcmaVersion ESLint** | `ecmaVersion: 2020` en config; el código usa features modernas (optional chaining, etc.). Actualizar a `latest` o `2022`. |

---

# 4. Auditoría de Seguridad y Performance

## Vulnerabilidades Potenciales

| Riesgo | Severidad | Ubicación | Recomendación |
|--------|-----------|-----------|---------------|
| **API Key en cliente** | Media | `VITE_ORS_API_KEY` expuesta en build; cualquiera puede extraerla del bundle. | Usar proxy backend o servidor BFF para ORS; la key no debe viajar al navegador. |
| **XSS por datos externos** | Baja | `formatStandardLocation`, `display_name` de Nominatim/ORS — se renderizan en React (escape por defecto). | Revisar que ningún `dangerouslySetInnerHTML` use datos de API sin sanitizar. |
| **URL injection** | Baja | `RainMapView` valida `host` y `path` con whitelist (`RAINVIEWER_HOST_WHITELIST`, `isSafePath`). | Correcto. Mantener validación estricta. |
| **IndexedDB sin cuotas** | Baja | `saveHistoryToDB` guarda datos históricos; sin límite por ubicación. | Considerar límite de entradas o limpieza por LRU si el almacenamiento crece. |

## Cuellos de Botella

| Función/Flujo | Archivo | Observación |
|---------------|---------|-------------|
| **calculateRoute** | `useRouteWeather.js` | Hace 3–6 peticiones paralelas (origin, dest, mid + AQ por cada uno). En rutas con waypoints, N+2 peticiones. Considerar caché por (lat,lon) con TTL corto. |
| **fetchHistory** | `HistoryTab.jsx` | Descarga desde 1950 en una sola petición; puede ser MB. Ya usa AbortController; considerar streaming o paginación si la API lo permite. |
| **getIndexOfCurrentTime** | `timeUtils.js` | `findIndex` sobre array de strings; O(n) por llamada. Se invoca en múltiples sitios. Para arrays grandes, considerar búsqueda binaria si `time` está ordenado. |
| **RainMapView crossfade** | `RainMapView.jsx` | `setTimeout` en cadena para crossfade; 5 pasos. No bloqueante, pero muchos re-renders. |
| **processWeatherData** | `useWeather.js` | Función síncrona pesada (slices, maps, interpolaciones). Ejecutar en worker si el main thread se resiente. |

---

# 5. Plan de Acción y Refactorización

## Prioridad Alta (Critical)

1. **Corregir useMemo → useEffect en RouteView.jsx (líneas 84–88)**  
   Reemplazar `useMemo` por `useEffect` para la inicialización de `selectedOrigin`/`originQuery`. Evita comportamientos impredecibles.

2. **Añadir proxy/BFF para VITE_ORS_API_KEY**  
   La clave de OpenRouteService no debe exponerse en el cliente. Crear endpoint en backend (o Vercel serverless) que redirija peticiones a ORS con la key en servidor.

3. **Reemplazar confirm() nativo**  
   En `App.jsx` (handleDeleteActivity), sustituir `confirm()` por un modal de confirmación (ej. componente `ConfirmModal` o similar) para mejor UX móvil.

4. **Internacionalizar cadenas hardcodeadas**  
   - RainMapView: "Cargando Satélites...", "HISTÓRICO (2h)", leyenda radar.  
   - RouteMapView: "Confirmar posición", "Confirmar parada".  
   - MapSelector: alert de GPS.  
   - useRouteWeather: mensajes de error.  
   - smartRouteLogic: labels de segmentos.  
   Añadir claves en `es.json` y `en.json`.

## Prioridad Media (Improvement)

5. **Extraer `getWeekDaysForPicker`**  
   Unificar lógica de `weekDays` de RouteView y ActivitiesTab en `timeUtils.js` o nuevo `dateUtils.js`.

6. **Centralizar colores por status**  
   Crear `getStatusStyles(status)` que devuelva `{ colorClass, iconBg, borderClass }` para evitar repetición.

7. **Eliminar prop `minimal` o implementarla**  
   En LocationSearchInput: o se usa (ocultar botón mapa, simplificar UI) o se elimina de las llamadas en RouteView/HistoryTab.

8. **Migrar localStorage de RouteFavorites a storageUtils**  
   Usar `getCachedData`/`setCachedData` o una función específica para `route_places` con clave unificada.

9. **Añadir tests unitarios**  
   Prioridad: `safetyRules.evaluateMoto/Car/Walk`, `weatherUtils.sanitizeCode`, `timeUtils.getIndexOfCurrentTime`, `routeUtils.closestPointOnPolyline`.

10. **Documentar README.md**  
    Descripción de la app, stack, variables de entorno necesarias, cómo ejecutar en local.

## Limpieza (Código/Archivos Muertos)

| Acción | Detalle |
|--------|---------|
| Eliminar | Prop `minimal` no usada en LocationSearchInput (o implementar). |
| Verificar | Que no queden imports de `modelConsensus.js` ni `openrouteservice.env`. |
| Actualizar | `index.html` title a nombre de producto (ej. "Mi Clima"). |
| Actualizar | ESLint `ecmaVersion` a `2022` o `latest`. |
| Revisar | `favorites` por defecto `['moto', 'running', 'laundry']` — 'laundry' existe en PREDEFINED_ACTIVITIES; asegurar consistencia de IDs. |

---

# 6. Deuda Técnica Pendiente

No se han encontrado comentarios explícitos `TODO`, `FIXME` o `HACK` en el código (salvo el comentario "GRID DE TODOS LOS FACTORES" en ActivityModal, que no es deuda). La deuda identificada proviene del análisis estático y de patrones detectados.

---

# Anexo: Archivos Analizados

| Tipo | Cantidad |
|------|----------|
| Componentes (.jsx) | 18 |
| Hooks (.js) | 4 |
| Utilidades (.js) | 13 |
| Vistas (.jsx) | 3 |
| Config / i18n | 6 |
| Total líneas aproximadas | ~6500 |

---

*Fin del informe de auditoría.*
