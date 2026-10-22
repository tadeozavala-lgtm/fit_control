# fit_control

Registro de entrenamiento del **Protocolo Recomposición 4D + 5 Cardio**: 4 días de
fuerza (Push, Pull, Legs, Full Body) y 5 de cardio (3 de carrera en Zona 2, 2 de
HIIT de box). PWA sin dependencias de runtime, pensada para usarse con una mano,
con el teléfono en silencio y sin señal dentro del gimnasio.

## Qué hace

- Registro de series: peso, repeticiones y check, en **kg o lb** (se guarda siempre en kg).
- Timer de descanso que arranca solo al marcar una serie, con la duración prescrita.
- Comparación contra la sesión anterior y marca de récord en dorado (1RM estimado, Epley).
- Autollenado del peso de la última sesión, ajustado si toca semana de descarga.
- Pista de progresión: cuándo subir carga y cuándo bajarla.
- Guías de técnica por ejercicio, con tabla de equivalencias kg↔lb y referencia de discos.
- Secuenciador de HIIT que canta los bloques en voz alta (opcional).
- Volumen semanal por grupo muscular contra su rango de referencia.
- Notas de sesión (sueño, energía, molestias) con alerta de fatiga acumulada.
- Running: zonas de pulso propias, registro de rodajes y predicción de tiempos.
- Editor de prescripción desde el teléfono, como capa encima de la rutina.
- Generador de planes de 5K, 10K y media maratón sobre tus días disponibles.
- Sustituciones cuando la máquina está ocupada, con historial propio por ejercicio.
- Progreso por ejercicio con minigráfica, respaldo JSON y exportación CSV.

## Correr el proyecto

```bash
npm install
npm run dev        # servidor local
npm test           # 279 tests
npm run validar    # valida rutina.json
npm run catalogo   # regenera el catálogo de sustituciones
npm run build      # genera dist/
```

## Instalar en el iPhone

1. Deja que Actions despliegue a GitHub Pages (Settings → Pages → Source: GitHub Actions).
2. Abre la URL **en Safari** (Chrome no ofrece la opción).
3. Compartir → **Añadir a pantalla de inicio**.

Queda con ícono propio, pantalla completa y funciona sin señal. Cuando haya una
versión nueva, la app muestra una barra para actualizar en vez de exigir dos
arranques.

## Editar la rutina

Todo vive en [`src/datos/rutina.json`](src/datos/rutina.json). No hay que tocar
código para cambiar un ejercicio:

```json
{
  "id": "pu1",
  "nombre": "Press banca con barra",
  "series": 4,
  "reps": "8",
  "repMax": 8,
  "tempo": "3-1-1-0",
  "rir": 2,
  "sugerido": "55–60 kg",
  "grupo": "pecho",
  "secundarios": ["triceps", "hombro"],
  "descanso": 120
}
```

- `repMax` es el tope del rango: al alcanzarlo en todas las series, la app sugiere subir peso.
- `sugerido` **siempre en kg**; la conversión a libras es automática.
- `grupo` y `secundarios` alimentan el volumen semanal. Sin `grupo`, el ejercicio
  no cuenta; el validador lo marca como error. Los grupos válidos están en
  `src/logica/volumen.js`.
- `equipo`, `mecanica` y `patron` ordenan las sustituciones. Un remo propone
  otros remos, no dominadas.
- `descanso` en segundos.

