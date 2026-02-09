# Auditoría de Integridad y Regresión

**Fecha:** 2026-02-09  
**Rol:** Senior SRE + Experto React Internals  
**Alcance:** `src/` — vectores de fallo post-refactor (clausuras, listeners, refs, integración utils/hooks)

---

## 1. Clausuras obsoletas (stale closures) en `useCallback`

### 1.1 App.jsx

| Callback | Dependencias declaradas | Estado usado en el cuerpo | Veredicto |
|----------|-------------------------|---------------------------|-----------|
| `handleSaveActivity` | `[]` | Solo `setCustomActivities(prev => ...)` (actualización funcional) | ✅ VERIFICADO |
| `handleDeleteActivity` | `[]` | Solo `setDeleteConfirmActivityId(id)` | ✅ VERIFICADO |
| `confirmDeleteActivity` | `[deleteConfirmActivityId]` | Lee `deleteConfirmActivityId`, lo usa y luego lo resetea | ✅ VERIFICADO |
| `toggleFavorite` | `[]` | Solo `setFavorites(prev => ...)` (actualización funcional) | ✅ VERIFICADO |
| `openMapFor` | `[weatherData?.location?.lat, weatherData?.location?.lon]` | `weatherData?.location` para `setMapCenter({ lat, lon })` | ✅ VERIFICADO — Solo se usan lat/lon; las deps cubren los valores leídos. |
| `handleGlobalSelect` | `[loadWeatherData]` | `loadWeatherData`, `setQuery`, `setLocationDeniedOrFailed` | ✅ VERIFICADO |
| `handleViewLocation` | `[loadWeatherData]` | Idem | ✅ VERIFICADO |
| `handleGPS` | `[t, loadWeatherData]` | `isMountedRef.current` (ref estable), `t`, `loadWeatherData` | ✅ VERIFICADO |
| `handleMapConfirm` | `[t, mapTarget, loadWeatherData]` | `mapTarget`, `t`, `loadWeatherData` | ✅ VERIFICADO |
| `handleCloseMapPicker` | `[]` | Solo `setShowMapPicker(false)` | ✅ VERIFICADO |
| `handleActivitiesLocationSelect` | `[loadWeatherData]` | `loadWeatherData`, `setQuery` | ✅ VERIFICADO |
| `openMapMain` / `openMapHistory` | `[openMapFor]` | Delegan a `openMapFor` | ✅ VERIFICADO |
| `handleCloseActivityModal` | `[]` | Solo `setSelectedActivityForModal(null)` | ✅ VERIFICADO |

**Conclusión App.jsx:** No se detectan dependencias faltantes en los `useCallback`. Los que leen estado incluyen ese estado en el array de dependencias; los que solo usan setters con forma funcional son correctos con `[]`.

---

### 1.2 RouteView.jsx

**Hallazgo:** En `RouteView.jsx` **no se usa `useCallback`** en ningún handler. Todas las funciones (`openMapFor`, `handleMapConfirm`, `handleRouteFavorite`, `handleRouteGPS`, `handleAnalyzeClick`, etc.) son funciones normales declaradas en el cuerpo del componente, por lo que se recrean en cada render y **siempre tienen la clausura al día**. No hay riesgo de stale closure por memorización.

🔵 **MEJORA DE LEGIBILIDAD / PERFORMANCE:** Si se quiere reducir re-renders de hijos (p. ej. `LocationSearchInput`, `MapSelector`, `RouteMapView`), se podría envolver en `useCallback` los handlers que se pasan como props, incluyendo en el array de dependencias todos los estados que lean (p. ej. `openMapFor` depende de `selectedOrigin`, `selectedDest`, `weatherData`). Mientras no se haga, el comportamiento es correcto; solo hay más recreaciones de función.

---

## 2. Fugas de eventos (event listeners)

### 2.1 RainMapView.jsx

- **Leaflet:** El mapa se crea en un `useEffect` con cleanup que llama a `mapInstanceRef.current.remove()`, elimina capas de radar/satélite y llama a `stopAnimation()` (que limpia `timerRef`). **No se registran `map.on('click', ...)` ni otros listeners de Leaflet**; solo se usan opciones del mapa (dragging, scrollWheelZoom) y capas.
- **Intervals:** `setInterval` para refresco cada 5 min tiene `return () => clearInterval(interval)`.
- **Timeouts:** Los timeouts de crossfade y animación se limpian en el return del efecto (`clearTimeout(crossfadeRef.current.timeoutId)`, `clearTimeout(timerRef.current)`).

✅ **VERIFICADO** — No hay listeners sin cleanup.

---

### 2.2 MapSelector.jsx

