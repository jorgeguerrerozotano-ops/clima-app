# DIAGNÓSTICO INTEGRAL — Mi Clima App
**Fecha:** 2026-02-09  
**Enfoque:** Auditoría forense de software (diagnóstico descriptivo, sin corrección de código).

---

# 1. Anatomía del Negocio (Para No Técnicos)

## Propósito de la Aplicación
La aplicación resuelve el problema de **planificar actividades al aire libre y desplazamientos en función del tiempo**. Permite consultar el clima actual y previsto en una ubicación, ver si conviene salir en moto, en coche, a pie o en bici, tender la ropa o salir a correr, y consultar un mapa de precipitaciones y un histórico climático por ubicación. No hay roles de administrador ni backend de usuarios: es una **app de un solo actor (usuario final)** que consume APIs externas (clima, rutas, geocodificación, radar).

## Actores y Roles
Según el código:
- **Usuario final:** Único actor. Busca ubicaciones, elige pestañas (Inicio, Rutas, Colada/Actividades, Historia, Mapa), configura origen/destino y modo de transporte en rutas, gestiona actividades favoritas y personalizadas, y consulta el radar de lluvia.
- **Sistema:** Geolocalización del navegador, APIs (Open-Meteo, OpenRouteService u OSRM, Nominatim/ORS Geocode, RainViewer). No hay backend propio más allá del proxy de direcciones ([api/ors-directions.js](api/ors-directions.js)) que oculta la API key de ORS.

No aparecen roles tipo Admin, Visitante diferenciado ni autenticación.

## Narrativa del Flujo Principal
1. Al abrir la app, se pide la ubicación del usuario. Si la acepta, se muestra el nombre del lugar y el tiempo actual (temperatura, sensación, estado del cielo, precipitación, sol/luna).
2. En **Inicio**, el usuario ve resumen del tiempo, alerta de precipitación si aplica, actividades favoritas (moto, running, colada, etc.) con estado verde/amarillo/rojo, previsión horaria compacta y previsión semanal. Puede tocar una actividad para ver el detalle y recomendaciones.
3. Puede **cambiar de lugar** desde la barra de búsqueda (o GPS o mapa). Al elegir otro sitio, se vuelve a cargar el tiempo y toda la vista se actualiza.
4. En **Rutas**, el usuario elige origen y destino (búsqueda, GPS o mapa), modo (moto, coche, bici, pie), “salir ya” o “programar” fecha/hora, y pulsa “Analizar ruta”. La app obtiene la ruta (ORS o OSRM), el tiempo en origen, en ruta y en destino, y muestra un informe por segmentos (verde/amarillo/rojo) y un mapa. Puede añadir paradas, editar waypoints y ver sugerencias de “mejor hora” o “ruta más segura” si las hay.
5. En **Colada/Actividades**, gestiona actividades predefinidas y personalizadas, favoritos, y ve el mismo tipo de análisis (mejor ventana, factores de riesgo) por actividad y ubicación.
6. En **Historia**, elige ubicación y semana y ve gráficos de temperaturas y precipitaciones históricas (datos desde Open-Meteo histórico, con caché en IndexedDB).
7. En **Mapa**, ve el radar de precipitaciones (RainViewer) centrado en la ubicación actual, con animación y controles de zoom/bloqueo.

En todos los flujos, la **fuente de verdad del lugar** es la ubicación para la que se ha cargado el tiempo en App; las vistas leen o derivan de ese estado (y en Rutas/Actividades/Historia pueden tener además estado local de búsqueda).

---

# 2. Análisis de Coherencia y Arquitectura

