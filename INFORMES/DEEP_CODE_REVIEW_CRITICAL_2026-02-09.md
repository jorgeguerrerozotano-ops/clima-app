# Deep Code Review — Fallos Críticos

**Fecha:** 2026-02-09  
**Alcance:** Condiciones de carrera, integridad de datos, lazy loading, ciclos de renderizado, errores silenciosos.  
**Criterio:** Solo fallos que puedan causar crashes, bucles infinitos, datos corruptos o bloqueos de UI.

---

## 1. Condiciones de carrera y concurrencia

### LocationSearchInput.jsx y AbortController

**Análisis:** El debounce (800 ms) usa un único `AbortController` por efecto. En el cleanup se hace `abortController.abort()` y `clearTimeout(timeoutId)`. La callback async comprueba `signal.aborted` antes de `setResults` y en el `finally` antes de `setLoading(false)`. Si el usuario escribe "A", espera 800 ms, arranca la petición, y luego escribe "B", el cleanup aborta la petición anterior y arranca un nuevo timeout para "B". No se hace `setState` tras abort. El orden de `await` y las comprobaciones `signal.aborted` evitan que una respuesta antigua sobrescriba el estado.

**Conclusión:**  
**SEGURO:** La implementación del AbortController y el orden de los await evitan que una petición antigua sobrescriba el estado de una nueva.

---

### useWeather — loadWeatherData sin cancelación

**Análisis:** `loadWeatherData` en `useWeather.js` no usa AbortController ni ningún identificador de petición. Escenario: usuario selecciona "Madrid" → se lanza request1; antes de que responda selecciona "Barcelona" → se lanza request2. Si request1 (Madrid) responde después que request2 (Barcelona), se ejecuta `setWeatherData(processed)` de Madrid y se pisa el estado que ya mostraba Barcelona. El usuario ve Madrid cuando eligió Barcelona.

**Conclusión:**  
**CRÍTICO:** Una petición antigua puede sobrescribir el estado de una nueva si la red es lenta.  
**Reproducción:** Buscar "Madrid", seleccionar; inmediatamente buscar "Barcelona" y seleccionar; con latencia alta, puede mostrarse Madrid.  
**Recomendación:** Introducir un `requestId` o `AbortController` en el hook: ignorar o abortar respuestas que no correspondan a la última petición iniciada.

---

### useRouteWeather — calculateRoute sin cancelación

**Análisis:** `calculateRoute` es async y no cancela la petición anterior. El usuario puede pulsar "Analizar" para A→B, cambiar origen/destino a C→D y pulsar de nuevo. Ambas llamadas a `analyzeRouteWithWeather` se ejecutan; la que termine en último lugar hace `setRouteResult(...)` y gana. Se puede mostrar la ruta C→D cuando el usuario ya cambió a otra búsqueda, o la ruta A→B cuando esperaba C→D.

**Conclusión:**  
**CRÍTICO:** La última respuesta en llegar gana; en redes lentas se muestra una ruta que no corresponde a la última acción del usuario.  
**Recomendación:** Usar un `requestId` o AbortController en las llamadas a la API de rutas y descartar/abortar cuando se inicie un nuevo cálculo.

---

### useEffect en componentes desmontados (memory leaks)

**Análisis:**

- **App.jsx — useEffect inicial (líneas 57–70):** `getCurrentPositionWithName(...).then(...)` no tiene cleanup. Si el usuario cierra la pestaña o el componente se desmonta antes de que resuelva la promesa, se ejecutan `setTryingInitialLocation`, `setQuery`, `setMapCenter`, `loadWeatherData`. En React 18 se obtiene aviso de "Can't perform a React state update on an unmounted component". Riesgo: avisos en consola y, en teoría, comportamiento raro si el estado se actualiza tras desmontaje.

- **handleGPS (App.jsx):** Misma idea: `getCurrentPositionWithName(...).then(...)` sin cleanup. Si el usuario pulsa GPS y cambia de vista o cierra antes de que responda, se hace setState en desmontado.

