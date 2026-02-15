# Auditoría Técnica Holística — mi-clima-app

**Rol:** Principal Software Engineer & Performance Architect  
**Alcance:** Directorio `src/` (calidad de código, rendimiento, robustez).  
**Excluido:** Reglas de tiendas (iconos, manifiestos).

---

## Resumen Ejecutivo

| Pilar | Críticos | Mejoras | Info | Pase |
|-------|----------|---------|------|------|
| 1. Rendimiento y Bundle | 0 | 2 | 1 | 2 |
| 2. Resiliencia y Happy Paths | 0 | 1 | 0 | 2 |
| 3. Accesibilidad (a11y) | 0 | 4 | 0 | 1 |
| 4. Seguridad y Sanitización | 0 | 0 | 1 | 3 |
| 5. Higiene del Código | 0 | 1 | 1 | 2 |

**Total:** 0 🔴 CRÍTICO · 8 🟡 MEJORA · 3 🔵 INFO · 10 ✅ PASE

---

## 1. Rendimiento y Optimización del Bundle

### 🔴 CRÍTICO
*Ninguno.*

### 🟡 MEJORA

| # | Hallazgo | Ubicación | Recomendación |
|---|----------|------------|----------------|
| 1.1 | **RouteView (y Leaflet) en bundle inicial** | `App.jsx` | `HomeView`, `RouteView` y `ActivitiesTab` se importan estáticamente. Al cargar la app se descarga también `RouteView` → `MapSelector`, `RouteMapView` (Leaflet). Si el usuario solo usa "Inicio", paga el coste de Leaflet en el FCP. | Considerar `const RouteView = lazy(() => import('./views/RouteView'))` y envolver en `<Suspense>` igual que `RainMapView` y `HistoryTab`. Opcional: lazy de `ActivitiesTab` si se prioriza FCP al máximo. |
| 1.2 | **Callbacks inline que romperían React.memo** | `App.jsx` (y otros) | Se pasan funciones creadas en cada render como props, ej. `onGoToActivities={() => setActiveTab('colada')}` (línea 280). No hay `React.memo` hoy, pero si se añade en hijos, estos re-renderizarían siempre. | Estabilizar callbacks con `useCallback` (ej. `const handleGoToActivities = useCallback(() => setActiveTab('colada'), [])` y pasarlo a `HomeView`). Revisar otros props similares en vistas. |

### 🔵 INFO

| # | Hallazgo | Ubicación | Nota |
|---|----------|------------|------|
| 1.3 | **Dependencia `date-fns`** | `package.json` | `date-fns` está en `dependencies` pero no hay ningún `import ... from 'date-fns'` en `src/`. Fechas se manejan con `Date` nativo y `weekUtils.js`. | Verificar si se usa en tests o build; si no, eliminar de `package.json` para reducir tamaño del bundle. |

### ✅ PASE

- **Lazy de vistas pesadas:** `RainMapView` y `HistoryTab` están bajo `lazy()` + `Suspense` con fallback `<LazyLoader />`. Recharts solo se carga con HistoryTab (lazy). Correcto.
- **Sin librerías pesadas importadas enteras:** No se usa `lodash` entero; no hay imports tipo `import _ from 'lodash'`. Recharts se importa por componentes (`BarChart`, `Bar`, etc.) en un módulo ya lazy.

---

## 2. Resiliencia y "Happy Paths"

### 🔴 CRÍTICO
*Ninguno.*

### 🟡 MEJORA

| # | Hallazgo | Ubicación | Recomendación |
|---|----------|------------|----------------|
| 2.1 | **Sin detección explícita de offline** | Toda la app | No hay uso de `navigator.onLine` ni listener `online`/`offline`. Si la app se carga sin internet, el usuario ve el flujo normal hasta que falla el fetch; entonces `useWeather`/`useRouteWeather` muestran error. No hay mensaje tipo "No hay conexión" que explique el estado. | Añadir detección de conectividad (ej. estado inicial y listener `window.addEventListener('offline'/'online')`) y un mensaje claro cuando `!navigator.onLine` (o tras un primer fallo de red) para evitar sensación de "app rota". |

### ✅ PASE

