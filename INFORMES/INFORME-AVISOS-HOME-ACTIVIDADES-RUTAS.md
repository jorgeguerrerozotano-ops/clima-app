# Informe de auditoría: avisos en Home, Actividades y Rutas

## 1. Resumen ejecutivo

| Sección | Tipo de aviso | Qué se muestra al usuario |
|--------|----------------|---------------------------|
| **Home** | Alerta de precipitación (12h) | Una sola píldora: “próxima lluvia/nieve” con hora, mm/cm y % |
| **Home** | Actividades (resumen) | Tarjetas con punto de estado (verde/amarillo/rojo/gris), sin texto de aviso |
| **Actividades** | Por actividad | Estado (verde/amarillo/rojo/gris), mensaje corto, análisis expandido, 4 factores y “mejor momento” |
| **Rutas** | Por segmento | Estado (verde/amarillo/rojo), mensaje (“X alertas críticas” / “X advertencias”), 4 factores por segmento |

---

## 2. Home

### 2.1 Vista principal (HomeView)

- **Datos mostrados:** ubicación, hora local, temperatura (interpolada), sensación térmica, **etiqueta del tiempo actual** (`getWeatherInfo(weatherData.current.code)`), salida/puesta de sol, fase lunar.
- **Código de tiempo:** viene de `weatherData.current.code`, ya sanitizado en `useWeather.js` (probabilidad interpolada + `sanitizeCode`).

**Alerta de precipitación (única en Home):**

- **Origen:** `weatherData.analysis.hourlyForecast` (próximas 24h).
- **Condición:** primera hora en las **primeras 12** con `h.prob >= 30` (`HomeView.jsx`, línea 66).
- **Contenido mostrado:**
  - Icono de alerta (`AlertCircle`) + icono de tiempo (paraguas o copo).
  - **Hora** del slot (`nextRainEvent.time`).
  - **Cantidad:** mm (lluvia) o cm (nieve).
  - **Probabilidad:** `nextRainEvent.prob` %.
- **Estilo:** píldora azul (lluvia) o cyan (nieve), sin nivel “crítico/aviso” explícito; es informativa, no verde/amarillo/rojo.
- **Limitación:** no se muestra aviso si no hay ningún slot con prob ≥ 30 % en las próximas 12 h, aunque pueda llover después o con prob < 30 %.

### 2.2 Resumen de actividades (HomeSummary)

- **Datos:** hasta 4 actividades favoritas.
- **Evaluación:** `checkActivityRules(weatherData.rawHourly, startIndex, act.duration, act.rules)` con `startIndex` = hora actual.
- **Mostrado en tarjeta:**
  - Icono de actividad.
  - **Punto de estado:** verde / amarillo / rojo / gris (según `result.status`).
  - Nombre de la actividad.
- **No se muestra:** mensaje de aviso (`result.message`), análisis ni factores; solo el color del punto y el fondo de la tarjeta.
- **Interacción:** clic abre el modal de actividad (`ActivityModal`), donde sí se ve el mensaje y el detalle.

---

## 3. Actividades

### 3.1 Pestaña Actividades (ActivitiesTab)

- **Contexto:** misma ubicación que Home; modo “Ahora” o “Programar” (fecha + hora). El índice horario (`startIndex`) es la hora actual o la programada.
- **Evaluación:** misma función `checkActivityRules(weatherData.rawHourly, startIndex, act.duration, act.rules)` para cada actividad.

**Por cada actividad se muestra:**

1. **Estado (color):** verde / amarillo / rojo / gris → `result.status`.
2. **Mensaje corto:** `result.message`:
   - Verde: `"CONDICIONES IDEALES"` (`activities.idealConditions`).
   - Amarillo: `"{{count}} de 4 ADVERTENCIAS"` (`activities.warnings`).
   - Rojo: `"{{count}} de 4 CONDICIONES FUERA DE RANGO"` (`activities.conditionsOutOfRange`).
   - Gris: `"SIN DATOS"` (`activities.noData`).
3. **Al expandir:**
   - **Análisis:** `result.analysis` (frase que concatena críticos o advertencias).
   - **4 factores:** nombre, valor y color (verde/amarillo/rojo/gris) por factor.
   - **Mejor momento:** “Mejor momento en las próximas 48h” (modo Ahora) o “Alternativa (+/- 24h)” (Programar), si el estado no es verde.

**Lógica de evaluación (activitiesConfig.js):**

- **Running (estándar):** Temp (sensación), Precip (lluvia/nieve), Viento, Suelo. Incluye AQI > 150 como crítico si hay datos.
- **Moto:** Temp, Viento, Calzada (nieve / lluvia / suelo mojado / prob>15 % y mm>0), Visibilidad (niebla WMO 45/48, lluvia fuerte).
- **Colada:** Temp, Humedad, Lluvia (ventana 12h), Viento.

Los mensajes de aviso que ve el usuario son los textos i18n de `criticals` y `warnings` (ej. “Riesgo Lluvia”, “Asfalto húmedo”, “Frío intenso”), unidos en `result.analysis`.

### 3.2 Modal de actividad (ActivityModal)