**Conclusión:**  
**ALTO RIESGO:** Actualizaciones de estado posibles tras desmontaje en ubicación inicial y en GPS; en redes lentas o dispositivos lentos es más probable.  
**Recomendación:** En el useEffect inicial y en handleGPS, usar una bandera `isMounted` o una ref que se ponga a false en el cleanup, y no llamar a setState ni a `loadWeatherData` si el componente está desmontado. Alternativamente, abortar la operación de geolocalización en el cleanup si la API lo permite.

---

## 2. Integridad de datos en navegación (State Desync)

### Coherencia weatherData al cambiar de pestaña

**Análisis:** `weatherData` viene de un único `useWeather()` en App; `routeResult` viene de `useRouteWeather()` dentro de RouteView. Al cambiar Home → Rutas → Mapa, `weatherData` es el mismo en toda la app. La pestaña Rutas tiene su propio estado de origen/destino y `routeResult`; si el usuario en Home cambia de ciudad, `weatherData` se actualiza y en Rutas el `useEffect` que inicializa el origen desde `weatherData?.location` puede actualizar el origen mostrado. El `routeResult` sigue siendo el de la última ruta calculada (posiblemente otra ciudad). Eso es coherente con el diseño: la ruta mostrada es la última calculada; el origen sugerido se sincroniza con la ubicación actual.

**Conclusión:**  
**SEGURO:** No hay desincronización incorrecta; la mezcla "weatherData de una ciudad y routeResult de otra" es el comportamiento esperado hasta que se recalcule la ruta.

---

### getSafeWeatherData y RouteView

**Análisis:** En RouteView no se usa `getSafeWeatherData`; se usa `weatherData?.location` y `weatherData` en `openMapFor`. RouteView no itera sobre `hourly` ni sobre `analysis.hourlyForecast`. En `weatherParser.js`, `processWeatherData` lanza si `!data?.hourly?.time?.length`; es decir, si `hourly` existe pero está vacío `[]`, no se llega a devolver datos y useWeather recibe la excepción y hace `setError(...)`, por lo que `weatherData` no se actualiza con algo incompleto. En `getSafeWeatherData` (weatherUtils.js), `analysis.hourlyForecast` se normaliza con `Array.isArray(...) ? ... : []` y `rawHourly` con comprobación de objeto; un `hourly` vacío en la estructura ya se evita antes en el flujo.

**Conclusión:**  
**SEGURO:** getSafeWeatherData cubre arrays vacíos donde se usa; RouteView no depende de hourly; el flujo actual evita usar weatherData con hourly vacío sin avisar (error en pantalla).

---

### Acceso a weatherData.location sin optional chaining

**Análisis:** En App.jsx, dentro de `weatherData && <ErrorBoundary>`, se renderiza `RainMapView` y `HistoryTab` con `weatherData.location.lat`, `weatherData.location.lon`, `weatherData.location.name`. Si en algún momento `weatherData` existiera pero sin `location` (p. ej. bug futuro o un setWeatherData parcial), sería `TypeError`. Hoy `processWeatherData` siempre devuelve `location`, por lo que el riesgo es bajo pero real.

En ActivitiesTab.jsx se usa `weatherData.location.name` y `weatherData.location`; en RouteView.jsx en `openMapFor` se usa `weatherData.location.lat/lon` cuando hay `weatherData` pero no selectedOrigin/selectedDest.

**Conclusión:**  
**ALTO RIESGO:** En redes raras o respuestas mal formadas, si en el futuro se asigna un `weatherData` sin `location`, la app puede crashear en mapa/historia/actividades/rutas.  
**Recomendación:** Usar `weatherData?.location?.lat`, `weatherData?.location?.lon`, `weatherData?.location?.name` (y equivalente en ActivitiesTab y RouteView) para blindar frente a datos incompletos.

---

## 3. Lazy loading (chunk load errors)

**Análisis:** En App.jsx, el contenido que incluye las pestañas (HomeView, RouteView, ActivitiesTab, mapa, historia) está envuelto en un único `<ErrorBoundary>`. Las vistas lazy están dentro de `<Suspense fallback={<LazyLoader />}>`. Si falla la carga del chunk (p. ej. RainMapView o HistoryTab) por corte de red, React.lazy lanza; ese error lo captura el ErrorBoundary que envuelve todo el bloque, no solo la pestaña. El usuario ve el mensaje del ErrorBoundary y el botón "Reintentar". El LazyLoader (spinner + "Cargando…") es el fallback de Suspense y no bloquea la interacción con el resto de la app (barra de navegación y otras pestañas siguen usables).