## Estructura Real vs. Ideal
- **Estructura actual:** Organizada por **tipo de archivo**: `views/`, `components/`, `hooks/`, `utils/`, `i18n/`. Dentro de `components` hay un subgrupo `ui/` y `extra-icons/`. No hay carpetas por feature (p. ej. `weather/`, `routes/`, `activities/`).
- **Semántica:** La separación views / components / hooks es clara. Las vistas ([HomeView.jsx](src/views/HomeView.jsx), [RouteView.jsx](src/views/RouteView.jsx), [RainMapView.jsx](src/views/RainMapView.jsx)) orquestan; los hooks ([useWeather.js](src/hooks/useWeather.js), [useRouteWeather.js](src/hooks/useRouteWeather.js)) concentran lógica de negocio y datos. El barrel [helpers.js](src/utils/helpers.js) reexporta desde módulos temáticos ([geoUtils.js](src/utils/geoUtils.js), [weatherUtils.js](src/utils/weatherUtils.js), [timeUtils.js](src/utils/timeUtils.js), [routeUtils.js](src/utils/routeUtils.js), [storageUtils.js](src/utils/storageUtils.js), [weatherApi.js](src/utils/weatherApi.js)), lo que da una “API única” pero oculta dónde vive cada responsabilidad si no se conoce el barrel.
- **Conclusión:** La estructura es **coherente con un proyecto por capas (vistas + componentes + hooks + utils)**. No es “por features”; para alguien nuevo, encontrar “todo lo de rutas” implica mirar RouteView, useRouteWeather, routeUtils, smartRouteLogic y safetyRules a la vez.

## Acoplamiento
- **App.jsx** es el núcleo: concentra estado global (clima, pestaña activa, mapa picker, favoritos, actividades personalizadas, confirmación de borrado, barra de búsqueda visible/oculta). Cualquier cambio en la firma de `loadWeatherData`, `handleMapConfirm`, `handleViewLocation` o en la forma de `weatherData` repercute en todas las vistas y en varios componentes.
- **useRouteWeather** ([useRouteWeather.js](src/hooks/useRouteWeather.js)) está muy acoplado a helpers (getRouteData, getForecastAtTime, evaluateSegment), a [safetyRules.js](src/utils/safetyRules.js) (evaluateMoto, evaluateCar, evaluateWalk), a [smartRouteLogic.js](src/utils/smartRouteLogic.js) y a [riskUtils.js](src/utils/riskUtils.js). Un cambio en el formato de segmentos o en los evaluadores obliga a tocar el hook y posiblemente RouteView y RouteSegmentAnalysisModal.
- **activitiesConfig.js** importa safetyRules, riskUtils, helpers, iconMap; [ActivitiesTab.jsx](src/components/ActivitiesTab.jsx) y [HomeSummary.jsx](src/components/HomeSummary.jsx) dependen de activitiesConfig y de la estructura de `weatherData.rawHourly`. La duplicación de “lista de actividades” entre PREDEFINED_ACTIVITIES y lo que muestra HomeSummary (favoritos + custom desde localStorage) y el acceso directo a `localStorage.getItem('my_activities')` en [HomeSummary.jsx](src/components/HomeSummary.jsx) (líneas 21–24) acoplan la UI al almacenamiento sin una capa intermedia.
- **MapSelector** se usa desde App (elegir ubicación global) y desde RouteView (origen/destino); en RouteView además se usa con modo “ruta” (waypoints, snap). La misma componente sirve dos contextos distintos, lo que aumenta la complejidad de sus props y la probabilidad de efectos colaterales al cambiar uno de los flujos.

## Gestión de Estado y Datos
- **Flujo de datos:** En gran parte **unidireccional pero concentrado en App**: el clima viene de `useWeather()` en App y se pasa por props a vistas; la ubicación “actual” es `query` + `weatherData.location` + `loadWeatherData`. Las vistas y tabs reciben callbacks para cambiar ubicación, pestaña o favoritos. No hay un store global (Redux/Zustand); el estado está en React state (y en localStorage para favoritos y actividades personalizadas).
- **Persistencia:** `useLocalStorage` para `my_activities` y `my_favorites`; HistoryTab usa IndexedDB vía [storageUtils.js](src/utils/storageUtils.js) con clave por ubicación ([getClimateKey](src/utils/storageUtils.js)). No hay sincronización entre “actividad guardada” y “lectura directa de localStorage” en HomeSummary, lo que puede generar inconsistencias si se usa en varias pestañas o se borra storage.
- **Predecibilidad:** Dentro de una vista el flujo es predecible. La **no predecibilidad** aparece en: (1) dependencia de `weatherData` y de que `rawHourly` exista en muchos sitios sin comprobación defensiva uniforme; (2) varios `useEffect` que reaccionan a `weatherData`, `activeTab`, `mapUpdate`, etc., y que actualizan estado local (p. ej. en RouteView, HistoryTab), lo que puede dar dobles renderizados o condiciones de carrera si cambian varias props a la vez.

