# DIAGNÓSTICO INTEGRAL — mi-clima-app
**Fecha:** 2026-02-08  
**Tipo:** Auditoría forense de software (ingeniería inversa sobre el codebase)

---

# 1. Anatomía del Negocio (Para No Técnicos)

## Propósito de la Aplicación

**Mi-clima-app** es una aplicación móvil-first de **clima y planificación basada en el tiempo**. Resuelve el problema de **decidir cuándo y cómo hacer actividades que dependen del tiempo** (salir en moto, correr, tender la ropa, hacer una ruta en coche o a pie) ofreciendo:

- El tiempo actual e interpolado para una ubicación (GPS o búsqueda).
- Recomendaciones por actividad (verde / amarillo / rojo) según temperatura, viento, lluvia, humedad, visibilidad y calidad del aire.
- Análisis de rutas (origen → destino) con clima en salida, en ruta y en llegada, y sugerencias de “mejor hora” o “ruta más segura” si las condiciones son malas.
- Un mapa de radar/satélite histórico (RainViewer) y una pestaña de **clima histórico** (datos desde 1950) con tendencias.

En una frase: **ayuda al usuario a elegir el mejor momento y lugar para actividades sensibles al clima, con criterios de seguridad y comodidad.**

---

## Actores y Roles (inferidos del código)

| Actor | Rol inferido | Evidencia en código |
|-------|----------------|---------------------|
| **Usuario final** | Único actor explícito. Sin login ni roles: toda la app es uso anónimo/local. | No hay auth, ni API de usuarios; estado en `localStorage` (`my_activities`, `my_favorites`). |
| **Sistema** | Provee datos (Open-Meteo, OpenRouteService/OSRM, Nominatim, RainViewer, Air Quality API). | [src/hooks/useWeather.js](src/hooks/useWeather.js), [src/utils/helpers.js](src/utils/helpers.js) (ORS/OSRM, Nominatim). |
| **Visitante** | Coincide con Usuario: quien abre la app es “visitante” y “usuario” a la vez. | Una sola entrada: `App.jsx`; no hay rutas protegidas ni diferenciación. |

No existe en el código ningún rol de **Admin**, **Moderador** ni **Usuario registrado**. La aplicación es 100% cliente: sin backend propio ni gestión de identidad.

---

## Narrativa del Flujo Principal

**Paso a paso (usuario tipo: “quiero saber si puedo salir en moto o tender la ropa”):**

1. **Arranque.** La app pide ubicación al navegador. Si el usuario acepta, obtiene coordenadas GPS, las convierte en nombre de lugar (Nominatim) y carga el tiempo para esa ubicación. Si deniega, muestra un aviso y una barra de búsqueda para escribir ciudad.
2. **Pantalla principal (Inicio).** Se muestra temperatura (interpolada cada minuto), sensación térmica, estado del cielo, próxima lluvia/nieve, alerta de precipitación inminente, sol/luna y una fila de “actividades favoritas” (moto, running, colada, etc.) con color verde/amarillo/rojo según reglas de negocio. El usuario puede tocar una actividad para ver el análisis detallado en un modal.
3. **Cambio de lugar.** El usuario puede buscar otra ciudad en la barra, usar “mi ubicación” de nuevo o elegir un punto en el mapa. Al confirmar, se vuelve a cargar el tiempo para esa ubicación y toda la app (Inicio, Actividades, Rutas, etc.) usa esa ubicación como referencia.
4. **Actividades (“Colada”).** En la pestaña “Actividades” puede ver todas las actividades (predefinidas + personalizadas), marcar favoritos (máx. 4 en el resumen de Inicio), programar fecha/hora y ver “mejor momento” sugerido. Puede crear actividades custom (nombre, duración, icono, reglas) y guardarlas; todo se persiste en `localStorage`.
5. **Rutas.** En “Rutas” el usuario elige origen y destino (búsqueda, mapa o GPS), modo (moto, coche, bici, andar), “salir ya” o “programar” día/hora. La app calcula la ruta (ORS o OSRM), pide tiempo en origen, punto medio y destino, y muestra un informe por segmentos (verde/amarillo/rojo) y un mapa con la polilínea. Si las condiciones son malas, en segundo plano se buscan “mejor hora” o “ruta más segura” (desvío espacial); el usuario puede aplicar esa alternativa desde el mapa.
6. **Mapa radar y Historia.** En “Radar” se muestra un mapa Leaflet con capas RainViewer (radar + satélite) animadas. En “Retro” se elige ubicación y se descargan datos históricos (Open-Meteo Archive desde 1950), se muestran gráficos y tendencias (temperatura/precipitación); los datos se cachean en IndexedDB por celda de ~10 km.

