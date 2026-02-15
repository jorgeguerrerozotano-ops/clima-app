# Auditoría estática UI/UX — `src/`

**Alcance:** Componentes y estilos en `src/` (`.jsx`, `.css`).  
**Objetivo:** Identificar inconsistencias de diseño, falta de estandarización y deuda técnica visual. Sin correcciones, solo estado actual.

---

## 1. Paleta de colores detectada

### Colores hexadecimales y rgba en código

| Código | Uso aproximado | Archivos | Frecuencia |
|--------|----------------|----------|------------|
| **#0f172a** | Fondo body | `index.css` | 1 |
| **#f1f5f9** | Color texto body | `index.css` | 1 |
| **#334155** | Grid/tooltip gráficos (Recharts) | `HistoryTab.jsx` | 4 |
| **#64748b** | Ejes Y (Recharts) | `HistoryTab.jsx` | 2 |
| **#94a3b8** | Ejes X, marcador gris mapa | `HistoryTab.jsx`, `MapSelector.jsx` | 3 |
| **#3b82f6** | Barras lluvia, polylines, pins azules | `HistoryTab.jsx`, `MapSelector.jsx`, `RouteMapView.jsx` | 6+ |
| **#22c55e** | Pin verde (origen/OK) | `MapSelector.jsx`, `RouteMapView.jsx` | 3 |
| **#ef4444** | Pin rojo (destino/peligro) | `MapSelector.jsx`, `RouteMapView.jsx` | 4+ |
| **#eab308** | Estado amarillo (pins) | `RouteMapView.jsx` | 1 |
| **#8b5cf6** | Pin waypoint (edición) | `MapSelector.jsx`, `RouteMapView.jsx` | 2 |
| **#93c5fd** | Borde pin actual (azul claro) | `RouteMapView.jsx` | 1 |
| **#d6dde0** | Fondo contenedor mapa lluvia | `RainMapView.jsx` | 2 |
| **#85c7f0**, **#009696**, **#ffd700**, **#ff0000**, **#ff00ff** | Gradiente leyenda mapa lluvia | `RainMapView.jsx` | 1 (bloque) |
| **#646cffaa** | Hover logo (App) | `App.css` | 1 |
| **#61dafbaa** | Hover logo React | `App.css` | 1 |
| **#888** | Enlace “read-the-docs” | `App.css` | 1 |

### rgba en código

| Valor | Uso | Archivos |
|-------|-----|----------|
| **rgba(15, 23, 42, 0.6)** | `.glass-panel` | `index.css` |
| **rgba(30, 41, 59, 0.7)** | `.glass-input` | `index.css` |
| **rgba(255,255,255,0.1)** | Bordes glass | `index.css` |
| **rgba(239, 68, 68, 0.6 / 0.9)** | Animación pin peligro | `index.css`, `RouteMapView.jsx` |
| **rgba(0,0,0,0.3)** | Sombra pins (2px 6px) | `MapSelector.jsx`, `RouteMapView.jsx` (HTML inline) |
| **rgba(0,0,0,0.4)** | Sombra pins (4px 8px / 4px 10px) | `MapSelector.jsx`, `RouteMapView.jsx` |
| **rgba(96,165,250,0.8)** | Glow ítem activo nav / ruta | `RouteView.jsx`, `BottomNavigation.jsx` |
| **rgba(37,99,235,0.6)** | Glow marcador mapa lluvia | `RainMapView.jsx` |
| **rgba(59,130,246,0.4)** | Ring pin actual en mapa ruta | `RouteMapView.jsx` |
| **rgba(0,0,0,0.8)** | Sombra dropdown búsqueda | `LocationSearchInput.jsx` (Tailwind arbitrary) |

### Agrupación por “mismo” color (variaciones sutiles)