- **Leaflet:** Se usa `map.on('click', (e) => { ... })` en dos ramas (modo ruta con waypoint editable y modo punto único). El cleanup del efecto hace `mapInstanceRef.current.remove()`. En Leaflet, **`map.remove()` destruye el mapa y elimina todos los listeners asociados al mapa**, por lo que los `map.on('click', ...)` se liberan correctamente.
- **Marcadores:** Los marcadores tienen `m.on('dragend', ...)`. Se limpian con `allMarkersRef.current.forEach(m => m.remove())` y/o `mapInstanceRef.current.remove()`. Al eliminar el mapa o el marcador, los listeners de ese elemento se eliminan.

✅ **VERIFICADO** — No hay fuga de listeners de Leaflet; el cleanup es correcto.

---

### 2.3 RouteMapView.jsx

- **Mapa:** Listeners en el mapa solo vía capas/marcadores. El cleanup del efecto principal hace `mapInstanceRef.current.remove()` y limpia `markersRef`, `polylineRef`, `addingMarkerRef`.
- **Marcadores:** `mOrigin.on('click', ...)`, `mDest.on('click', ...)`, `m.on('click', ...)` y en waypoints en edición `marker.on('drag', ...)`, `marker.on('dragend', ...)`. En el cleanup se hace `markersRef.current.forEach(m => m.remove())` y, en el efecto de “adding” waypoint, `m.off('drag', onDrag); m.off('dragend', onDragEnd)` antes de `remove()`. El efecto de edición de waypoint hace `marker.off('drag', snapToSegment); marker.off('dragend', snapToSegment)` en el return.

✅ **VERIFICADO** — Listeners de Leaflet y marcadores correctamente eliminados en cleanup.

---

### 2.4 LocationSearchInput.jsx (DOM)

- **Scroll/Resize:** `window.addEventListener('scroll', handleScrollOrResize, true)` y `window.addEventListener('resize', handleScrollOrResize)` dentro de un `useLayoutEffect` con condición `isOpen && results.length > 0`. El return hace `window.removeEventListener('scroll', handleScrollOrResize, true)` y `window.removeEventListener('resize', handleScrollOrResize)`. También se hace `ro.disconnect()` del ResizeObserver.
- **Click fuera:** `document.addEventListener("mousedown", handleClickOutside)` en un `useEffect` con `[]`; el return hace `document.removeEventListener("mousedown", handleClickOutside)`.

✅ **VERIFICADO** — No hay fuga de listeners del DOM; todos tienen cleanup explícito.

---

## 3. Consistencia de referencias (refs)

### 3.1 App.jsx — `isMountedRef`

- Se inicializa con `useRef(true)`.
- En un `useEffect` con `[]`: al montar se hace `isMountedRef.current = true`; en el cleanup `isMountedRef.current = false`.
- Uso: en el efecto de geolocalización inicial y en `handleGPS` se comprueba `if (!isMountedRef.current) return` antes de llamar a setters o `loadWeatherData`.

No hay early return ni rama que deje de ejecutar el cleanup del efecto que gestiona `isMountedRef`, por lo que en desmontaje siempre se pone a `false`.

✅ **VERIFICADO** — Uso y ciclo de vida de `isMountedRef` correctos.

---

### 3.2 useWeather.js — `lastRequestIdRef`

- Al inicio de `loadWeatherData`: `const myRequestId = ++lastRequestIdRef.current`.
- Antes de actualizar estado (tras fetch y procesado): `if (myRequestId !== lastRequestIdRef.current) return`.
- En `catch`: mismo chequeo antes de `setError`.
- En `finally`: `if (myRequestId === lastRequestIdRef.current) setLoading(false)`.

No se resetea el ref a 0; no es necesario para la lógica “solo la última petición actualiza estado”. No hay rama (early return o excepción) que omita el chequeo antes de setState ni el `finally`.

✅ **VERIFICADO** — Last-request-wins implementado de forma consistente.

---

### 3.3 useRouteWeather.js — `routeRequestIdRef`

- En `calculateRoute`: `const myRequestId = ++routeRequestIdRef.current` al inicio.
- Tras `analyzeRouteWithWeather`: `if (myRequestId !== routeRequestIdRef.current) return` antes de aplicar resultado.
- En el `.then()` de `Promise.all` (smart safe): mismo chequeo antes de `setSpatialRoute` / `setSmartSafeRoute`.
- En `catch` de `calculateRoute`: chequeo antes de `setError`.
- En `finally`: `if (myRequestId === routeRequestIdRef.current) setLoading(false)`.

El `.catch(() => {})` del `Promise.all` no actualiza estado; solo evita rechazo no manejado. No deja el ref en estado incoherente.