Desde el iPhone: [Working Copy](https://workingcopy.app) para editar y hacer
commit. Al hacer push, Actions corre `npm run validar` y los tests antes de
desplegar, así que un JSON roto nunca llega al teléfono.

## Estructura

```
src/
  datos/rutina.json      la rutina completa (editable sin tocar código)
  datos/catalogo.json    92 alternativas, generado con npm run catalogo
  logica/                funciones puras, 100% cubiertas por tests
    unidades.js          conversión kg ↔ lb
    fuerza.js            1RM estimado, progresión, récords, descarga
    almacen.js           persistencia, versión de esquema, migraciones, respaldo
    reloj.js             temporizador por hora de término
    secuencia.js         construye los bloques de HIIT desde el JSON
    volumen.js           series efectivas por grupo y semana ISO
    notas.js             señales de sesión y detección de fatiga
    carrera.js           zonas Karvonen, ritmos, Riegel y VDOT
    ajustes-rutina.js    capa de edición encima de rutina.json
    plan.js              generador de planes de carrera
    sustituciones.js     alternativas ordenadas por patrón y equipo
    avisos.js            flash, campana, voz
  ui/                    render; nada de lógica de negocio aquí
scripts/validar-rutina.js
tests/                   279 tests
```

## Decisiones que vale la pena conocer

**El peso se guarda siempre en kilogramos.** La unidad elegida solo afecta lo que
se muestra y lo que se captura. Así se puede alternar kg/lb a media sesión sin
desordenar el historial.

**El timer guarda una hora de término absoluta, no un contador.** iOS estrangula
los timers en segundo plano; un contador que resta 1 por tick se desfasa minutos.
Hay un test que simula 118 segundos congelados y verifica que la cuenta siga bien.

**El aviso principal es visual, no sonoro.** En iOS, Web Audio respeta el switch
de silencio y Safari no soporta vibración. El flash a pantalla completa es el
único canal que funciona siempre; la campana es el extra.

**Cada cambio de forma de los datos sube `ESQUEMA_ACTUAL` y agrega su migración**
en `almacen.js`. Un respaldo viejo siempre se puede restaurar.

## Planes de carrera

La pestaña Plan genera un bloque para 5K (8 semanas), 10K (10) o media maratón
(12). Se le dan los días libres y reparte ahí: **no inventa días**, así que los
cuatro de fuerza se respetan y el configurador marca con un punto los que ya
están ocupados.

Reglas de la progresión:

- El volumen sube como mucho **10% entre semanas de carga**. La comparación salta
  las descargas a propósito: la regla habla de progresión de carga, no de la
  diferencia entre una semana suave y la siguiente dura.
- **Descarga cada cuarta semana** al 75%, salvo dentro del afinamiento.
- La fase base no mete calidad. Primero volumen, que es lo que protege de la
  lesión; el tempo entra en construcción y las series solo en el 5K.
- La tirada larga va al último día libre y nunca pega con otra sesión dura.
- Si ya corres más o menos de lo que el bloque supone, todo se escala para no
  pegar un salto el primer día.

Los ritmos salen de tu marca en la pestaña Z2, no de una tabla. Sin marca el
plan se genera igual, pero sin ritmos.

## Editar desde el gimnasio

El lápiz de cada ejercicio abre un editor de series, reps, tempo, RIR, descanso
y peso sugerido. Los cambios se guardan como una **capa encima** de
`rutina.json`, no como una copia: si se despliega una versión nueva de la rutina,
conservas tus ajustes y heredas todo lo demás.

El músculo, el equipo y el patrón de movimiento no se editan ahí porque
alimentan el volumen semanal y el orden de las sustituciones; para eso se edita
`rutina.json` y se commitea.

Subir las series añade filas; bajarlas solo quita las que están vacías. Una
serie ya registrada no se borra nunca por cambiar un número.

## Running

La pestaña Z2 calcula tus zonas con **Karvonen** sobre la frecuencia cardiaca de
reserva (máxima menos reposo), no sobre la máxima pelada: con el mismo máximo,
dos personas con distinto reposo entrenan a pulsaciones distintas. La máxima se
estima con Tanaka (208 − 0.7 × edad), y se puede sustituir por una medida real.

Ahí mismo se registran los rodajes (distancia, tiempo, tipo, pulso y esfuerzo),
con kilómetros y ritmo medio de la semana, y un aviso si subes más de 10% de
volumen respecto a la semana anterior.

El predictor usa **Riegel** (T₂ = T₁ × (D₂/D₁)^1.06) para estimar tiempos en
otras distancias, y marca las que quedan a más de cuatro veces tu distancia de
referencia, donde la fórmula se vuelve optimista. Los ritmos de entrenamiento
salen del ritmo de umbral, despejado de Riegel como el que sostendrías una hora.

Todas las fórmulas están implementadas desde cero; no se reproducen tablas
publicadas de ningún libro.

## Notas de sesión

Al pie de cada día de fuerza hay tres escalas de 1 a 5 (sueño, energía, molestias)
y un campo de texto. Con 4 días de fuerza, 5 de cardio y déficit calórico, el
estancamiento se anuncia antes en esas señales que en los pesos.

Dos sesiones seguidas con sueño o energía en 2 o menos, o molestias repetidas en
3 o más, disparan una alerta con qué hacer. Una sola sesión mala no dice nada:
todos tenemos días.

## Sustituciones

Si la máquina está ocupada, el botón ⇄ de cada ejercicio ofrece alternativas del
mismo grupo muscular, priorizando **otro equipo** y **el mismo patrón de
movimiento**. La prescripción no cambia (mismas series, reps, tempo y descanso),
las series cuentan igual para el volumen semanal, y el historial del sustituto
se guarda aparte para no contaminar los récords del original.

El catálogo son 92 ejercicios seleccionados y traducidos de
[free-exercise-db](https://github.com/yuhonas/free-exercise-db) (The Unlicense,
dominio público), generados con `npm run catalogo` y commiteados: la app no
depende de la red en tiempo de ejecución.

## Respaldo

Pestaña Progreso → *Respaldar (JSON)*. Los datos viven solo en el teléfono:
conviene hacerlo cada 3 o 4 semanas. *Restaurar respaldo* fusiona en vez de
sobrescribir, y ante conflicto se queda con la sesión más completa.

## Pendientes

Ver los issues abiertos. Lo principal: volumen semanal por grupo muscular,
sustituciones de ejercicio y notas de sesión (sueño, energía, molestias).