- Se abre al elegir una actividad desde Home (resumen).
- **Misma evaluación:** `checkActivityRules(..., startIndex...)` con hora actual.
- **Mostrado:**
  - Estado y **mensaje** (`result.message`).
  - **Análisis** (`result.analysis`) en cursiva.
  - **4 factores** en grid (icono, valor, nombre).
  - Si no es verde ni gris: bloque “Mejor momento en las próximas 48h” con primera hora en verde encontrada.

**Consistencia:** En Home (resumen) solo se ve el punto de color; en Actividades (lista y modal) se ve el mismo mensaje y análisis que genera `checkActivityRules` para esa hora y actividad.

---

## 4. Rutas

### 4.1 Origen de datos

- **useRouteWeather:** para cada punto (origen, puntos intermedios, destino) se obtiene pronóstico en la hora de llegada con `getForecastAtTime(hourlyData, targetDateObj)`.
- El `code` mostrado y usado en evaluación está sanitizado con **probabilidad horaria** pasada a `sanitizeCode` (misma lógica que en Home para consistencia).

### 4.2 Qué se muestra por segmento (RouteView)

Para cada segmento (Salida, En ruta 1 / paradas, Llegada):

1. **Cabecera:** nombre del segmento, hora de llegada, km restantes al destino (y en paradas: “Editar en mapa” / “Quitar”).
2. **Mensaje de aviso:** `data.message`:
   - Verde: `"CONDICIONES IDEALES"` (mismo i18n que actividades).
   - Amarillo: `"{{count}} Advertencias"` (`routes.warningsCount`).
   - Rojo: `"{{count}} ALERTAS CRÍTICAS"` (`routes.criticalAlerts`).
   - Sin datos: `"Sin datos"` (`routes.noDataShort`).
3. **4 factores** en grid: icono, valor, nombre; cada uno con color según su `status` (verde/amarillo/rojo).

No hay texto de “análisis” (frase explicativa); solo mensaje sintético + factores.

### 4.3 Lógica de evaluación por modo (useRouteWeather.js)

- **Moto:** Temp (<2 °C crítico, <5 °C aviso), Viento (>45 / >30 km/h), Calzada (nieve, lluvia >4 mm, ≥0.1 mm, suelo mojado), Visibilidad (código 48/45, lluvia >2 mm).
- **Coche:** Hielo (temp <0 y agua/suelo mojado), Viento (90/60 km/h), Lluvia/Nieve (umbrales en mm), Visibilidad (niebla, lluvia >10 mm).
- **A pie:** Temp (calor >35 °C, frío <-5 °C / <5 °C), Precip, Viento, Suelo (hielo/suelo mojado).

Los “avisos” en Rutas son por tanto: número de críticos o de advertencias + detalle en los 4 factores (valor y color).

---

## 5. Comparativa y observaciones

| Aspecto | Home | Actividades | Rutas |
|--------|------|-------------|--------|
| **Niveles de aviso** | No (solo píldora “próxima lluvia”) | Verde / Amarillo / Rojo / Gris | Verde / Amarillo / Rojo |
| **Mensaje corto** | No en actividades resumen | Sí (ideal / N advertencias / N fuera de rango) | Sí (ideal / N advertencias / N alertas críticas) |
| **Análisis en texto** | No | Sí (al expandir / en modal) | No |
| **Factores detallados** | No | Sí (4 por actividad) | Sí (4 por segmento) |
| **Criterio lluvia** | prob ≥ 30 % en 12h para mostrar píldora | Por actividad (moto: prob>15 % y mm; running: mm o prob>40 %) | Por modo (mm, suelo mojado, visibilidad) |
| **Código tiempo** | Sanitizado (useWeather + interpolación prob) | Sin sanitizar en actividades (código raw horario) | Sanitizado (getForecastAtTime + prob) |

**Inconsistencias detectadas:**

1. **Actividades (lista/modal)** usan `weatherData.rawHourly` y **no aplican** `sanitizeCode` al `weather_code` del slot; el código WMO que alimenta evaluadores (p. ej. niebla 45/48) es el raw. En Home y Rutas el código mostrado sí está sanitizado.
2. **Home resumen de actividades:** no muestra el mensaje de aviso, solo el color; el usuario debe abrir el modal para ver “N advertencias” o “condiciones fuera de rango”.
3. **Rutas** no muestran una frase de análisis (solo “N alertas críticas” / “N advertencias” + factores), a diferencia de Actividades donde sí se muestra el análisis expandido.

---

## 6. Resumen de mensajes de aviso por sección

- **Home:**  
  - Una alerta de “próxima precipitación” (hora + mm/cm + %) si en las próximas 12 h hay prob ≥ 30 %.  
  - Actividades: solo indicador de color (verde/amarillo/rojo/gris), sin texto.

- **Actividades:**  
  - Mensaje: “CONDICIONES IDEALES” / “X de 4 ADVERTENCIAS” / “X de 4 CONDICIONES FUERA DE RANGO” / “SIN DATOS”.  
  - Análisis: concatenación de críticos o advertencias.  
  - Factores: 4 con nombre, valor y estado.  
  - Sugerencia de mejor momento si no es verde.

- **Rutas:**  
  - Mensaje: “CONDICIONES IDEALES” / “X Advertencias” / “X ALERTAS CRÍTICAS” / “Sin datos”.  
  - Factores: 4 por segmento (Temp, Viento, Calzada/Precip, Visibilidad/Suelo según modo).  
  - Sin texto de análisis.
