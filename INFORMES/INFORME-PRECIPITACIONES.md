# Informe: Probabilidad de precipitaciones en Mi Clima App

## 1. Qué recibimos de Open-Meteo

### 1.1 API principal (Home / pronóstico)

En **`useWeather.js`** se pide a Open-Meteo:

- **Current:** `precipitation`, `snowfall`, `snow_depth` (no probabilidad en `current`).
- **Daily:** `precipitation_probability_max` (máxima probabilidad del día).
- **Hourly:** `precipitation_probability`, `precipitation`, `snowfall`, `snow_depth`.

- **`precipitation_probability` (hourly):** array de enteros 0–100 (% por hora).
- **`precipitation` (hourly/current):** mm esperados en esa hora (o valor actual).
- **`precipitation_probability_max` (daily):** se solicita pero **no se usa** en la UI actual.

### 1.2 API de rutas

En **`useRouteWeather.js`**:

- **Current:** `precipitation`, `snowfall`, `snow_depth`.
- **Hourly:** `precipitation_probability`, `precipitation`, `snowfall`, `snow_depth`.

Misma semántica: probabilidad en % y precipitación en mm por hora.

---

## 2. Cálculos internos y uso de la probabilidad

### 2.1 Índice horario “actual”

Se busca la hora actual en `hourly.time` para alinear todos los arrays (probabilidad, mm, código, etc.):

- **Probabilidad “actual”:** siempre del array **hourly** (`precipitation_probability[index]`), nunca de `current`.
- **Precipitación actual:** hourly si hay índice, si no `current.precipitation`.

### 2.2 Sanitización del código tiempo (`helpers.sanitizeCode`)

Se usa **probabilidad + mm** para evitar iconos de lluvia cuando no hay precipitación real ni riesgo alto:

| Condición | Efecto |
|-----------|--------|
| `rainProb < 30` y códigos 51–67 u 80–82 | Se fuerza **3** (nublado). |
| `precipMM < 0.15` y código de lluvia (salvo tormenta/nieve) | Se fuerza **3**. |
| `precipMM < 1.5` | Se baja intensidad: 65→63, 82→81, 81→80. |

En **Home** se aplica a la hora actual y a todas las horas futuras.

En **Rutas** solo se pasa **mm**, no probabilidad (por defecto `rainProb = 100`). Ahí no se aplica el filtro “prob < 30% → nublado”.

### 2.3 Texto “próxima lluvia” (`nextRainText`)

- **Umbral “lloviendo ahora”:** `currentPrecipMM >= 0.15` o nieve > 0.
- **Próxima lluvia significativa:** primera hora con **mm ≥ 0.25 y prob ≥ 30%**.

`nextRainText` se calcula pero **no se pinta** en el JSX actual de `HomeView.jsx`; sí se usa la alerta de “próxima lluvia en 12h”.

### 2.4 Texto de intensidad (`getRainText`)

Combina **probabilidad y mm** para el texto (“posible”, “probable”, “asegurada”, etc.):

- **< 30%:** “Posible …”
- **30–69%:** “Probable …”
- **≥ 70%:** “… asegurada” (o textos especiales para llovizna/nieve).

La intensidad (llovizna, débil, moderada, fuerte) se basa en **mm**, no en la probabilidad.

### 2.5 Alerta “próximas 12h” en Home

Se considera “evento de lluvia” la primera hora en las próximas 12 con **prob ≥ 30%** (sin exigir mm).

Se muestra hora, mm/cm y **probabilidad (%)** en la píldora de alerta (icono paraguas/nieve).

### 2.6 Colada (laundry)

Se considera que hay precipitación si **hay mm en las próximas 12h o prob > 0** en la hora de inicio. Si `hasPrecip`, la actividad pasa a rojo (“precipitación prevista”).

### 2.7 Running

Aviso amarillo de “riesgo de lluvia” si **hay mm > 0 o (prob > 40 y mm === 0)**.

### 2.8 Rutas

En **`useRouteWeather.js`** se usa `precipitation_probability` solo para el snapshot en un instante (no para texto tipo `getRainText`). La evaluación de moto/a pie usa **mm** y nieve, no umbrales explícitos de probabilidad en la UI.

---

## 3. Qué pintamos en la app (probabilidad e iconos)

### 3.1 Dato que llega al estado

Tras `processWeatherData`:

- **Hora actual:** `current.precip` (mm), no se guarda probabilidad actual en `current`.
- **Por hora (futuro):** cada elemento de `hourlyForecast` tiene `prob`, `mm`, `iconCode` (ya sanitizado), `snowCM`, etc.

Todo lo que se pinta de “probabilidad” en Home viene de este **`prob`** (array hourly de Open-Meteo, mismo orden que las horas).

### 3.2 Carrusel horario (HomeView)

- **Icono:** `getIconForCode(h.iconCode, h.isDay)` → el icono depende del **código ya sanitizado** (por tanto de prob + mm).
- **Color del icono:** si `h.prob >= 30` → azul/cyan; si no, ámbar (día) o gris (noche).
- **Texto y barra:** se muestra `h.prob` en % y una barra cuya altura es `Math.min((nieve ? snowCM : mm) * 4 + 4, 12)` (basada en **mm/nieve**, no en prob).

Resumen: **prob** se muestra en % y define el color del icono; la **altura de la barra** es volumen (mm/nieve).

### 3.3 WeeklyForecast (próximos días)

- **Por periodo (mañana/tarde/noche):** la probabilidad que se muestra es el **máximo** de `precipitation_probability` en las horas de ese periodo (no `daily.precipitation_probability_max`).
- **Detalle horario del día:** se usa `hourly.precipitation_probability[actualIndex]` y `hourly.precipitation[actualIndex]` tal cual (sin sanitizar el código en ese componente; los códigos vienen del `rawHourly`).
- **Icono de precipitación:** `Droplets` (lluvia) o `Snowflake` (nieve); color `text-blue-400` / `text-cyan-300`.
- **Barra en el carrusel del día:** altura proporcional a mm o nieve, se muestra `h.rainProb` en %.

### 3.4 Iconos de tiempo (WeatherIconMain / getIconForCode)

- **WeatherIconMain** (`ui/WeatherIconMain.jsx`): recibe `code` (ya sanitizado en Home). Asigna icono Wi-* por rango de código (0, 1–3, 45–48, 51–67, 71–77, 80–82, 95–99, etc.). No recibe probabilidad; el “filtro” de probabilidad ya está aplicado en el `code`.
- **getIconForCode** (HomeView, WeeklyForecast): Lucide (Sun, Moon, CloudSun, CloudRain, Snowflake, CloudLightning). Misma idea: código → icono; la probabilidad solo afecta **color** en el carrusel (azul/cyan si prob ≥ 30).

Nieve vs lluvia en iconos y barras:

- Nieve: `snowCM > 0` o códigos 71–77, 85–86.
- Lluvia: resto de códigos de precipitación; icono CloudRain/Droplets y color azul.

---

## 4. Resumen de flujo

| Origen | Dato Open-Meteo | Cálculo interno | Qué se pinta |
|--------|------------------|-----------------|--------------|
| Hourly | `precipitation_probability[i]` | Índice = hora actual; slice desde ahí | `prob` en % en carrusel y alerta 12h |
| Hourly | `precipitation[i]` | Mismo índice; sanitizeCode(code, mm, prob) | Icono (vía código), barra (altura mm), texto “próxima lluvia” |
| Daily | `precipitation_probability_max` | Ninguno | No se usa en la UI |
| Alert 12h | `hourlyForecast[0..12].prob` | Primera hora con prob ≥ 30% | Píldora con hora, mm/cm y % |
| WeeklyForecast | `hourly.precipitation_probability` | Máximo por periodo (mañana/tarde/noche) | % por periodo y por hora en el día expandido |

---

## 5. Detalles relevantes

1. **`precipitation_probability_max` (daily)** se pide pero no se usa; la “probabilidad del día” en la app es el máximo horario calculado en el cliente.
2. **Rutas:** `sanitizeCode` se llama sin probabilidad, por lo que el filtro “prob < 30% → nublado” no se aplica en rutas.
3. **Umbrales fijos:** 30% (alerta y “lluvia significativa”), 40% (aviso running), 0.15 mm (“lloviendo”), 0.25 mm (próxima lluvia).
4. **Barras:** siempre representan **volumen** (mm o cm nieve), no probabilidad.
5. **RainMapView:** usa capas de radar/satélite (tiles externos), no datos de probabilidad de Open-Meteo.
6. **modelConsensus.js:** solo consenso de **temperatura**; no interviene en precipitación ni probabilidad.