No hay flujo de pago, registro ni permisos más allá de geolocalización y almacenamiento local.

---

# 2. Análisis de Coherencia y Arquitectura

## Estructura Real vs. Ideal

- **Estructura actual:** Organización por **tipo de archivo**: `components/`, `views/`, `hooks/`, `utils/`, `i18n/`. Dentro de `components/` hay un subdirectorio `ui/` (botones, iconos, tarjetas) y el resto son componentes de dominio (ActivitiesTab, RouteMapView, etc.) mezclados en el mismo nivel.
- **Semántica:** Tiene sentido a nivel alto (vistas vs componentes reutilizables), pero:
  - **Views** son contenedores por pestaña (Home, Rutas, Radar, Historia); **ActivitiesTab** es a la vez “vista” de la pestaña Colada y está en `components/`, lo que rompe la regla “una pestaña = una vista”.
  - No hay carpetas por **feature** (p. ej. `features/weather/`, `features/routes/`, `features/activities/`). Toda la lógica de rutas está repartida entre `useRouteWeather.js`, `helpers.js` (getRouteData, ORS, OSRM), `smartRouteLogic.js` y `RouteView.jsx`/`RouteMapView.jsx`.
- **Veredicto:** La estructura es legible pero **híbrida**: por tipos con algo de agrupación UI. Para escalar, una organización por features reduciría el acoplamiento entre “rutas”, “actividades” y “clima”.

---

## Acoplamiento

- **App.jsx** es el núcleo: concentra estado global (weatherData, query, activeTab, mapPicker, favorites, customActivities), handlers de ubicación (GPS, mapa, búsqueda), y renderizado condicional por pestaña. Cualquier cambio en flujo de ubicación o en qué vista recibe qué props implica tocar `App.jsx`. Es un **componente orquestador con demasiadas responsabilidades**.
- **useWeather.js** y **useRouteWeather.js** están desacoplados entre sí (el segundo no usa el primero), pero **useRouteWeather** duplica lógica de clima: su propio `fetchRawAPI`, `fetchAirQuality` y `mergeAirQualityIntoHourly` ([useRouteWeather.js](src/hooks/useRouteWeather.js) líneas 41–84) replican lo que ya hace `useWeather.js`. Cambiar formato de API o añadir un modelo más obligaría a tocar ambos sitios.
- **helpers.js** es un **archivo “god”**: geocodificación (Nominatim + ORS), rutas (ORS + OSRM), clima (getWeatherInfo, sanitizeCode), tiempo (getIndexOfCurrentTime, interpolateHourlyValue, moon), histórico (IndexedDB + localStorage), geometría de polilíneas (pointAlongRoute, fractionAlongPolyline, etc.). Cualquier refactor de “dónde vive la lógica de rutas” o “dónde vive el clima” choca con este archivo.
- **activitiesConfig.js** y **useRouteWeather.js** comparten concepto de “evaluar segmento” (factores verde/amarillo/rojo) pero con implementaciones distintas: `evaluateMotoLike` / `evaluateCar` / `evaluateWalk` en el hook vs `evaluateMotoActivity` / `evaluateStandardActivity` / `evaluateLaundryActivity` en activitiesConfig. Los umbrales (ROUTE_LIMITS vs SAFETY_LIMITS) están duplicados y pueden divergir.
- **RouteView.jsx** conoce en detalle la forma de `routeResult` (segments, waypoints, midCoords, depDate, routeGeometry), del hook y de `RouteMapView`. Un cambio en la estructura de `routeResult` obliga a sincronizar hook, vista y mapa.

