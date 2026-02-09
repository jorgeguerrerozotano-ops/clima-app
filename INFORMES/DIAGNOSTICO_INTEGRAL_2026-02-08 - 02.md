# DIAGNÓSTICO INTEGRAL — mi-clima-app (Auditoría Forense #02)

**Fecha:** 2026-02-08  
**Tipo:** Auditoría forense de software (ingeniería inversa sobre el codebase). Sin correcciones; solo diagnóstico descriptivo y crítico.

---

# 1. Anatomía del Negocio (Para No Técnicos)

## Propósito de la Aplicación

**mi-clima-app** es una aplicación **clima + planificación** que resuelve un problema concreto: **saber si es buen momento para hacer una actividad que depende del tiempo** (salir en moto, correr, tender la ropa, hacer una ruta). La app muestra el tiempo actual y previsto para una ubicación, evalúa actividades con semáforos (verde/amarillo/rojo), analiza rutas con clima en origen, en ruta y en destino, sugiere “mejor hora” o “ruta más segura” cuando las condiciones son malas, y ofrece un mapa de radar y un histórico climático. En una frase: **ayuda al usuario a decidir cuándo y dónde hacer actividades sensibles al clima, con criterios de seguridad y comodidad.**

## Actores y Roles (inferidos del código)

| Actor | Rol inferido | Evidencia |
|-------|----------------|-----------|
| **Usuario final** | Único actor. Sin login ni roles; uso anónimo y local. | No hay auth; estado en `localStorage` (`my_activities`, `my_favorites`). [App.jsx](src/App.jsx) líneas 42-43. |
| **Sistema** | Provee datos externos (Open-Meteo, ORS/OSRM, Nominatim, RainViewer, Air Quality). | [useWeather.js](src/hooks/useWeather.js), [routeUtils.js](src/utils/routeUtils.js), [geoUtils.js](src/utils/geoUtils.js). |
| **Visitante** | Coincide con Usuario: quien abre la app es a la vez visitante y usuario. | Una sola entrada en [main.jsx](src/main.jsx); no hay rutas protegidas ni roles. |

No existe **Admin**, **Moderador** ni **Usuario registrado**. La aplicación es 100% cliente; no hay backend propio ni gestión de identidad.

## Narrativa del Flujo Principal

Recorrido del usuario más importante (“quiero saber si puedo salir en moto o tender la ropa”), paso a paso y sin tecnicismos:

1. **Arranque.** La app pide ubicación al navegador. Si el usuario acepta, obtiene coordenadas GPS, las convierte en nombre de lugar (Nominatim) y carga el tiempo para esa ubicación. Si deniega, muestra un aviso y una barra de búsqueda para escribir ciudad.
2. **Pantalla principal (Inicio).** Se muestra temperatura (interpolada cada minuto), sensación térmica, estado del cielo, próxima lluvia/nieve, alerta de precipitación inminente, sol/luna y una fila de “actividades favoritas” (moto, running, colada, etc.) con color verde/amarillo/rojo. El usuario puede tocar una actividad para ver el análisis detallado en un modal.
3. **Cambio de lugar.** El usuario puede buscar otra ciudad en la barra, usar “mi ubicación” de nuevo o elegir un punto en el mapa. Al confirmar, se vuelve a cargar el tiempo para esa ubicación y toda la app usa esa ubicación como referencia.
4. **Actividades (“Colada”).** En la pestaña Actividades ve todas las actividades (predefinidas + personalizadas), puede marcar favoritos (máx. 4 en Inicio), programar fecha/hora y ver “mejor momento” sugerido. Puede crear actividades custom; todo se persiste en `localStorage`.
5. **Rutas.** En Rutas el usuario elige origen y destino (búsqueda, mapa o GPS), modo (moto, coche, bici, andar), “salir ya” o “programar” día/hora. La app calcula la ruta (ORS o OSRM), pide tiempo en origen, punto medio y destino, y muestra un informe por segmentos (verde/amarillo/rojo) y un mapa con la polilínea. Si las condiciones son malas, en segundo plano se buscan “mejor hora” o “ruta más segura”; el usuario puede aplicar esa alternativa desde el mapa.
6. **Mapa radar y Historia.** En Radar se muestra un mapa con capas RainViewer (radar + satélite) animadas. En Retro se elige ubicación y se descargan datos históricos (Open-Meteo Archive desde 1950), con gráficos y tendencias; los datos se cachean en IndexedDB por celda de ~10 km.

No hay flujo de pago, registro ni permisos más allá de geolocalización y almacenamiento local.

---

# 2. Análisis de Coherencia y Arquitectura

