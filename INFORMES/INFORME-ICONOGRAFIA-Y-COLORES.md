# Informe: Iconografía y Colores en Mi Clima App

## 1. Librerías de iconos

La app usa **tres librerías**:

| Librería | Uso principal | Archivos |
|----------|---------------|----------|
| **Lucide React** | Clima, factores de riesgo, acciones, barras | HomeView, ActivitiesTab, FactorCard, riskUtils, CreateActivityModal, etc. |
| **Phosphor Icons** | Actividades, rutas, navegación | activitiesConfig, BottomNavigation, RouteView, MapSelector |
| **react-icons/wi** | Iconos meteorológicos principales | WeatherIconMain.jsx (WiDaySunny, WiNightClear, WiRain...) |

---

## 2. Paleta base (Tailwind / CSS)

| Variable / clase | Uso |
|------------------|-----|
| `#0f172a` | Fondo body (slate-900) |
| `#f1f5f9` | Texto principal (slate-100) |
| `slate-900`, `slate-800`, `slate-700` | Paneles, bordes, fondos oscuros |
| `slate-400`, `slate-500` | Texto secundario |
| `blue-400`, `blue-500`, `blue-600` | Acción principal, activo, links |
| `emerald-400/500` | OK / verde / condiciones buenas |
| `yellow-400/500` | Advertencias |
| `red-400/500` | Crítico / error |
| `amber-400/500` | Avisos, ubicación no disponible |
| `indigo-400/500` | Favoritos de ruta, History |

---

## 3. Sistema de estados (semáforo)

En actividades y rutas se usa:

| Estado | Significado | Colores | Icono |
|--------|-------------|---------|-------|
| **green** | OK | `emerald-400`, `emerald-500` (fondo/borde/texto) | Check |
| **yellow** | Advertencia | `yellow-400`, `yellow-500` | AlertTriangle |
| **red** | Crítico | `red-400`, `red-500` | XCircle |
| **gray** | Sin datos / error | `slate-400`, `slate-600`, `slate-700` | HelpCircle |

En `riskUtils.js` se mapea a: `CRITICAL`→red, `WARNING`→yellow, `SAFE`→green, `INFO`→gray.

---

## 4. Iconos y colores por sección

### 4.1 Home (`HomeView.jsx`)

| Elemento | Icono | Color | Notas |
|----------|-------|-------|-------|
| Clima principal | `WeatherIconMain` (react-icons/wi) | Según código WMO y temperatura | Ver sección 4.6 |
| Estado del cielo | `getWeatherInfo()` | `text-yellow-400`, `text-gray-300`, `text-blue-300`, etc. | `helpers.js` |
| Alerta lluvia/nieve | `AlertCircle`, `Umbrella`, `Snowflake` | Nieve: `text-cyan-200/400`; Lluvia: `text-blue-200/400` | Fondo con opacidad 10% |
| Hora local | — | `text-blue-400`, `bg-blue-400/10` | Píldora |
| Amanecer | Sun (Lucide) | `text-orange-400` | 24px |
| Atardecer | Moon (Lucide) | `text-purple-400` | 24px |
| Fase lunar | Moon (Lucide) | `text-slate-300`, fill 50% | — |
| Carousel horario | `getIconForCode()` (Sun, Moon, CloudSun, CloudMoon, CloudRain, Snowflake, CloudLightning) | `text-amber-200`, `text-slate-400`, `text-blue-300`, `text-cyan-200` según hora y precipitación | Barra de probabilidad: `bg-cyan-300` nieve, `bg-blue-500` lluvia |
| Temperatura mín/máx | — | `text-blue-300` / `text-orange-300` | WeeklyForecast |

### 4.2 Tarjetas de actividades (HomeSummary, ActivitiesTab)

| Elemento | Icono | Color | Notas |
|----------|-------|-------|-------|
| Actividad | `getIconComponent()` (Phosphor) | Heredado del contenedor | — |
| Estado | Check / AlertTriangle / XCircle / HelpCircle | Según `result.status` (emerald, yellow, red, slate) | `bg-*-500/10`, `border-*-500/50` |
| Punto indicador | Círculo pequeño | `bg-emerald-400`, `bg-yellow-400`, `bg-red-400`, `bg-slate-500` | — |
| Botón añadir | Plus (Lucide) | `text-slate-400`, hover `text-blue-400` | Borde dashed |

### 4.3 Factores climáticos (`FactorCard`, `riskUtils.js`)

| Tipo factor | Icono (Lucide) | Colores por estado |
|-------------|----------------|--------------------|
| TEMP | Thermometer | `STATUS_STYLES` (ver tabla) |
| WIND | Wind | Igual |
| PRECIP | CloudRain | Igual |
| GROUND | Footprints | Igual |
| ROAD | CloudRain | Igual |
| VISIBILITY | CloudFog | Igual |
| HUMIDITY | Droplets | Igual |
| UV | Sun | Igual |
| AQI | Gauge | Igual |
| SNOW | Snowflake | Igual |
| MOUNTAIN | Mountain | Igual |