---

## Gestión de Estado y Datos

- **Estado global (App):** Un único nivel: `weatherData`, `query`, `activeTab`, `showMapPicker`, `mapTarget`, `mapCenter`, `customActivities`, `favorites`, `historyMapUpdate`, `gpsError`, `tryingInitialLocation`, `locationDeniedOrFailed`. No hay Context API ni store externo; todo se pasa por props y callbacks. El flujo es **predecible pero verboso**: para que Historia o Rutas tengan la ubicación actual, dependen de que App les pase `weatherData.location` o `initialLat/Lon`.
- **Persistencia:** Dos mecanismos: `useLocalStorage` para `my_activities` y `my_favorites`, y lectura directa de `localStorage.getItem('my_activities')` en [HomeSummary.jsx](src/components/HomeSummary.jsx) (líneas 21–24). Es decir, **dos fuentes de verdad** para actividades personalizadas: el estado de App (vía `customActivities`) y el localStorage leído en HomeSummary. Si en el futuro otro componente lee `my_activities` sin pasar por App, puede haber desincronización.
- **Datos de clima:** Fluyen en una sola dirección: `useWeather` → `App` → vistas. Las rutas no reutilizan `weatherData`; **useRouteWeather** hace sus propias peticiones a Open-Meteo y Air Quality. Así se evita acoplar rutas al lugar “actual” del Home (correcto para origen/destino distintos), pero se duplica lógica de fetch y merge de AQI.
- **Resumen:** El flujo de datos es entendible (arriba → abajo), pero hay **duplicación de origen de datos** (clima en dos hooks, actividades en estado + localStorage en HomeSummary) y **archivos que concentran demasiado** (helpers.js, App.jsx).

---

# 3. Hallazgos de “Código Mejorable” (Análisis Milimétrico)

## Redundancias (DRY)

- **Fetch de clima + AQI y merge:** En [useWeather.js](src/hooks/useWeather.js) están `fetchAPI`, `fetchAirQuality`, `mergeAirQualityIntoHourly` y `processWeatherData`. En [useRouteWeather.js](src/hooks/useRouteWeather.js) (líneas 41–84) se repiten `fetchRawAPI`, `fetchAirQuality` y `mergeAirQualityIntoHourly` con otra URL de Open-Meteo (menos parámetros) y timeout/reintentos. Cualquier cambio en cabeceras, manejo de errores o formato de AQI debe hacerse en dos sitios.
- **Evaluación “moto” (factores verde/amarillo/rojo):** Lógica muy similar en [useRouteWeather.js](src/hooks/useRouteWeather.js) (`evaluateMotoLike`, `evaluateCar`, `evaluateWalk`) y en [activitiesConfig.js](src/utils/activitiesConfig.js) (`evaluateMotoActivity`, `evaluateStandardActivity`, `evaluateLaundryActivity`). Umbrales (viento, lluvia, temperatura, visibilidad) definidos en `ROUTE_LIMITS` y en `SAFETY_LIMITS` por separado; riesgo de que moto “en ruta” y moto “en actividades” den resultados distintos para los mismos datos.
- **Geocodificación inversa (Nominatim):** El patrón “llamar a Nominatim con lat/lon y formatear con `formatStandardLocation`” aparece en [App.jsx](src/App.jsx) (inicialización GPS, handleGPS, handleMapConfirm), en [RouteView.jsx](src/views/RouteView.jsx) (handleMapConfirm, handleRouteGPS) y potencialmente en más sitios. No hay una función única del tipo `reverseGeocode(lat, lon) -> { name, country }`.
- **Días de la semana para selector:** En [RouteView.jsx](src/views/RouteView.jsx) (líneas 90–99) y en [ActivitiesTab.jsx](src/components/ActivitiesTab.jsx) (líneas 87–97) se construye un array `weekDays` con “Hoy”, “Mañana” y fechas; la lógica es casi idéntica. Solo cambia el uso de `i18n.language` en uno y la clave de traducción en otro (“Hoy”/“Mañana” hardcodeado en RouteView).
- **getWeatherInfo:** Definido en [helpers.js](src/utils/helpers.js) y re-exportado desde [useWeather.js](src/hooks/useWeather.js). [ActivitiesTab.jsx](src/components/ActivitiesTab.jsx) importa desde `../hooks/useWeather` y [HomeView.jsx](src/views/HomeView.jsx) desde `../utils/helpers`. Uso correcto pero **origen de la verdad repartido** (el helper está en helpers; el re-export en el hook puede inducir a pensar que “el clima vive en useWeather”).