- **Slate / fondo oscuro:** `#0f172a` (body), `#334155` (grid), `#64748b`, `#94a3b8`, `#f1f5f9` (texto). En Tailwind serían `slate-900`, `slate-700`, `slate-500`, `slate-400`, `slate-100`. En CSS se usan hex en lugar de variables o tokens.
- **Azul:** `#3b82f6` (blue-500) repetido en muchos sitios; sombras/glow con `rgba(96,165,250,0.8)`, `rgba(37,99,235,0.6)`, `rgba(59,130,246,0.4)` — mismo concepto visual con valores distintos.
- **Rojo:** `#ef4444` y `rgba(239,68,68,0.6|0.9)` — coherente pero duplicado entre CSS y JS.
- **Verde:** `#22c55e` (emerald/green) solo en mapas (HTML inline).
- **Gris mapa:** `#d6dde0` no pertenece a la paleta Tailwind del proyecto; es un gris “a mano” para el mapa.

**Resumen:** Hay mezcla de hex, rgba y clases Tailwind. Los mismos colores (p. ej. slate, blue) aparecen como hex en gráficos y en HTML inline de Leaflet, y como utilidades Tailwind en el resto. No hay una única fuente de verdad (variables CSS o design tokens).

---

## 2. Escala y espaciado (números mágicos)

### Valores en píxeles explícitos (px)

| Valor | Contexto | Archivos |
|-------|----------|----------|
| **9** | `fontSize: 9` en ejes Recharts; no escala con `text-xs` (12px) del resto | `HistoryTab.jsx` |
| **18, 20, 22, 24** | Tamaños de pins en mapas (width/height en HTML inline) | `MapSelector.jsx`, `RouteMapView.jsx` |
| **2, 3** | Bordes en strings HTML (2px solid white, 3px solid white) | Mapas (varios) |
| **-8** | `marginTop: -8` en `RoutePointSummaryCard` | `RoutePointSummaryCard.jsx` |
| **12** | `bottom: 12, left: 12, right: 12` en posicionamiento | `RoutePointSummaryCard.jsx` |

### Valores arbitrarios en Tailwind (clases `[...]`)

| Clase / valor | Uso | Archivos |
|---------------|-----|----------|
| **min-h-[200px]** | Contenedor error | `ErrorBoundary.jsx` |
| **max-w-[200px]** | Párrafo error | `ErrorBoundary.jsx` |
| **max-w-[260px]** | Hint carga ubicación | `App.jsx` |
| **max-w-[280px]** | Mensaje error mapa lluvia | `RainMapView.jsx` |
| **max-w-[60px]** | Truncar etiqueta | `HomeView.jsx` |
| **max-w-[56px]** | Valor factor en card | `RoutePointSummaryCard.jsx` |
| **min-w-[100px]** | Celda actividad Home | `HomeSummary.jsx` |
| **min-w-[120px]** | Columna leyenda | `RainMapView.jsx` |
| **min-w-[170px], max-w-[260px]** | Card resumen punto ruta | `RoutePointSummaryCard.jsx` |
| **min-w-[3.5rem]** | Celda hora en forecast | `WeeklyForecast.jsx`, `HomeView.jsx` |
| **h-[54px]** | Input búsqueda ubicación | `LocationSearchInput.jsx` |
| **h-[50vh], h-[55vh], h-[75vh]** | Contenedores de mapa | `App.jsx`, `MapSelector.jsx`, `RainMapView.jsx`, `RouteMapView.jsx` |
| **max-h-[85vh], max-h-[90vh]** | Modales | `CreateActivityModal.jsx`, `ActivityAnalysisModal.jsx`, `RouteSegmentAnalysisModal.jsx`, `ActivitiesTab.jsx` |
| **max-h-[240px]** | Área scroll selector iconos | `CreateActivityModal.jsx` |
| **max-h-60** | Dropdown búsqueda (Tailwind 15rem) | `LocationSearchInput.jsx` |
| **left-[1.6rem]** | Línea vertical timeline | `RouteView.jsx` |

### Contraste con escala estándar

- **Espaciado:** Se usan `p-2`, `p-3`, `p-4`, `p-6`, `rounded-xl`, `rounded-2xl`, etc., pero conviven con muchos `min-w-[...]`, `max-w-[...]`, `h-[...]` y `max-h-[...]` que no siguen una escala común (p. ej. 4/8px o escala de rem).
- **Tipografía:** Ver sección 4; hay mezcla de `text-xs`/`text-sm` con `text-[9px]` y `text-[10px]`, lo que rompe la escala tipográfica estándar de Tailwind.