**STATUS_STYLES** (`FactorCard.jsx`):

| Estado | Texto | Fondo / borde |
|--------|-------|---------------|
| CRITICAL | `text-red-400` | `bg-red-500/10 border-red-500/20` |
| WARNING | `text-yellow-400` | `bg-yellow-500/10 border-yellow-500/20` |
| SAFE | `text-emerald-400` | `bg-emerald-500/10 border-emerald-500/20` |
| INFO | `text-slate-400` | `bg-slate-700/30 border-slate-600/30` |

### 4.4 Modal de actividad (`ActivityModal.jsx`)

| Elemento | Icono | Color | Notas |
|----------|-------|-------|-------|
| Actividad | Phosphor (prop) | Blanco en círculo coloreado | Fondo según status |
| Mensaje estado | — | `colorClass` (emerald/yellow/red/slate) | — |
| Factores | `FactorCard` | `STATUS_STYLES` | — |
| "Mejor siguiente" | Clock | `bg-blue-600` | Círculo azul |

### 4.5 Crear/editar actividad (`CreateActivityModal.jsx`)

| Elemento | Icono | Color | Notas |
|----------|-------|-------|-------|
| Icono actividad | Phosphor (AVAILABLE_ICONS) | `text-blue-400`, seleccionado `border-blue-500` | — |
| Duración | Clock (Lucide) | `text-purple-400` | Slider thumb `bg-purple-500` |
| Temp ideal | Thermometer (Lucide) | `text-orange-400` | Min `text-blue-400`, max `text-orange-400` |
| Lluvia | CloudRain (Lucide) | `text-blue-400` | Botones `bg-blue-600` activo |
| Viento | Wind (Lucide) | `text-emerald-400` | Botones `bg-emerald-600` activo |
| Evitar suelo mojado | Toggle | `bg-blue-500` activo | — |

### 4.6 Iconos meteorológicos principales (`WeatherIconMain.jsx`, react-icons/wi)

| Código WMO | Día | Noche | Colores |
|------------|-----|-------|---------|
| 0 (despejado) | WiDaySunny | WiNightClear | Temp ≤0: cyan; <10: yellow-100; normal: amber-400. Noche ≤0: cyan-100; normal: slate-300 |
| 1–3 (nubes) | WiDayCloudy | WiNightAltCloudy | Día: cyan-100 (frío) / amber-200. Noche: slate-400 |
| 3 (nublado) | WiCloudy | — | `text-slate-300` |
| 45, 48 (niebla) | WiFog | — | `text-slate-400 opacity-80` |
| 51–55 (llovizna) | WiDaySprinkle | WiNightAltSprinkle | `text-blue-300` |
| 56–57, 66–67 (sleet) | WiSleet | — | `text-cyan-200` |
| 61–65 (lluvia) | WiRain, WiRainWind | — | blue-400 / blue-500 |
| 71–77, 85–86 (nieve) | WiDaySnow | WiNightAltSnow | `text-white` con sombra |
| 80–82 (chubascos) | WiRainWind | — | `text-blue-500` |
| 95–99 (tormenta) | WiDayThunderstorm | WiNightAltThunderstorm | `text-purple-400` / `text-purple-500` |

### 4.7 Etiquetas de clima (`helpers.js`, `getWeatherInfo`)

| Código / rango | Etiqueta | Color |
|----------------|----------|-------|
| 0 | Despejado | `text-yellow-400` |
| 1–3 | Nublado | `text-gray-300` |
| 45–48 | Niebla | `text-slate-400` |
| 51–57 | Llovizna | `text-blue-300` |
| 61–65 | Lluvia | `text-blue-300`–`text-blue-500` |
| 66–67 | Lluvia helada | `text-cyan-200` |
| 71–86 | Nieve | `text-cyan-100` |
| 80–82 | Chubascos | `text-blue-300`–`text-blue-500` |
| ≥95 | Tormenta | `text-purple-400` |

### 4.8 Rutas (`RouteView.jsx`, `useRouteWeather.js`)

| Elemento | Icono | Color | Notas |
|----------|-------|-------|-------|
| Origen | MapPinMarker (Phosphor) | `text-blue-400` | LocationSearchInput |
| Destino | NavigationArrow (Phosphor) | `text-emerald-400` | — |
| Transporte | Motorcycle, Car, Bicycle, PersonSimpleWalk | Activo: `text-blue-400`, drop-shadow azul. Inactivo: `text-slate-500` | Phosphor |
| Salir ahora / Programar | Clock, Calendar (Phosphor) | Activo: `text-blue-300`, `bg-blue-500/10` | — |
| Segmentos | FactorCard | `colorClass` (emerald/yellow/red) | De `evaluateSegment` |
| Botón análisis | Info (Lucide) | `text-blue-400`, hover `text-blue-300` | — |
| Día seleccionado | — | `bg-emerald-600`, `border-emerald-500` | — |
| Error | AlertTriangle | `text-orange-500` | Borde izquierdo `border-orange-500` |