## Estructura Real vs. Ideal

- **Estructura actual:** Organización por **tipo de archivo**: `components/`, `views/`, `hooks/`, `utils/`, `i18n/`. Dentro de `components/` hay `ui/` (botones, iconos, tarjetas) y el resto son componentes de dominio (ActivitiesTab, RouteMapView, etc.) en el mismo nivel.
- **Semántica:** Tiene sentido a nivel alto (vistas vs componentes reutilizables), pero:
  - **ActivitiesTab** es la “vista” de la pestaña Colada y está en `components/`, mientras que Home, Rutas, Radar y Historia están en `views/`. No hay regla clara “una pestaña = una vista”.
  - No hay carpetas por **feature** (p. ej. `features/weather/`, `features/routes/`). La lógica de rutas está repartida entre [useRouteWeather.js](src/hooks/useRouteWeather.js), [routeUtils.js](src/utils/routeUtils.js), [smartRouteLogic.js](src/utils/smartRouteLogic.js), [safetyRules.js](src/utils/safetyRules.js) y [RouteView.jsx](src/views/RouteView.jsx) / [RouteMapView.jsx](src/components/RouteMapView.jsx).
- **Veredicto:** La estructura es legible pero **híbrida**: por tipos con algo de agrupación UI. Para escalar, una organización por features reduciría el acoplamiento entre rutas, actividades y clima.

## Acoplamiento

- **[App.jsx](src/App.jsx)** es el núcleo: concentra estado global (weatherData, query, activeTab, mapPicker, favorites, customActivities), handlers de ubicación (GPS, mapa, búsqueda) y renderizado condicional por pestaña. Cualquier cambio en flujo de ubicación o en qué vista recibe qué props implica tocar App. Es un **orquestador con demasiadas responsabilidades**.
- **useWeather.js** y **useRouteWeather.js** están desacoplados entre sí (el segundo no usa el primero), pero **useRouteWeather** duplica lógica de clima: su propio `fetchRawAPI`, `fetchAirQuality` y `mergeAirQualityIntoHourly` ([useRouteWeather.js](src/hooks/useRouteWeather.js) líneas 11-54) replican lo que ya hace [useWeather.js](src/hooks/useWeather.js). Cambiar formato de API o añadir un modelo obligaría a tocar ambos sitios.
- **[helpers.js](src/utils/helpers.js)** es un **barrel**: re-exporta desde geoUtils, weatherUtils, timeUtils, routeUtils, storageUtils. El “código real” vive en esos módulos; helpers solo centraliza imports. Eso está bien, pero **cualquier refactor de “dónde vive la lógica”** (rutas, clima, tiempo) sigue pasando por este archivo como punto de entrada; la dependencia conceptual sigue alta.
- **activitiesConfig.js** y **useRouteWeather.js** comparten el concepto de “evaluar segmento” (factores verde/amarillo/rojo) pero con implementaciones distintas: en el hook se usa `evaluateMoto`, `evaluateCar`, `evaluateWalk` desde [safetyRules.js](src/utils/safetyRules.js); en activitiesConfig se usan `evaluateMotoActivity`, `evaluateStandardActivity`, `evaluateLaundryActivity`. Los umbrales están centralizados en `SAFETY_LIMITS` en safetyRules, pero la **lógica de informe** (generateReport, status/message) se repite en activitiesConfig y en el hook (evaluateSegment). Cambiar un mensaje o un color implica revisar ambos.
- **[RouteView.jsx](src/views/RouteView.jsx)** conoce en detalle la forma de `routeResult` (segments, waypoints, midCoords, depDate, routeGeometry), del hook y de RouteMapView. Un cambio en la estructura de `routeResult` obliga a sincronizar hook, vista y mapa.

## Gestión de Estado y Datos

- **Estado global (App):** Un único nivel: weatherData, query, activeTab, showMapPicker, mapTarget, mapCenter, customActivities, favorites, historyMapUpdate, gpsError, tryingInitialLocation, locationDeniedOrFailed. No hay Context API ni store externo; todo se pasa por props y callbacks. El flujo es **predecible pero verboso**.
- **Persistencia:** `useLocalStorage` para `my_activities` y `my_favorites` en App. [HomeSummary.jsx](src/components/HomeSummary.jsx) recibe `favorites` y `customActivities` por props desde App, no lee localStorage directamente; la fuente de verdad es el estado de App. No hay dos fuentes de verdad para actividades en el flujo actual, pero **si en el futuro otro componente lee `my_activities` sin pasar por App, puede haber desincronización**.
- **Datos de clima:** Fluyen en una sola dirección: useWeather → App → vistas. Las rutas no reutilizan weatherData; useRouteWeather hace sus propias peticiones a Open-Meteo y Air Quality. Correcto para origen/destino distintos, pero **duplica lógica de fetch y merge de AQI**.
- **Resumen:** El flujo de datos es entendible (arriba → abajo), pero hay **duplicación de origen de datos** (clima en dos hooks) y **archivos que concentran demasiado** (App.jsx, useRouteWeather.js).