---

# 3. Hallazgos de “Código Mejorable” (Análisis Milimétrico)

*Solo se señalan problemas; no se proponen soluciones.*

## Redundancias (DRY)

- **Lógica de “ubicación desde coords” y “cargar tiempo”:**
  - En [App.jsx](src/App.jsx), en el `useEffect` de geolocalización (líneas 52–64) y en `handleGPS` (líneas 138–147) se repite: obtener coords → `getLocationFromCoords` → `loadWeatherData(lat, lon, name, …)`. La misma secuencia con y sin nombre formateado y con manejo de error muy similar.
  - En [RouteView.jsx](src/views/RouteView.jsx), `handleMapConfirm` (líneas 117–128) y `handleRouteGPS` (líneas 139–151) repiten el patrón: obtener coords → opcionalmente `getLocationFromCoords` → asignar a `selectedOrigin`/`selectedDest` y `originQuery`/`destQuery`. La construcción del objeto `loc` y el `try/catch` son duplicados.

- **Cálculo de “días de la semana” para selector:**
  - En [RouteView.jsx](src/views/RouteView.jsx) (líneas 90–100) y en [ActivitiesTab.jsx](src/components/ActivitiesTab.jsx) (líneas 87–96) existe un `useMemo` que construye un array de 7 días con `value` (YYYY-MM-DD) y `label` (hoy, mañana o weekday corto). La lógica es la misma; solo cambia el uso (schedule en rutas vs. schedule en actividades).

- **Lectura de actividades personalizadas:**
  - En App se usa `useLocalStorage('my_activities', [])` y se pasa `customActivities` a ActivitiesTab. En [HomeSummary.jsx](src/components/HomeSummary.jsx) (líneas 21–26) se vuelve a leer `localStorage.getItem('my_activities')` y se hace `JSON.parse` manual, y se combina con `PREDEFINED_ACTIVITIES`. Así, la lista “completa” de actividades se construye en dos sitios (ActivitiesTab ya recibe `customActivities` por props; HomeSummary no lo recibe y lee storage directamente).

- **Construcción de `weekDays` / etiquetas de día:**
  - Además del caso anterior, en [HistoryTab.jsx](src/components/HistoryTab.jsx) existe `getWeekRange` y lógica de semanas. No se reutiliza un util común para “día hoy/mañana/resto” entre RouteView, ActivitiesTab e HistoryTab.

- **Evaluación de segmentos y factores:**
  - La priorización y el mapeo a “legacy” se hacen en [riskUtils.js](src/utils/riskUtils.js) y se usan tanto en useRouteWeather (`evaluateSegment` → `prioritizeFactors`, `mapFactorsToLegacy`) como en [activitiesConfig.js](src/utils/activitiesConfig.js) (`generateReport`). No hay redundancia de algoritmo pero sí repetición del patrón “criticals/warnings + sort + map to legacy” en dos flujos (rutas vs. actividades).

- **Mensajes de error de red/timeout:**
  - En [useRouteWeather.js](src/hooks/useRouteWeather.js), en `addWaypoint` (líneas 318–320), `updateWaypoint` (líneas 345–347) y `removeWaypoint` (línea 408) se repite la misma detección de “error de red o timeout” (`msg.includes('Timeout')`, `'Failed to fetch'`, etc.) y la misma decisión de mensaje traducido. Podría extraerse a una función `isNetworkOrTimeout(err)` y `getRouteErrorMessage(err)`.

## Complejidad Ciclomática

- **[useWeather.js](src/hooks/useWeather.js) — `processWeatherData`:**
  - Función muy larga (~170 líneas) con múltiples ramas: cálculo de índices horarios, sanitización de códigos, lógica de “próxima lluvia” (¿llueve ahora?, ¿para cuándo?, ¿nieve?), construcción de `precipitationAlert` (caso “para” vs “empieza”), `hourlyForecast`, etc. Muchos `if/else` y condiciones anidadas. Difícil de seguir y de testear por unidades.