---

## 3. Candidatos a componentes (UI duplicada / componentes fantasma)

### Botones

- **Existe `src/components/ui/Button.jsx`** con variantes `primary`, `secondary`, `danger`, `ghost`, pero **no se importa en ningún archivo**.
- En su lugar hay **más de 40 usos de `<button>`** con clases largas repetidas, por ejemplo:
  - **Primario (azul):** `bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl ...` en `CreateActivityModal`, `MapSelector`, `RouteMapView`, `RouteFavorites`, `App.jsx`, `RouteView` (con ligeras variaciones: `py-3`, `py-3.5`, `rounded-2xl`, `rounded-xl`).
  - **Secundario / outline:** `border border-slate-600 rounded-xl ... text-slate-400 hover:border-blue-500 hover:text-blue-400 font-bold text-xs uppercase tracking-wider` en `MapSelector`, `RouteMapView`, `RouteView` (varias veces).
  - **Toggle / tabs:** `flex-1 ... py-2 rounded-lg text-xs font-bold ... bg-blue-600 text-white` vs `text-slate-400` en `ActivitiesTab`, `RouteView` (ahora / programado; día seleccionado).
  - **Icon-only / ghost:** `p-1.5 rounded-lg bg-slate-800/50 hover:bg-blue-500/20 text-slate-400 hover:text-blue-400` en `ActivitiesTab`, `RouteView` (botón “ver análisis”).
  - **Danger / cancel:** `bg-slate-700 hover:bg-slate-600` y `bg-red-600 hover:bg-red-500` en `App.jsx` (confirmación borrado).
- Patrón repetido: mismo “tipo” de botón con pequeñas variaciones de padding, border-radius y texto, sin componente único.

### Inputs

- **Campo de texto:** `bg-slate-800 border border-slate-600 ... rounded-lg ... focus:border-blue-500 outline-none` en `HistoryTab`, `CreateActivityModal`, `RouteFavorites`, `LocationSearchInput` (y variantes `bg-slate-900`, `border-slate-700`).
- **Range (slider):** Dos `<input type="range">` en `CreateActivityModal` con la misma cadena larga de clases (incl. `[&::-webkit-slider-thumb]:...`); candidato a `Slider` o al menos constante de clases.
- **type="time":** `bg-slate-900 text-white text-center w-full py-2 rounded-lg font-bold border border-slate-600 outline-none` en `ActivitiesTab` y `RouteView` (casi idéntico; en uno `border-slate-700 focus:border-blue-500`).
- No hay un componente `Input` reutilizable; cada pantalla define su propio estilo.

### Cards / contenedores tipo card

- **Existe `src/components/ui/Card.jsx`** (`glass-panel rounded-3xl p-6`), pero **no se importa en ningún archivo**.
- En su lugar se repiten bloques del tipo:
  - `bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl ...` en modales (`CreateActivityModal`, `ActivityAnalysisModal`, `RouteSegmentAnalysisModal`, `App.jsx`).
  - `glass-panel ... rounded-2xl border border-slate-700` en `RouteView`, `RainMapView`, `ActivitiesTab`.
  - `rounded-xl border ... bg-slate-800/50` o `bg-slate-800/30` en segmentos de ruta y paneles.
- Variaciones sutiles: `rounded-xl` vs `rounded-2xl`, `border-slate-600` vs `border-slate-700`, `shadow-xl` vs `shadow-2xl`, con/sin `overflow-hidden`. Candidato a un único componente `Card` o `ModalPanel` y uso real del `Card` existente.

### Modales

- Estructura repetida: overlay + contenedor `bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-h-[85vh] flex flex-col` en:
  - `CreateActivityModal`
  - `ActivityAnalysisModal`
  - `RouteSegmentAnalysisModal`
  - Y en `App.jsx` el modal de confirmación y el de selección de ubicación con estilos muy similares.