---

# 3. Hallazgos de "Código Mejorable" (Análisis Milimétrico)

Solo se señala el problema; no se proponen soluciones.

## Redundancias (DRY)

- **Fetch de clima y merge de AQI:** La petición a Open-Meteo (parámetros, manejo de error) y la fusión de `us_aqi` en `hourly` están implementadas en [useWeather.js](src/hooks/useWeather.js) (fetchAPI, fetchAirQuality, mergeAirQualityIntoHourly) y de nuevo en [useRouteWeather.js](src/hooks/useRouteWeather.js) (fetchRawAPI, fetchAirQuality, mergeAirQualityIntoHourly). Cualquier cambio en la API o en el formato de AQI debe replicarse en ambos.
- **Geocodificación inversa (Nominatim):** El patrón “coords → fetch reverse Nominatim → formatStandardLocation” se repite en [App.jsx](src/App.jsx) en el efecto de inicialización (líneas 56-58), en handleGPS (líneas 137-143), en handleMapConfirm (líneas 159-161); en [RouteView.jsx](src/views/RouteView.jsx) en handleMapConfirm (líneas 122-126) y en handleRouteGPS (líneas 145-147). No hay una función única del tipo `coordsToLocation(lat, lon)` reutilizable.
- **Generación de informe (status + message + colorClass):** En [useRouteWeather.js](src/hooks/useRouteWeather.js), `evaluateSegment` construye status, message, colorClass y sortedFactors (líneas 104-128). En [activitiesConfig.js](src/utils/activitiesConfig.js), `generateReport` hace algo análogo (criticals, warnings, sortedFactors, status, message, analysis). La idea “criticals → red, warnings → yellow, sino green” y el mapeo a clases CSS están duplicados.
- **Cálculo de “weekDays” (próximos 7 días con etiquetas):** Idéntica lógica en [RouteView.jsx](src/views/RouteView.jsx) (useMemo líneas 90-99) y en [ActivitiesTab.jsx](src/components/ActivitiesTab.jsx) (useMemo líneas 85-95). Mismo bucle, misma capitalización de “today”/“tomorrow”; debería vivir en un util o hook compartido.
- **getWeatherInfo:** Definido en [weatherUtils.js](src/utils/weatherUtils.js) y re-exportado por [helpers.js](src/utils/helpers.js). [useWeather.js](src/hooks/useWeather.js) lo importa de helpers y lo re-exporta (`export { getWeatherInfo }`). [ActivitiesTab.jsx](src/components/ActivitiesTab.jsx) importa `getWeatherInfo` desde `../hooks/useWeather` en lugar de desde `../utils/helpers`. Inconsistencia: un componente importa una utilidad desde un hook solo porque el hook la re-exporta. [HomeView.jsx](src/views/HomeView.jsx) importa correctamente desde `../utils/helpers`.

## Complejidad Ciclomática

- **[useRouteWeather.js](src/hooks/useRouteWeather.js):** El hook tiene más de 400 líneas. `calculateRoute` (líneas 223-308) mezcla obtención de ruta, fetch de clima en origen/destino/medio, construcción de resultado simple (buildResultFromRouteData), y lanzamiento en paralelo de findBestTimeSlot y findBestSpatialDetour con lógica de “mejor” entre ambos. `removeWaypoint` (líneas 366-434) tiene una rama enorme (waypoints.length === 0) que reconstruye manualmente origin/mid/dest con tres fetchRawAPI y tres fetchAirQuality; es difícil de seguir y de mantener.
- **[activitiesConfig.js](src/utils/activitiesConfig.js):** `evaluateStandardActivity` (líneas 46-118) y `evaluateLaundryActivity` (líneas 130-171) son cadenas largas de `if/else` por factor (temp, precip, wind, ground, AQI, humidity, UV, visibility). Cualquier nueva regla o umbral añade más ramas; la función se vuelve cada vez más difícil de leer.
- **[RouteView.jsx](src/views/RouteView.jsx):** Más de 380 líneas. Varios `useEffect` para auto-scroll (resultsRef, reportRef, mapSectionRef, spatialRoute), un useMemo que hace setState (Inicializar Origen, líneas 84-89) — patrón cuestionable — y mucho JSX condicional (segmentKeys, waypoints, tabs Informe/Mapa). El archivo es pesado para una sola vista.
- **[App.jsx](src/App.jsx):** Condicionales anidados para mostrar barra de búsqueda (showGlobalSearch), loading, error, tryingInitialLocation, locationDeniedOrFailed, y luego por activeTab (inicio, rutas, colada, mapa, historia). La lógica de “qué se muestra” está dispersa en un solo return; cuesta seguir el flujo sin leer todo el archivo.

