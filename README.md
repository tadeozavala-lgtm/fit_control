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
- Sustituciones cuando la máquina está ocupada, con historial propio por ejercicio.
- Progreso por ejercicio con minigráfica, respaldo JSON y exportación CSV.

## Correr el proyecto

```bash
npm install
npm run dev        # servidor local
npm test           # 85 tests
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
    sustituciones.js     alternativas ordenadas por patrón y equipo
    avisos.js            flash, campana, voz
  ui/                    render; nada de lógica de negocio aquí
scripts/validar-rutina.js
tests/                   85 tests
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