- **[useRouteWeather.js](src/hooks/useRouteWeather.js) — `calculateRoute`:**
  - Orquesta llamadas a getRouteData, obtención de pronósticos en origen/destino/punto medio, construcción de resultado, y luego en segundo plano Smart Safe (findBestTimeSlot + findBestSpatialDetour). Varios `try/catch`, `Promise.all` y lógica condicional según waypoints. La función `removeWaypoint` (líneas 352–411) tiene un bloque enorme: si `waypoints.length === 0` se reconstruye la ruta “a mano” (getRouteData, fetchOpenMeteoForecastRaw x3, merge AQ, getForecastAtTime, construcción de segments y de `info`); si no, se llama a `recalculateWithWaypoints`. Duplicación de lógica con `calculateRoute` / `buildResultFromRouteData`.

- **[RouteView.jsx](src/views/RouteView.jsx):**
  - Más de 350 líneas, muchos `useEffect` (scroll al resultado, al informe, al mapa, inicialización de origen desde weatherData), handlers que mezclan UI y negocio, y render condicional por `resultView` y por existencia de `routeResult` y `segmentKeys`. El componente `TransportOption` está definido dentro del componente; el botón de intercambiar origen/destino (línea 232) es un one-liner con mucha lógica de estado. Dificulta lectura y pruebas.

- **[safetyRules.js](src/utils/safetyRules.js) — `evaluateMoto`, `evaluateCar`, `evaluateWalk`:**
  - Cada evaluador tiene muchas ramas (temperatura, viento, lluvia/nieve/suelo, visibilidad, humedad, AQI). Repetitivo en estructura; cualquier cambio en umbrales o mensajes obliga a tocar varias cadenas de `if/else`. La complejidad no es tanto una sola función incomprensible como la repetición de patrones que podrían ser tablas o pequeños helpers.

- **[RainMapView.jsx](src/views/RainMapView.jsx) — `fetchHybridData` y el `useEffect` de capas (líneas 176–247):**
  - `fetchHybridData` mezcla fetch, normalización de frames, validación de host/path, y actualización de estado. El efecto de crossfade entre capas radar/satélite tiene muchos pasos (limpiar timeouts, crear capas, animar opacidad por pasos). Difícil de seguir sin comentarios y fácil de romper al cambiar el orden de dependencias.

## Deuda Técnica “Heredada”

- **Mezcla de convenciones de nombres y de idioma en UI:**
  - Las claves de traducción y los IDs de pestaña están en español en el código (`'inicio'`, `'colada'`, `'historia'`, `'rutas'`, `'mapa'`). Los textos visibles vienen de i18n (es/en). En [RainMapView.jsx](src/views/RainMapView.jsx) hay cadenas fijas en español: "Cargando Satélites...", "HISTÓRICO (2h)", "Chubasco", "Tormenta", "Nubes", "Desbloquear mapa...", etc. (líneas 283, 299, 311, 354–356). El resto del proyecto usa `t('...')`; esta vista no.

- **Favoritos por defecto:**
  - En [App.jsx](src/App.jsx) línea 43: `useLocalStorage('my_favorites', ['moto', 'running', 'laundry'])`. El valor por defecto está en español/inglés de IDs (`'laundry'`). En otros sitios se usa `activities.laundry` como labelKey. No es inconsistencia grave pero mezcla “id interno” con “colada” como concepto.

- **Dos fuentes de “lista de actividades” en HomeSummary:**
  - HomeSummary no recibe `customActivities` por props y lee `localStorage` directamente. Si en el futuro las actividades se obtuvieran de otro sitio (API, otro storage), habría que cambiar tanto App/ActivitiesTab como HomeSummary. Deuda de diseño: la fuente de verdad debería ser una sola.

- **Uso de `var` en HistoryTab:**
  - En [HistoryTab.jsx](src/components/HistoryTab.jsx) línea 45: `var yearStart = ...` dentro de `getWeekNumber`. El resto del proyecto usa `const`/`let`. Pequeña inconsistencia.