⚠️ **RIESGO LATENTE — addWaypoint / updateWaypoint / removeWaypoint:** Estas tres funciones **no usan `routeRequestIdRef`**. Si el usuario dispara varias operaciones seguidas (p. ej. añadir parada y enseguida moverla o eliminar otra), la última que termine escribirá en `routeResult`/`setError` y podría sobrescribir el resultado de una operación más reciente desde el punto de vista del usuario. No hay “last request wins” en waypoints.

**Recomendación:** Aplicar el mismo patrón que en `calculateRoute`: un ref de “última operación de waypoint” (o reutilizar un único ref de “última petición de ruta”) y comprobar antes de cada `setRouteResult` / `setError` / `setLoading(false)` que la respuesta corresponde a esa operación.

---

## 4. Integración Utils vs Hooks (useRouteWeather → analyzeRouteWithWeather)

### 4.1 Firma y uso

- **analyzeRouteWithWeather(originCoords, destCoords, waypoints, depDate, mode, requestOptions = {})**
- **requestOptions** en el util: `avoidFerries`, `returnMergedForSmartSafe`. No hay parámetro `signal` en la firma ni en `getRouteData`/fetch internos.

### 4.2 Llamadas desde useRouteWeather

| Llamada | Argumentos pasados | Comentario |
|---------|--------------------|------------|
| `calculateRoute` → `analyzeRouteWithWeather(origin, dest, [], depDate, mode, { returnMergedForSmartSafe: true })` | waypoints `[]`, options correctas | ✅ |
| `recalculateWithWaypoints` → `analyzeRouteWithWeather(originCoords, destCoords, waypoints, depDate, mode, { avoidFerries: options?.avoidFerries === true })` | options pasadas desde el hook | ✅ |
| `removeWaypoint` → `analyzeRouteWithWeather(prev.originCoords, prev.destCoords, waypoints, depDate, prev.mode)` | Sin quinto argumento; en el util es `requestOptions = {}` | ✅ Correcto; no se necesitan opciones extra. |

No se ha “perdido” ningún argumento opcional al extraer la lógica al util; las opciones usadas (`returnMergedForSmartSafe`, `avoidFerries`) se pasan donde corresponde.

🔵 **MEJORA DE LEGIBILIDAD / FUTURO:** Hoy `analyzeRouteWithWeather` y `getRouteData` no aceptan `signal`. Si en el futuro se quiere cancelar el cálculo de ruta al cambiar origen/destino o al desmontar, habría que añadir soporte de `AbortSignal` en estas funciones y en los `fetch` que usan (p. ej. en `routeUtils` y en las llamadas a pronóstico/calidad del aire).

---

## 5. Resumen ejecutivo

| Área | Estado | Notas |
|------|--------|--------|
| useCallback (App.jsx) | ✅ Sin bugs | Dependencias correctas; setters funcionales donde aplica. |
| useCallback (RouteView.jsx) | ✅ Sin stale closures | No hay useCallback; clausuras siempre actuales. Opción de usar useCallback para menos re-renders. |
| Event listeners (RainMapView, MapSelector, RouteMapView) | ✅ Sin fugas | Cleanup de mapa, marcadores, interval y timeouts correcto. |
| Event listeners (LocationSearchInput) | ✅ Sin fugas | window/document con removeEventListener y ResizeObserver con disconnect. |
| isMountedRef (App) | ✅ Correcto | Set en mount/unmount y comprobado antes de setState/loadWeatherData. |
| lastRequestIdRef (useWeather) | ✅ Correcto | Last-request-wins bien aplicado. |
| routeRequestIdRef (useRouteWeather) | ✅ en calculateRoute / ⚠️ en waypoints | calculateRoute consistente; addWaypoint/updateWaypoint/removeWaypoint sin patrón “last request wins”. |
| Utils vs hooks (analyzeRouteWithWeather) | ✅ Correcto | Argumentos y options pasados correctamente; signal no existe en la API actual. |

---

## 6. Acciones recomendadas (prioridad)

1. **⚠️ RIESGO LATENTE:** En `useRouteWeather`, añadir “last request wins” a `addWaypoint`, `updateWaypoint` y `removeWaypoint` (mismo ref o ref específico y comprobación antes de `setRouteResult`/`setError`/`setLoading(false)`).
2. **🔵 MEJORA:** Valorar `useCallback` en `RouteView.jsx` para handlers pasados a hijos si se observan re-renders innecesarios.
3. **🔵 MEJORA:** Si se requiere cancelación de peticiones de ruta, diseñar soporte `AbortSignal` en `analyzeRouteWithWeather` y en las llamadas de red que use.

Fin del informe.