---

## Complejidad Ciclomática

- **useWeather.js — `processWeatherData`:** Función muy larga (~160 líneas) con múltiples ramas: cálculo de índices horarios, sanitización de códigos, texto de “próxima lluvia”, lógica de alerta de precipitación (caso “ya llueve” vs “va a llover”), construcción de `hourlyForecast`, astro, etc. Difícil de seguir y de testear en unidad.
- **useRouteWeather.js — `calculateRoute`:** Flujo largo con varias etapas: obtener ruta, calcular punto medio, pedir clima origen/destino/medio, montar resultado, y en paralelo lanzar “smart safe” (mejor hora + desvío espacial). Luego `removeWaypoint` (líneas 428–458) tiene un bloque enorme que reconstruye una ruta “sin waypoints” duplicando la lógica de fetch de clima para origen/mid/dest. Ambas funciones serían candidatas a extraer subfunciones con nombres claros.
- **helpers.js — `getRouteData`:** Decide si usar primero OSRM o ORS según modo (walk/bicycle vs car/moto), y en caso de fallo hace fallback al otro. La condición de “reintentar con ORS” y el manejo de errores (429, timeout, etc.) aumentan ramas y longitud. La lectura se complica por mezclar responsabilidad “estrategia de proveedor” con “obtener una ruta”.
- **activitiesConfig.js — `checkActivityRules`:** Construye un objeto `analysisData` grande a partir de `hourlyData` y luego delega a uno de tres evaluadores. La preparación de datos (interpolación, suelo mojado, código sanitizado) y la matriz de reglas por tipo de actividad hacen que el archivo sea denso; un desarrollador nuevo tarda en ver qué regla aplica a qué actividad.

---

## Deuda Técnica “Heredada”

- **README.md:** Sigue siendo el del template **React + Vite** (sin describir mi-clima-app). No hay documentación de negocio ni de arquitectura en el repo.
- **Mezcla de idiomas en UI:** En [RouteView.jsx](src/views/RouteView.jsx) hay cadenas en español hardcodeadas: “¿A dónde vas?”, “Programar”, “Destino”, “Análisis del trayecto”, “Hoy”, “Mañana”, etiquetas de segmentos “Salida”, “Llegada”, “En ruta 1”. El resto de la app usa `t('...')` con i18n. Inconsistencia clara.
- **Nombres de segmentos en inglés en código, español en UI:** En `useRouteWeather.js` se usan claves como `'Salida'`, `'Llegada'`, `'En ruta 1'` en español dentro de `buildResultWithLegs` / `buildResultFromRouteData`, mientras que en otros puntos se usan claves i18n (`t('routes.departure')`, etc.). Mezcla de fuentes de texto.
- **Deprecación no resuelta:** En [helpers.js](src/utils/helpers.js) (líneas 34–38) existe `NOMINATIM_HEADERS` marcado como `@deprecated` en favor de `getNominatimHeaders()`, pero el objeto estático sigue en el archivo; si algo lo usara, mantendría locale fijo.
- **modelConsensus.js:** Módulo completo para “consenso de modelos” (ECMWF, GFS, ICON) con `buildConsensusUrl` y lógica de confianza. **No está importado en ningún otro archivo** del proyecto. Código muerto o funcionalidad abandonada; genera confusión sobre si el pronóstico usa uno o varios modelos.
- **Fichero `openrouteservice.env`:** Está en [src/openrouteservice.env](src/openrouteservice.env) con una clave API en claro. Vite no carga por defecto ficheros `.env` con ese nombre; lo estándar sería `.env` o `.env.local` (y este último en `.gitignore`). Tener un archivo con nombre “env” y clave dentro en `src/` es riesgo de que se suba al repositorio o se exponga por error.

