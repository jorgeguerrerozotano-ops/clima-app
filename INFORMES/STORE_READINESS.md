# Store Readiness Audit — Google Play / PWA

**Proyecto:** mi-clima-app  
**Fecha:** 13 de febrero de 2025  
**Alcance:** Preparación para build final y publicación (TWA/Bubblewrap, Capacitor o PWA).

---

## Resumen ejecutivo

| Estado        | Cantidad |
|---------------|----------|
| ✅ LISTO      | 5        |
| ⚠️ ADVERTENCIA| 8        |
| 🛑 BLOQUEANTE | 4        |

**Veredicto:** **No ejecutar `npm run build` para subida a tienda** hasta resolver los **bloqueantes**. Las advertencias no impiden subir pero mejoran la calidad percibida y el cumplimiento.

---

## 1. Identidad y Manifiesto ("The Store Face")

### Manifest (PWA / TWA)

| Elemento | Estado | Detalle |
|----------|--------|---------|
| Archivo `manifest.json` | 🛑 **BLOQUEANTE** | No existe `public/manifest.json` (ni referenciado en `index.html`). Para PWA/TWA es obligatorio. |
| `name` | 🛑 **BLOQUEANTE** | Depende del manifest; actualmente no definido. |
| `short_name` | 🛑 **BLOQUEANTE** | Idem. |
| `theme_color` | ⚠️ ADVERTENCIA | No definido (falta manifest). Debe coincidir con la barra de estado en Android. |
| `background_color` | ⚠️ ADVERTENCIA | No definido. Recomendado para splash y fondo al cargar. |
| Iconos 192×192 y 512×512 | 🛑 **BLOQUEANTE** | En `public/` solo está `vite.svg`. Faltan iconos en tamaños requeridos (192, 512). |
| Iconos `purpose: "any maskable"` | ⚠️ ADVERTENCIA | Al crear el manifest, incluir `"purpose": "any maskable"` en cada icono para iconos adaptativos en Android (evitar recorte o fondo blanco). |

### Meta tags (`index.html`)

| Elemento | Estado | Detalle |
|----------|--------|---------|
| Viewport | ✅ LISTO | `width=device-width, initial-scale=1.0, viewport-fit=cover` — correcto para móvil y safe area. |
| Zoom accidental | ⚠️ ADVERTENCIA | No se usa `user-scalable=no`. Si se desea evitar zoom accidental, se puede añadir (pero perjudica accesibilidad; valorar según producto). |
| Meta `theme-color` | ⚠️ ADVERTENCIA | No existe `<meta name="theme-color" content="...">`. Debe estar alineado con el manifest para la barra de estado. |
| Título | ⚠️ ADVERTENCIA | `<title>mi-clima-app</title>` — nombre técnico; recomendable un título de producto para la tienda (ej. "Mi Clima"). |
| Favicon / icono | ⚠️ ADVERTENCIA | Solo `href="/vite.svg"`; conviene sustituir por el icono real de la app. |

---

## 2. Experiencia nativa Android

### Botón "Atrás" (historial)

| Elemento | Estado | Detalle |
|----------|--------|---------|
| Navegación tipo SPA | ✅ LISTO | La app usa estado interno (`activeTab`: inicio, rutas, colada, mapa, historia) sin React Router. |
| Gestión del botón Atrás | ⚠️ ADVERTENCIA | No hay escucha de `popstate` ni de evento back de Android. En TWA/PWA, al pulsar Atrás puede salir de la app en la primera pulsación. Recomendación: usar History API (pushState al cambiar de pestaña) y escuchar `popstate` para volver a la pestaña anterior o a "inicio" antes de salir. |

### Overscroll / Pull-to-refresh

| Elemento | Estado | Detalle |
|----------|--------|---------|
| Overscroll elástico | ⚠️ ADVERTENCIA | No hay reglas CSS para `overscroll-behavior: none` (o similar) en `body`/contenedor principal. En WebView/TWA el rebote puede verse poco pulido. |
| Pull-to-refresh nativo | ⚠️ ADVERTENCIA | No desactivado. En Chrome/WebView puede aparecer el pull-to-refresh del navegador. Recomendación: en el contenedor con scroll (ej. `main`), usar `overscroll-behavior-y: contain` o `none` según diseño. |

### Selección de texto (UI tipo app)

| Elemento | Estado | Detalle |
|----------|--------|---------|
| `user-select` en controles | ⚠️ ADVERTENCIA | Solo un componente usa `select-none` (RouteFavorites). En el resto (botones, barra inferior, menús) no se aplica `user-select: none`. La selección de texto en barras y botones puede dar sensación de "página web". Recomendación: aplicar `select-none` (Tailwind) o `user-select: none` en barra de navegación, botones y controles interactivos. |

---

## 3. Configuración de producción (Build)

### Depuración