## Deuda Técnica "Heredada"

- **Prop `minimal` en LocationSearchInput:** En [RouteView.jsx](src/views/RouteView.jsx) se pasa `minimal={true}` a LocationSearchInput (líneas 234 y 248). En [LocationSearchInput.jsx](src/components/LocationSearchInput.jsx) la firma del componente no incluye `minimal`; la prop se ignora. Código muerto o interfaz incompleta.
- **Mezcla de convenciones de exportación:** getWeatherInfo se exporta desde helpers (que re-exporta weatherUtils) y también desde useWeather. Algunos archivos usan `import { getWeatherInfo } from '../utils/helpers'`, otros `from '../hooks/useWeather'`. No hay una convención única “utilidades desde utils/hooks”.
- **Comentarios y strings en español/inglés:** Código y comentarios mezclan español e inglés (“Inicializar Origen”, “LÓGICA VISIBILIDAD BARRA”, “No routes”, “Timeout al obtener el tiempo”). No crítico pero inconsistente para mantenimiento y onboarding.
- **routeUtils.js:** Usa `import.meta.env.VITE_ORS_API_KEY` y en DEV hace `console.log('ORS Payload:', ...)`. El payload puede contener coordenadas; en producción no se ejecuta, pero el hábito de loguear datos de peticiones puede ser riesgo si se extiende a otros entornos.

## Puntos Frágiles

- **Falta de validación defensiva en datos de API:** En [useWeather.js](src/hooks/useWeather.js), `processWeatherData` asume que `data.hourly.time`, `data.daily.sunrise`, etc. existen y tienen longitud; hay un `throw new Error('Estructura de datos inválida')` al inicio pero no se validan todos los índices antes de acceder (p. ej. `data.hourly.precipitation[currentHourIndex]`). Si la API devuelve arrays más cortos o desalineados, puede haber accesos a undefined.
- **Nominatim sin manejo de respuesta vacía o malformada:** En App.jsx y RouteView.jsx, tras `fetch(...nominatim/reverse...)` se hace `const rd = await r.json();` y luego `formatStandardLocation(rd)`. Si Nominatim devuelve un objeto vacío o sin `address`, formatStandardLocation en [geoUtils.js](src/utils/geoUtils.js) usa `data.address`; si `data` es null o no tiene la estructura esperada, puede producir errores en tiempo de ejecución. No hay try/catch alrededor del uso de `rd` en todos los sitios.
- **RainMapView:** [RainMapView.jsx](src/views/RainMapView.jsx) usa `isSafeHost` e `isSafePath` para validar URL del host y paths de RainViewer antes de construir tileLayer. Bien para seguridad; pero si `data.radar` o `data.satellite` vienen con estructura distinta, el código puede fallar al hacer `unifiedFrames.slice(-MAX_RADAR_FRAMES)` o al acceder a `frame.radarPath`. No hay comprobación explícita de la forma de cada frame.
- **HistoryTab:** [HistoryTab.jsx](src/components/HistoryTab.jsx) depende de una API de histórico (Open-Meteo Archive). Si la respuesta no trae los campos esperados o cambia el formato, el procesamiento posterior (setChartData, setTrends) puede fallar sin mensaje claro al usuario más allá de `setError`.
- **useRouteWeather — recalculateWithWaypoints:** Si `getRouteData` devuelve `routes` con más de un elemento o con legs en formato distinto, `routeData.legs.length !== waypoints.length + 1` lanza "Ruta no válida". No hay mensaje localizado ni recuperación; el usuario solo ve el error genérico del hook.

---

# 4. Auditoría de Seguridad y Performance (Observacional)

## Riesgos Visibles