- **Vitest sin TypeScript:**
  - [vite.config.js](vite.config.js) referencia tests en `src/**/*.test.js`. El proyecto es JS/JSX; no hay tipado estático. Cualquier refactor puede romper contratos (props, formas de `weatherData`, `routeResult`) sin que el compilador avise. La única prueba visible es [safetyRules.test.js](src/utils/safetyRules.test.js).

## Puntos Frágiles

- **Falta de validación defensiva de `weatherData`:**
  - En [HomeView.jsx](src/views/HomeView.jsx) se hace `if (!weatherData) return null` pero luego se accede a `weatherData.current.code`, `weatherData.location`, `weatherData.analysis.hourlyForecast`, `weatherData.daily`, etc. sin comprobar que `weatherData.analysis`, `weatherData.analysis.precipitationAlert` o `weatherData.analysis.hourlyForecast` existan. Si la API o `processWeatherData` devolviera una forma incompleta, habría runtime errors.

- **`routeResult` y segmentos:**
  - En RouteView se asume que `routeResult.segments` tiene claves como `origin`, `mid`, `dest` o `wp0`, `wp1`. Si `buildResultWithLegs` o `buildResultFromRouteData` cambiaran la forma de `segments`, el filtro `segmentKeys.filter(seg => seg !== 'dest')` y el mapeo sobre `routeResult.segments[seg]` podrían devolver `undefined` y el código que lee `data.sortedFactors`, `data.colorClass` fallaría sin comprobación.

- **Geocodificación y red:**
  - [getLocationFromCoords](src/utils/geoUtils.js) (Nominatim reverse) puede fallar por red o por límites de uso. En App y RouteView a veces se usa en `try/catch` y se cae a un nombre genérico; en otros sitios no se maneja el rechazo de la promesa. No hay reintentos ni feedback específico “no se pudo obtener el nombre del lugar”.

- **ErrorBoundary:**
  - [ErrorBoundary.jsx](src/components/ErrorBoundary.jsx) envuelve el contenido cuando hay `weatherData` (App.jsx línea 265). Si el error ocurre antes de tener `weatherData` (p. ej. en la barra de búsqueda o en el estado inicial), no está envuelto por el boundary. Además, el boundary recibe `t` por props desde un componente funcional que usa `useTranslation()`; funciona pero es un patrón poco habitual.

- **RainViewer:**
  - [RainMapView.jsx](src/views/RainMapView.jsx) asume que la API de RainViewer devuelve una estructura con `radar.past`, `satellite.infrared`, `host`, `generated`. Si la API cambiara o devolviera vacío, `unifiedFrames` podría ser vacío y los estados `frames`/`currentIndex` quedarían en valores que el efecto de capas no contempla de forma explícita en todos los caminos.

- **IndexedDB:**
  - [storageUtils.js](src/utils/storageUtils.js): si `openHistoryDB()` falla o la transacción falla, se devuelve `null` o se hace `resolve(null)` en onerror. Quien consume (HistoryTab) debe comprobar null; no hay convención clara de “error” vs “no hay datos”.

---

# 4. Auditoría de Seguridad y Performance (Observacional)

## Riesgos Visibles

- **API Keys:**
  - ORS: La clave de direcciones se usa solo en el servidor ([api/ors-directions.js](api/ors-directions.js)) vía `process.env.ORS_API_KEY`; el cliente llama al proxy `/api/ors-directions`. Correcto.
  - Geocodificación: [.env.example](.env.example) documenta `VITE_ORS_API_KEY` para el cliente. Si se define, la clave se embebe en el bundle (Vite incluye `import.meta.env.VITE_*` en el build). Riesgo moderado: quien inspeccione el bundle puede ver la clave. Nominatim se usa sin clave.
  - Open-Meteo y RainViewer: llamadas directas desde el cliente sin API key (APIs públicas). No hay credenciales expuestas ahí.

- **Datos sensibles:**
  - No se almacenan contraseñas ni datos personales. localStorage e IndexedDB contienen preferencias (favoritos, actividades) e histórico climático por coordenadas. No se considera crítico, pero el histórico podría revelar patrones de ubicación del usuario.

- **Endpoints:**
  - El proxy ORS solo acepta POST; valida body (profile, coordinates). No se ve validación de tamaño máximo de body ni rate limiting en el código; eso quedaría en la plataforma (Vercel).