**Conclusión:**  
**SEGURO:** Hay ErrorBoundary por encima del contenido que incluye Suspense; un fallo de carga del chunk no rompe toda la app y el usuario puede reintentar; el LazyLoader es visible y no bloquea la UI global.

---

## 4. Ciclos de renderizado infinitos

**Análisis:**

- **App.jsx:** El useEffect de inicialización tiene `[]`; el que sincroniza `query` con `weatherData` tiene `[weatherData, activeTab]` (valores primitivos o referencias de estado). `proximityCoords` se obtiene con `useMemo(..., [weatherData?.location?.lat, weatherData?.location?.lon])`, así que no es un objeto nuevo en cada render. No hay objetos creados inline en dependencias que provoquen bucle.

- **RouteView.jsx:** Los useEffect son de scroll con `[routeResult]`, `[resultView, routeResult]`, etc., y el de inicialización de origen con `[weatherData]`. `weatherData` viene de props (misma referencia hasta que cambia en App). No hay dependencias que sean objetos recién creados cada render.

**Conclusión:**  
**SEGURO:** No se detectan dependencias que provoquen un bucle infinito de peticiones o renders en App.jsx ni en RouteView.jsx.

---

## 5. Manejo de errores silenciosos

**Análisis:**

- **useWeather / useRouteWeather:** En los catch se hace `setError(...)` con mensajes traducidos; el usuario ve el error en pantalla. No hay errores críticos solo con console.log.

- **LocationSearchInput:** En los catch de búsqueda se hace `console.warn` y no se llama a `onSelect`; se deja `results` vacío o sin actualizar. El usuario ve "sin resultados", no un mensaje explícito de fallo. Aceptable para búsqueda, pero podría mejorarse con un estado de error opcional.

- **utils:**  
  - `storageUtils`: en fallos de DB/localStorage se hace `console.warn` y se devuelve `null` o no se hace nada; el llamador (historial) podría recibir null. No es un "botón que no hace nada", pero el usuario podría no saber que no se guardó.  
  - `activitiesConfig`: en catch se devuelve `{ status: 'gray', message: t('activities.error'), ... }`; la UI muestra estado gris y mensaje.  
  - `routeUtils` / `weatherApi`: los errores se relanzan y los hooks hacen setError.  
  - `smartRouteLogic`: en un catch se hace `console.log` y `continue` para un desvío espacial concreto; no se oculta un error crítico de la ruta principal.

**Conclusión:**  
**SEGURO en flujos críticos:** Los try/catch en hooks y en flujos principales (clima, rutas) comunican el error a la UI. No se encontró un caso donde un error crítico se trague solo con console.log dejando al usuario con un botón que no hace nada visible.  
**Menor:** En storageUtils, un fallo de guardado solo se refleja en consola; podría añadirse feedback en UI si se considera crítico para el historial.

---

## Resumen

| Área                         | Resultado |
|-----------------------------|-----------|
| LocationSearchInput / Abort | SEGURO    |
| useWeather race             | CRÍTICO   |
| useRouteWeather race        | CRÍTICO   |
| setState tras desmontaje     | ALTO RIESGO |
| State desync pestañas       | SEGURO    |
| getSafeWeatherData / RouteView | SEGURO |
| weatherData.location sin ?.  | ALTO RIESGO |
| Lazy + ErrorBoundary        | SEGURO    |
| Ciclos infinitos            | SEGURO    |
| Errores silenciosos críticos| SEGURO    |

**Veredicto:** La arquitectura actual **sí tiene fallos críticos**: condiciones de carrera en `loadWeatherData` y en `calculateRoute` (petición antigua puede pisar estado), y riesgo de actualizaciones de estado tras desmontaje en el efecto de ubicación inicial y en handleGPS. El resto de los vectores revisados (AbortController en búsqueda, coherencia de datos al cambiar pestaña, getSafeWeatherData, lazy loading con ErrorBoundary, dependencias de useEffect, y manejo de errores en hooks) se consideran robustos o con mejoras recomendadas de tipo defensivo (optional chaining en `weatherData.location`).