- **Credencial en archivo versionado:** El archivo [openrouteservice.env](openrouteservice.env) en la raíz del proyecto contiene una línea `VITE_ORS_API_KEY=eyJ...`. Vite por defecto carga `.env` y `.env.local`, no `openrouteservice.env`; por tanto esa clave **podría no estar en uso** si no se renombra o no se referencia, pero **el archivo existe en el árbol y si en algún momento se carga o se sube a un repo público, la clave queda expuesta**. Debe estar en `.gitignore` y no versionado; la clave debe inyectarse por entorno (ej. `.env.local` que no se sube).
- **Posible filtración de API key al cliente:** Con Vite, las variables `VITE_*` se incluyen en el bundle del cliente. Cualquier usuario que abra la app puede ver `VITE_ORS_API_KEY` en las herramientas de desarrollo. Para una API de rutas/geocodificación con cuota, esto implica que un atacante podría usar esa clave desde su propio cliente. No es “secreto” en el sentido de backend; es un riesgo de abuso de cuota y debe documentarse o protegerse por proxy/backend si la política lo requiere.
- **Sin sanitización de entrada en búsqueda de ubicación:** [LocationSearchInput.jsx](src/components/LocationSearchInput.jsx) envía `query` en la URL a Nominatim/ORS con `encodeURIComponent(query)`. Eso evita inyección en la URL; no hay renderizado de `query` como HTML sin escapar en la app (React escapa por defecto). No se detectan otros vectores obvios de inyección.

## Sospechas de Performance

- **Re-renderizados:** App.jsx tiene mucho estado; cualquier cambio (query, activeTab, weatherData, showMapPicker, etc.) re-renderiza todo el árbol bajo App. No hay React.memo en componentes hijos pesados (p. ej. HomeView, RouteView, ActivitiesTab). Si weatherData se actualiza con la misma referencia o datos inmutables, los hijos podrían evitar re-renders con memo; no se ha verificado si es cuello de botella.
- **useEffect con dependencias amplias:** En LocationSearchInput, el useEffect de debounce (líneas 78-146) depende de `[query, isOpen, proximityCoords]`. Cada vez que cambia `proximityCoords` (objeto que puede ser nuevo en cada render desde el padre), se reinicia el timeout y se puede disparar una nueva búsqueda. Si el padre no memoriza `weatherData?.location`, puede haber peticiones extra.
- **RainMapView:** Polling cada 5 minutos (300000 ms) para refrescar datos híbridos; además, animación que avanza `currentIndex` cada 500 ms. Aceptable, pero si se abren varias pestañas o se mantiene la vista mucho tiempo, hay múltiples intervalos activos. Al desmontar se limpian; no se detecta fuga obvia.
- **RouteView — múltiples useEffects de scroll:** Varios `setTimeout` y `scrollIntoView` en respuesta a routeResult, resultView, spatialRoute. No son costosos por sí solos, pero el número de efectos que reaccionan a cambios de estado hace que el comportamiento “al confirmar ruta” sea más difícil de razonar y podría causar scrolls redundantes si los tiempos no están bien afinados.
- **useRouteWeather — Promise.all en segundo plano:** Tras calcular la ruta principal, se lanzan findBestTimeSlot y findBestSpatialDetour en paralelo. Cada uno puede hacer varias peticiones (clima, rutas). Si el usuario cambia de origen/destino rápidamente, las promesas antiguas siguen resolviéndose y llaman a setSmartSafeRoute/setSpatialRoute; no hay cancelación (AbortController o flag “latest request”). Riesgo de condiciones de carrera y estado desactualizado.

---

# 5. Veredicto Final del Estado Actual

- **Resumen en 3 líneas:**  
  La aplicación cumple su función (clima, actividades, rutas, radar, histórico) y el flujo de datos es lineal y comprensible. Sin embargo, concentra demasiada lógica en App.jsx y en useRouteWeather, duplica fetch y evaluación de clima entre dos hooks, y tiene redundancias claras (geocodificación inversa, generación de informes, weekDays). La estructura por tipos de archivo es aceptable pero no escala bien por features, y hay puntos frágiles (validación de APIs, props no usadas, posible exposición de API key) y deuda técnica (inconsistencias de imports, código muerto).

- **Nivel de mantenibilidad actual:** **Medio.**  
  - **Por qué no es Alto:** Duplicación de lógica de clima y de informes, hooks y vistas muy largos, acoplamiento fuerte de RouteView/RouteMapView con la forma de routeResult, y falta de una convención clara para utilidades (helpers vs re-export en hooks).  
  - **Por qué no es Bajo:** Hay separación entre utils (geoUtils, weatherUtils, timeUtils, routeUtils, safetyRules) y un barrel (helpers); los flujos de usuario son claros y el estado está centralizado en App sin stores dispersos; i18n está integrado y las cadenas no están hardcodeadas en el JSX de forma masiva.

---

*Fin del informe. Para navegar a los archivos citados, usar los enlaces relativos desde la raíz del proyecto (ej. `src/App.jsx`).*