**Mapa de rutas (MapSelector, RouteMapView):**

| Marcador | Color fondo | Notas |
|----------|-------------|-------|
| Origen | `#22c55e` (emerald) | Con "!" si status ≠ green |
| Destino | `#ef4444` (red) | Idem |
| Parada intermedia | `#3b82f6` (blue) | Idem |
| Parada nueva / edición | `#8b5cf6` (purple) | `8b5cf6` |
| Polilínea | `#3b82f6` | — |

### 4.9 Mapa de precipitación (`RainMapView.jsx`)

| Elemento | Icono | Color | Notas |
|----------|-------|-------|-------|
| Loader | Loader2 | `text-blue-600` | — |
| Error | CloudRain | `text-slate-500` | — |
| Zoom | ZoomIn, ZoomOut | `text-slate-700`, fondo blanco | — |
| Play / Pause | Play, Pause | Blanco sobre `bg-blue-600` | — |
| Posición usuario | Círculo | `bg-blue-600`, borde blanco, sombra azul | — |
| Leyenda radar | Gradiente | `#85c7f0 → #009696 → #ffd700 → #ff0000 → #ff00ff` | Escala TITAN |

### 4.10 Historial (`HistoryTab.jsx`)

| Elemento | Icono | Color | Notas |
|----------|-------|-------|-------|
| Sección | History | `text-indigo-400` | — |
| Caché | Save | `text-emerald-400` | Pulsante |
| Carga | Activity | `text-slate-400` (spin) | — |
| Error | AlertCircle | `text-slate-400` | — |
| Temp | Thermometer | `text-red-400` | — |
| Lluvia | Droplets, CloudRain | `text-blue-400` | — |
| Tendencias | TrendingUp, TrendingDown | `text-red-400` subida, `text-blue-400` bajada | — |
| Barras temp | HSL dinámico | Hue 0–220 según temp | Frío=azul, calor=rojo |
| Barras lluvia | `#3b82f6` | — | — |

### 4.11 Barra de navegación (`BottomNavigation.jsx`)

| Pestaña | Icono (Phosphor) | Activo | Inactivo |
|---------|------------------|--------|----------|
| Inicio | Sun | `text-blue-400`, drop-shadow, scale 1.1 | `text-slate-500` |
| Rutas | Path | Igual | Igual |
| Actividades | CalendarCheck | Igual | Igual |
| Historial | ClockCounterClockwise | Igual | Igual |
| Radar | CloudRain | Igual | Igual |

Fondo activo: `bg-blue-500/20` con blur.

### 4.12 Otros componentes

| Componente | Iconos | Colores |
|------------|--------|---------|
| **LocationSearchInput** | Search, MapPin, X, Loader2, Locate, CornerDownRight (Lucide) | Por prop `iconColor` (p.ej. `text-slate-400`, `text-blue-400`, `text-emerald-400`) |
| **MapSelector** | MapPin, X, Check, Crosshair, Activity (Lucide) | Título `text-blue-400`, botón ubicación `bg-blue-600` |
| **RouteFavorites** | Home, Briefcase, MapPin, Plus, Trash2, Save, X (Lucide) | Lleno: `indigo-900/30`, `text-indigo-200`. Vacío: `text-slate-500`. Borrar: `text-red-300` |
| **ErrorBoundary** | AlertTriangle, RefreshCw | `text-red-400`, `bg-red-500/10` |
| **App** | AlertCircle, MapPin, Search | Carga: `text-blue-500`. Sin ubicación: `text-amber-400`, `bg-amber-500/20` |

---

## 5. Resumen de colores por semántica

| Significado | Colores | Uso |
|-------------|---------|-----|
| OK / seguro | emerald-400/500 | Estados green, SAFE |
| Advertencia | yellow-400/500 | Estados yellow, WARNING |
| Crítico / error | red-400/500 | Estados red, CRITICAL, errores |
| Información / neutro | slate-400/500 | Estados gray, INFO, texto secundario |
| Acción / principal | blue-400/500/600 | Botones, pestañas activas, links |
| Temperatura fría | blue-200/300, cyan | Mínimas, nieve, frío |
| Temperatura cálida | orange-200/400, amber | Máximas, sol, calor |
| Ubicación | amber-400/500 | Sin GPS, avisos de ubicación |
| Destino | emerald-400 | Origen/destino en rutas |
| Parada intermedia | blue, purple | Waypoints en mapa |

---

## 6. Puntos para centralizar

1. **FactorCard** y **riskUtils** ya definen iconos y estilos de factores de forma centralizada.
2. Los estados de actividad (green/yellow/red/gray) se repiten en `HomeSummary`, `ActivitiesTab`, `ActivityModal`, `useRouteWeather`.
3. Hay mezcla de Lucide y Phosphor según contexto: Lucide para clima/factores, Phosphor para actividades y navegación.
4. `WeatherIconMain` usa una paleta propia (react-icons/wi + colores por código WMO y temperatura) distinta de `getWeatherInfo`.