---

## Puntos Frágiles

- **Confirmación de borrado:** En [App.jsx](src/App.jsx) (línea 93) se usa `confirm(t('activities.deleteConfirm'))` para borrar actividad. Depende del `confirm()` nativo del navegador; en entornos controlados o sin UI nativa puede no existir o no ser accesible.
- **Manejo de errores silencioso:** En [RouteView.jsx](src/views/RouteView.jsx) (línea 127) `catch(e) {}` vacío al hacer reverse geocode en `handleMapConfirm`; si Nominatim falla, se usa `t('location.pointMap')` sin informar al usuario. En [useRouteWeather.js](src/hooks/useRouteWeather.js) (líneas 386–388) `.catch(() => {})` en la promesa de “smart safe” hace que cualquier fallo en mejor hora / desvío espacial pase desapercibido.
- **Dependencia de `weatherData` en vistas:** Si por un bug o race condition `weatherData` es null cuando ya se dejó de mostrar “cargando”, varias vistas asumen `weatherData.location` o `weatherData.rawHourly`. En [App.jsx](src/App.jsx) el contenido principal con vistas se renderiza solo cuando `weatherData && !loading`, pero el orden de efectos (p. ej. cambio de pestaña antes de que llegue el nuevo weatherData) podría dejar estados intermedios no contemplados.
- **Validación de entrada en búsqueda / mapa:** No se ve validación explícita de que `lat`/`lon` sean números dentro de rangos válidos antes de llamar a APIs; si un componente pasa `undefined` o un string, el error puede propagarse en fetch o en cálculos geométricos (p. ej. en `pointAlongRoute` o en `getRouteData`).
- **HomeSummary y localStorage:** Lee `localStorage.getItem('my_activities')` directamente. Si otra pestaña o instancia modifica esa clave, HomeSummary no se re-renderiza hasta que cambie algo más (p. ej. weatherData). Además, duplica la fuente de verdad respecto a `customActivities` de App.

---

# 4. Auditoría de Seguridad y Performance (Observacional)

## Riesgos Visibles

- **Clave API en repositorio:** El archivo [src/openrouteservice.env](src/openrouteservice.env) contiene `VITE_ORS_API_KEY=eyJ...`. Aunque `.env` y `.env.local` están en [.gitignore](.gitignore), **openrouteservice.env** no tiene el nombre estándar y está dentro de `src/`. Si se versiona, la clave queda expuesta. Debe usarse `.env.local` (o similar) en la raíz y asegurarse de que no se suba.
- **Claves en el cliente:** Cualquier variable `VITE_*` se incluye en el bundle del cliente. La API key de ORS se envía en cabecera `Authorization` desde el navegador; es el modelo esperado para APIs públicas con cuota por clave, pero implica que quien inspeccione el bundle puede reutilizar la clave. No hay backend que oculte la clave.
- **Nominatim / ORS:** Las peticiones se hacen desde el cliente con User-Agent y Accept-Language. No hay capa que sanitice entrada; si en el futuro la búsqueda se construye con datos no controlados, podría haber riesgo de inyección en URL. Hoy el query viene del input del usuario (debounced), riesgo bajo pero a tener en cuenta.
- **RainViewer:** En [RainMapView.jsx](src/views/RainMapView.jsx) hay whitelist de hosts y validación de path para no cargar URLs arbitrarias; buena práctica defensiva.

---

## Sospechas de Performance