- **Loading en errores de API:** En `useWeather.js`, el `loadWeatherData` usa `try/catch/finally` y en `finally` hace `setLoading(false)` si la petición sigue siendo la actual (`lastRequestIdRef`). No hay spinner infinito por error no manejado.
- **useRouteWeather:** Todas las rutas async (`calculateRoute`, `addWaypoint`, `updateWaypoint`, `removeWaypoint`) tienen `finally { setLoading(false) }` condicionado a `routeRequestIdRef`. Los fallos de API no dejan la UI en loading indefinido.

---

## 3. Accesibilidad (a11y) y Semántica

### 🔴 CRÍTICO
*Ninguno.*

### 🟡 MEJORA

| # | Hallazgo | Ubicación | Recomendación |
|---|----------|------------|----------------|
| 3.1 | **Botones solo icono sin aria-label** | Varios | Varios `<Button variant="ghost" size="icon">` o `size="iconLg"` que solo contienen un icono (X, ZoomIn, ZoomOut, estrella, lápiz, papelera, etc.) sin `aria-label` ni `title`. Un lector de pantalla no puede describir la acción. | Añadir `aria-label` (y opcionalmente `title`) a todo botón que sea solo icono. Ejemplos: `RainMapView.jsx` ZoomIn/ZoomOut (líneas 317–318), `RouteSegmentAnalysisModal.jsx` y `ActivityAnalysisModal.jsx` cerrar (X), `MapSelector.jsx` cancelar (X), `ActivityModal.jsx` cerrar, `RouteFavorites.jsx` cerrar, `ActivitiesTab.jsx` estrella/pencil/trash, `RouteView.jsx` botón intercambiar origen/destino, `CreateActivityModal.jsx` botones de icono. |
| 3.2 | **Texto crítico a 10px** | Múltiples componentes | Se usa `text-[10px]` en etiquetas y contenido legible (HistoryTab, HomeView, RoutePointSummaryCard, WeeklyForecast, RouteView, LocationSearchInput, ActivitiesTab, CreateActivityModal, FactorCard, PrecipitationAlert, etc.). WCAG recomienda al menos 12px para texto esencial; 10px puede ser ilegible para parte de usuarios. | Sustituir por `text-xxs` (10px ya definido en Tailwind) donde sea solo referencia, y subir a mínimo 12px (`text-xs`) donde el texto sea crítico para la tarea (etiquetas de formulario, mensajes, nombres). Revisar también `text-xxs`/`text-xxxs` en botones y labels. |
| 3.3 | **Backdrops de modal no accesibles por teclado** | App.jsx, RouteSegmentAnalysisModal, ActivityAnalysisModal, ActivityModal | Los overlays que cierran el modal al hacer clic son `<div onClick={onClose}>`. No tienen `role="button"` ni `tabIndex={0}` ni manejador `onKeyDown` (Enter/Space). Usuarios de teclado no pueden "cerrar haciendo clic en el fondo". | Añadir `role="button"`, `tabIndex={0}`, `aria-label` (ej. "Cerrar") y `onKeyDown` que dispare `onClose` en Enter/Space. Alternativa: asegurar que el foco quede atrapado en el modal y el cierre sea solo con botón "Cerrar" explícito (ya presente); entonces el backdrop puede quedar sin rol de botón pero documentado. |
| 3.4 | **Tarjeta clicable sin rol** | ActivitiesTab.jsx | El contenedor de cada actividad es un `<div onClick={...}>` que actúa como tarjeta clicable (expandir/colapsar). No tiene `role="button"` ni `tabIndex={0}`. | Añadir `role="button"`, `tabIndex={0}` y `onKeyDown` (Enter/Space) para activar la misma acción que el clic, y un `aria-label` descriptivo (ej. "Expandir actividad X"). |

### ✅ PASE

- **Algunos botones icono bien etiquetados:** WeekSelector (prev/next semana y mes) tiene `aria-label`; RoutePointSummaryCard (cerrar, informe, editar) tiene `aria-label`/`title`; LocationSearchInput (borrar, GPS, mapa) tiene `title`; RainMapView bloqueo de mapa tiene `aria-label` y `title`. Botón de añadir actividad en HomeSummary tiene `title`. Buen patrón a extender al resto.

---

## 4. Seguridad y Sanitización

### 🔴 CRÍTICO
*Ninguno.*

### 🟡 MEJORA
*Ninguno.*

### 🔵 INFO