| Elemento | Estado | Detalle |
|----------|--------|---------|
| Console en producción | ✅ LISTO | Casi todos los `console.warn` están envueltos en `import.meta.env.DEV`. |
| Excepción | ⚠️ ADVERTENCIA | `LocationSearchInput.jsx` (aprox. línea 123): `console.warn('ORS fallback error:', orsErr)` sin guarda `DEV`. En producción puede seguir escribiendo en consola. Recomendación: envolver en `if (import.meta.env.DEV)`. |

### Sourcemaps

| Elemento | Estado | Detalle |
|----------|--------|---------|
| Sourcemaps en build | ✅ LISTO | En `vite.config.js` no se define `build.sourcemap`. Vite por defecto no genera sourcemaps en producción, lo que es adecuado para tamaño y seguridad. |

### Versionado

| Elemento | Estado | Detalle |
|----------|--------|---------|
| `package.json` version | 🛑 **BLOQUEANTE** | Actualmente `"version": "0.0.0"`. Para la tienda debe ser una versión explícita (ej. `1.0.0`). Necesario para el proceso de build (TWA/Capacitor) y para la ficha en Google Play. |

### Build (Vite)

| Elemento | Estado | Detalle |
|----------|--------|---------|
| Configuración base | ✅ LISTO | `vite.config.js` con React, límite de chunk razonable; sin opciones que impidan un build de producción correcto. |

---

## 4. Cumplimiento y permisos (política Google)

### Geolocalización

| Elemento | Estado | Detalle |
|----------|--------|---------|
| Uso de GPS | ✅ LISTO | Se usa en primer plano (clima en ubicación actual, rutas, historial). No se detecta uso en segundo plano. |
| Explicación antes del popup | ✅ LISTO | Al arrancar se muestra "Obteniendo tu ubicación..." y el texto traducido tipo "Permite el acceso a la ubicación para ver el tiempo de tu zona al instante" (`location.loadingHint`). El usuario ve el motivo en pantalla cuando puede aparecer el diálogo nativo. Cumple buena práctica de contexto. |
| Textos tras denegación | ✅ LISTO | Mensajes claros (permiso denegado, no disponible, timeout) y opción de buscar ciudad sin ubicación. |

---

## Lista de verificación consolidada

### ✅ LISTO

- Viewport en `index.html` correcto para móvil y viewport-fit.
- Sin React Router: navegación por estado; estructura simple.
- Console en producción: prácticamente todo protegido con `import.meta.env.DEV`.
- Sourcemaps: no generados en producción (comportamiento por defecto de Vite).
- Geolocalización: explicación en UI y uso en primer plano; textos de denegación y alternativa.

### ⚠️ ADVERTENCIA

- Falta `theme_color` y `background_color` (al crear manifest).
- Iconos con `purpose: "any maskable"` al definir manifest.
- Valorar `user-scalable=no` solo si se prioriza evitar zoom accidental (impacto en accesibilidad).
- Meta `theme-color` en `index.html` alineado con manifest.
- Título y favicon de producto en `index.html`.
- Gestión del botón Atrás (History API + `popstate`) para comportamiento tipo app.
- Control de overscroll / pull-to-refresh en el contenedor de scroll.
- `user-select: none` en barras, botones y controles.
- Un `console.warn` en `LocationSearchInput.jsx` sin guarda `DEV`.

### 🛑 BLOQUEANTE

1. **Crear `public/manifest.json`** con al menos: `name`, `short_name`, `theme_color`, `background_color`, iconos 192 y 512 (y enlazarlo desde `index.html` con `<link rel="manifest" href="/manifest.json">`).
2. **Añadir iconos de app** en 192×192 y 512×512 en `public/` (y referenciarlos en el manifest).
3. **Cambiar la versión en `package.json`** de `0.0.0` a una versión de release (ej. `1.0.0`).

---

## Acciones recomendadas antes de `npm run build` (para tienda)

1. Crear `public/manifest.json` con identidad, colores e iconos (192, 512; `purpose: "any maskable"`).
2. Añadir iconos 192×192 y 512×512 (PNG) en `public/` y referenciarlos en el manifest.
3. En `index.html`: `<link rel="manifest" href="/manifest.json">`, meta `theme-color` y, opcionalmente, título y favicon de producto.
4. En `package.json`: `"version": "1.0.0"` (o la versión que vayas a publicar).
5. (Opcional pero recomendado) Envolver el `console.warn` de ORS en `LocationSearchInput.jsx` con `import.meta.env.DEV`.
6. (Opcional) Mejorar sensación nativa: overscroll, `user-select` en UI, y manejo del botón Atrás con History API.

Cuando los **bloqueantes** estén resueltos, puedes dar **luz verde** para ejecutar `npm run build` con vistas a la tienda. Si quieres, el siguiente paso puede ser redactar el contenido concreto de `manifest.json` y los cambios en `index.html` y `package.json`.