- No hay un componente base `Modal` (overlay + wrapper + max-height + scroll); cada modal vuelve a definir lo mismo.

### Pins de mapa (Leaflet)

- Marcadores con HTML inline repetido en `MapSelector.jsx` y `RouteMapView.jsx`: mismo patrón (círculo con color, borde blanco, sombra), con variaciones en tamaño (18/20/22/24px) y color. Candidato a función o componente que reciba tamaño y color y devuelva el HTML o un div React para `icon` de Leaflet.

---

## 4. Tipografía inconsistente

### Tamaños de fuente

| Clase / valor | Uso típico | Archivos (ej.) |
|---------------|------------|------------------|
| **text-[8px]** | Etiquetas muy pequeñas (leyenda mapa) | `RainMapView.jsx` |
| **text-[9px]** | Labels, métricas, “km restantes”, probabilidad % | `HistoryTab`, `WeeklyForecast`, `RouteView`, `HomeSummary`, `RoutePointSummaryCard`, `RainMapView`, `ActivitiesTab` |
| **text-[10px]** | Labels en mayúsculas, hints, duración | `HistoryTab`, `CreateActivityModal`, `ActivityModal`, `WeeklyForecast`, `LocationSearchInput`, `ActivitiesTab`, `RouteView`, `HomeView`, `RoutePointSummaryCard`, `FactorCard` (via `labelClass`) |
| **text-xs** | Texto secundario, botones, badges | Múltiples |
| **text-sm** | Párrafos, títulos secundarios | Múltiples |
| **text-base** | Inputs, texto principal en formularios | `CreateActivityModal`, `LocationSearchInput` |

Problemas:

- **Escala rota:** Tailwind usa 12px (`text-xs`), 14px (`text-sm`), 16px (`text-base`). `text-[9px]` y `text-[10px]` quedan entre 12px y 14px sin correspondencia con la escala, y se usan en contextos similares (labels, métricas) a veces con 9px y otras con 10px sin criterio claro.
- **Recharts:** `fontSize: 9` en ejes (en px) no está alineado con ninguna clase del resto de la app.

### Peso de fuente

- **font-bold** es el más usado (labels, botones, valores).
- **font-black** en títulos o secciones: `ActivityModal`, `WeeklyForecast`, `HistoryTab` (“Climate analysis”).
- **font-medium** en `App.jsx` (cargando, confirmación) y `LocationSearchInput`.
- **font-semibold** no aparece; el salto es de `font-medium` a `font-bold` y `font-black`, sin estándar claro para “subtítulo” vs “énfasis”.

### Mayúsculas y letter-spacing

- Labels: mezcla de `uppercase`, `uppercase tracking-wider`, `uppercase tracking-widest`, `normal-case`; a veces con `text-[10px] font-bold`, otras con `text-xs font-bold`. Misma función visual, clases distintas.

---

## 5. Veredicto de consistencia

**Nivel: Baja.**

- **Colores:** Uso mixto de hex/rgba en gráficos y mapas y Tailwind en el resto; duplicación del mismo color en varios formatos; un gris fuera de sistema (`#d6dde0`); paleta de leyenda del mapa lluvia totalmente hardcodeada.
- **Escala y espaciado:** Muchos `min-w`, `max-w`, `h`, `max-h` arbitrarios en px y rem; tamaños de pins en px en HTML inline; no hay escala de espaciado/tamaño única.
- **Componentes:** `Button` y `Card` existen y no se usan; botones, inputs y cards se repiten con variaciones; modales y pins de mapa sin abstracción.
- **Tipografía:** Mezcla de `text-[8px]`, `text-[9px]`, `text-[10px]` con `text-xs`/`text-sm` y de `font-medium`/`font-bold`/`font-black` sin regla clara; Recharts con `fontSize` en px aparte del sistema.

Recomendación para una siguiente fase: definir tokens de color y espaciado (variables CSS o tema Tailwind), unificar tipografía en una escala (evitar `text-[9px]`/`text-[10px]` o mapearlos a tokens), adoptar `Button`/`Card`/`Input`/`Modal` y centralizar el HTML de los pins de mapa.