| # | Hallazgo | Ubicación | Nota |
|---|----------|------------|------|
| 4.1 | **HTML en marcadores de mapa** | MapSelector.jsx, RouteMapView.jsx | Se usa `L.divIcon({ html: '<div style="...">...</div>' })` con cadenas fijas. No es `dangerouslySetInnerHTML` en React; el HTML lo interpreta Leaflet. No hay entrada de usuario. | Aceptable. Si en el futuro el HTML dependiera de datos de usuario, habría que sanitizar o evitar HTML. |

### ✅ PASE

- **Sin dangerouslySetInnerHTML:** No se usa en ningún archivo de `src/`.
- **Claves de API:** Uso correcto de `import.meta.env.VITE_ORS_API_KEY`, `VITE_ORS_PROXY_URL` y comprobaciones antes de llamar a ORS. No hay API keys hardcodeadas en el código.
- **Dependencias:** No se detectan imports sospechosos o redundantes más allá de la posible dependencia no usada `date-fns` (pilar 1).

---

## 5. Higiene del Código (Code Hygiene)

### 🔴 CRÍTICO
*Ninguno.*

### 🟡 MEJORA

| # | Hallazgo | Ubicación | Recomendación |
|---|----------|------------|----------------|
| 5.1 | **Console en flujos principales** | useWeather.js, useRouteWeather.js, LocationSearchInput.jsx, HistoryTab.jsx, RainMapView.jsx, MapSelector.jsx, routeUtils.js, activitiesConfig.js, storageUtils.js, useLocalStorage.js | Hay `console.error`/`console.warn` en bloques `catch` y fallbacks. En producción ensucian la consola y pueden filtrar detalles internos. | En producción, considerar: (a) no llamar a `console` en catch, o (b) envolver en `if (import.meta.env.DEV)` o (c) usar un logger que en build de prod no escriba a consola. Mantener al menos un camino para reportar errores (ej. estado `error` en UI) sin depender de console. |

### 🔵 INFO

| # | Hallazgo | Ubicación | Nota |
|---|----------|------------|------|
| 5.2 | **ErrorBoundary registra en consola** | ErrorBoundary.jsx | `console.error("Error capturado por el Boundary:", error, errorInfo)` es razonable para diagnóstico. | Aceptable; opcionalmente condicionar a `import.meta.env.DEV` o enviar a un servicio de errores en prod. |

### ✅ PASE

- **Comentarios zombie:** No se encontraron bloques de código comentado del tipo `// const x = ...` que deban borrarse.
- **TODOs/FIXMEs:** No hay comentarios `// TODO:` o `// FIXME:` pendientes en el código revisado.

---

## Tabla Consolidada de Hallazgos

| Severidad | Pilar | ID | Descripción breve |
|-----------|-------|-----|--------------------|
| 🟡 | 1 | 1.1 | Lazy de RouteView (y opcionalmente ActivitiesTab) para mejorar FCP |
| 🟡 | 1 | 1.2 | Estabilizar callbacks (useCallback) para no romper futuros React.memo |
| 🔵 | 1 | 1.3 | Revisar dependencia date-fns (posible no uso) |
| 🟡 | 2 | 2.1 | Detección offline y mensaje claro "Sin conexión" |
| 🟡 | 3 | 3.1 | aria-label en todos los botones solo icono |
| 🟡 | 3 | 3.2 | Revisar tamaños de fuente ≤10px en texto crítico |
| 🟡 | 3 | 3.3 | Acceso por teclado a backdrops de modales |
| 🟡 | 3 | 3.4 | role="button" + teclado en tarjeta clicable (ActivitiesTab) |
| 🔵 | 4 | 4.1 | HTML en Leaflet: seguro mientras sea contenido fijo |
| 🟡 | 5 | 5.1 | Reducir o condicionar console.error/warn en producción |
| 🔵 | 5 | 5.2 | ErrorBoundary: console opcional en prod |

---

## Conclusión

No se han detectado **problemas críticos** que impidan la build de producción desde el punto de vista de calidad de código, rendimiento o seguridad. Los puntos listados como **MEJORA** son recomendables para una experiencia más rápida, accesible y mantenible; los **INFO** son revisiones menores o buenas prácticas a tener en cuenta.

Prioridad sugerida antes de producción:

1. **Alta:** 3.1 (aria-label en botones icono), 2.1 (offline).
2. **Media:** 1.1 (lazy RouteView), 3.2 (tamaños de fuente), 5.1 (console en prod).
3. **Baja:** 1.2 (useCallback), 3.3–3.4 (teclado/backdrop y tarjeta), 1.3 y 4.1/5.2 (info).

— Fin del informe —