- **Re-renders:** App tiene mucho estado; cualquier `setState` (p. ej. al mover el mapa, al escribir en búsqueda antes del debounce) puede re-renderizar todo el árbol. No se ve `React.memo` ni uso sistemático de `useMemo`/`useCallback` en hijos pesados (p. ej. RouteMapView con Leaflet, RainMapView con muchas capas).
- **useRouteWeather — múltiples fetch:** Para una ruta origen→destino se hacen al menos 3 peticiones de clima (origen, destino, punto medio) más 3 de AQI. Si se añaden waypoints, el número crece. No hay caché por coordenadas; dos rutas con el mismo destino volverán a pedir el mismo clima.
- **useEffect en App (inicialización GPS):** El efecto que pide geolocalización tiene array de dependencias `[]` pero usa `loadWeatherData` y `t`; si esas referencias cambian, el efecto no se re-ejecuta (correcto para “solo al montar”), pero `loadWeatherData` no está en la lista (habitual con funciones estables del hook). No es un bug de performance pero sí un patrón que puede generar dudas.
- **Historia (IndexedDB):** Se cachea por `getClimateKey(lat, lon)` (redondeo a 1 decimal, ~10 km). Una sola petición por celda y caducidad de 30 días está bien; el coste es la descarga inicial desde 1950 para una celda nueva.
- **Animación RainViewer:** Interval de 500 ms para avanzar de frame y crossfade de capas; razonable. El polling cada 5 min para refrescar datos puede solaparse con navegación si el usuario cambia de pestaña; no se observa cancelación explícita por desmontaje en ese intervalo (aunque el componente se desmonte y el interval quede huérfano hasta el cleanup del efecto que lo creó, depende del orden de efectos).

---

# 5. Veredicto Final del Estado Actual

- **Robustez:** La aplicación cumple su función y integra bien clima, actividades, rutas y radar con lógica de negocio rica (sanitización de códigos, interpolación, smart safe, histórico). La robustez se resiente por **duplicación de lógica** (clima en dos hooks, evaluación moto en dos sitios), **manejo de errores silencioso** en varios puntos y **una fuente de verdad duplicada** para actividades (estado + localStorage en HomeSummary). No hay tests automatizados visibles en el repo, por lo que regresiones son probables ante refactors.
- **Mantenibilidad:** **Media.** Un desarrollador nuevo puede seguir el flujo general (App → vistas → hooks) y los nombres de archivos son claros, pero **helpers.js** y **useRouteWeather.js** son pesados y acoplados; cambiar una regla de negocio (p. ej. umbral de viento para moto) exige buscar en varios archivos. La mezcla de cadenas i18n y texto fijo en español, el módulo `modelConsensus.js` sin usar y el archivo `openrouteservice.env` en `src/` añaden ruido y riesgo.
- **Nivel de mantenibilidad actual: Medio.** Motivos: estructura de carpetas aceptable pero no por features; estado predecible pero concentrado en App; lógica de negocio repartida y duplicada entre hooks y utils; deuda de i18n y de manejo de errores; posible fuga de credenciales si no se corrige el uso de env. Con una pasada de consolidación (un solo origen para clima en rutas, un solo conjunto de umbrales para “moto”, i18n completo, env fuera de `src/` y documentación mínima), la mantenibilidad subiría a **Alta**.

---

## Enlaces rápidos a archivos citados

| Descripción | Ruta |
|-------------|------|
| Punto de entrada y orquestación | [src/App.jsx](src/App.jsx) |
| Hook de clima principal | [src/hooks/useWeather.js](src/hooks/useWeather.js) |
| Hook de rutas y clima en ruta | [src/hooks/useRouteWeather.js](src/hooks/useRouteWeather.js) |
| Utilidades (geocoding, rutas, clima, histórico) | [src/utils/helpers.js](src/utils/helpers.js) |
| Reglas de actividades y factores | [src/utils/activitiesConfig.js](src/utils/activitiesConfig.js) |
| Lógica “mejor hora” / “ruta más segura” | [src/utils/smartRouteLogic.js](src/utils/smartRouteLogic.js) |
| Priorización de factores | [src/utils/riskUtils.js](src/utils/riskUtils.js) |
| Vista Rutas | [src/views/RouteView.jsx](src/views/RouteView.jsx) |
| Mapa de ruta (Leaflet) | [src/components/RouteMapView.jsx](src/components/RouteMapView.jsx) |
| Resumen de actividades en Inicio | [src/components/HomeSummary.jsx](src/components/HomeSummary.jsx) |
| Módulo no usado | [src/utils/modelConsensus.js](src/utils/modelConsensus.js) |
| Archivo con clave API | [src/openrouteservice.env](src/openrouteservice.env) |