- **CORS:**
  - En [api/ors-directions.js](api/ors-directions.js) se hace `res.setHeader('Access-Control-Allow-Origin', origin)` con el origin de la request. Cualquier origen que conozca la URL del API podría enviar peticiones. En producción suele restringirse a dominios concretos.

## Sospechas de Performance

- **Re-renders:**
  - App tiene mucho estado; cualquier `setState` re-renderiza App y todos los hijos. Las vistas reciben `weatherData` y varios callbacks. No se ve `React.memo` en vistas ni en componentes pesados (p. ej. RouteMapView, lista de segmentos). Cambios en `activeTab` o en estado de mapa/favoritos pueden provocar re-renders de vistas que no están visibles.

- **useEffect y scroll:**
  - En RouteView hay varios `useEffect` que hacen `scrollIntoView` con `setTimeout`. Dependen de `routeResult`, `resultView`, `spatialRoute`. Si estos cambian seguido, se encolan varios timeouts y scrolls. Impacto menor pero ruidoso en DevTools.

- **Búsqueda de ubicación:**
  - [LocationSearchInput.jsx](src/components/LocationSearchInput.jsx) usa debounce de 800 ms y, según configuración, llama a Nominatim y/o ORS. Cada tecla no dispara petición (bien). Pero si el usuario cambia de pestaña y el dropdown sigue abierto, el efecto que depende de `query` y `isOpen` puede seguir ejecutándose. No se cancela la petición anterior con AbortController.

- **Historial:**
  - HistoryTab hace fetch de Open-Meteo histórico y guarda en IndexedDB por clave de ubicación. La descarga es por semana/ubicación. No se ve paginación ni límite de cuántas semanas se guardan; a largo plazo el almacenamiento podría crecer.

- **Mapas:**
  - Leaflet se usa en MapSelector, RouteMapView y RainMapView. Cada vista que monta un mapa crea/destruye instancia en useEffect. Si el usuario cambia de pestaña con frecuencia, el ciclo crear/destruir mapa puede ser costoso. RainMapView además hace polling cada 5 min (300000 ms) para refrescar datos y tiene animación de frames cada 500 ms cuando está en play.

- **Bundle:**
  - [vite.config.js](vite.config.js) sube `chunkSizeWarningLimit` a 1600. Indica que hay chunks grandes (probablemente Leaflet, Recharts, Lottie, etc.). No se ha comprobado lazy loading de rutas o de vistas; todas las vistas se importan directamente en App, por lo que la pestaña “Rutas” o “Mapa” carga su código aunque el usuario no entre nunca.

---

# 5. Veredicto Final del Estado Actual

- **Resumen en 3 líneas:**  
  La aplicación cumple su función: clima, actividades, rutas con tiempo y mapa de lluvia, con una arquitectura clara por capas (vistas, hooks, utils) y una buena centralización de reglas de seguridad y evaluación en `safetyRules` y `riskUtils`. Sin embargo, el estado y la lógica están muy concentrados en App y en unos pocos hooks y vistas (RouteView, useRouteWeather, useWeather), con duplicación de lógica (geocoding, días de la semana, lectura de actividades), puntos frágiles ante datos incompletos o APIs cambiantes, y vistas muy largas y con alta complejidad ciclomática que dificultan el mantenimiento y las pruebas.

- **Nivel de mantenibilidad actual:** **Medio.**  
  - **Por qué no es Alto:** Mucha lógica en pocos archivos, repetición de patrones (DRY), strings hardcodeados en una vista (RainMapView), acceso directo a localStorage en un componente que ya recibe datos por props en otro flujo, y falta de tests y de tipado estático.  
  - **Por qué no es Bajo:** La separación views/components/hooks/utils es respetada, el barrel de helpers y la división en weatherUtils, timeUtils, geoUtils, routeUtils, storageUtils, safetyRules y activitiesConfig permiten localizar responsabilidades, y no hay caos de estado global (todo pasa por App). Con refactor puntuales (extraer lógica repetida, validaciones defensivas, i18n en RainMapView, tests en hooks críticos) la mantenibilidad podría subir a Alto.

---

*Fin del diagnóstico. Documento generado por auditoría forense del codebase; no incluye cambios de código.*
