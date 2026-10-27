# Notas para trabajar en este repo

App personal de Tadeo para registrar su entrenamiento. Se usa en el celular,
dentro del gimnasio, con una mano y con el teléfono normalmente en silencio.
Ese contexto manda sobre cualquier otra consideración.

## Reglas que no se rompen

1. **El peso se guarda siempre en kilogramos.** La unidad activa (`datos.unidad`)
   solo afecta lo que se muestra y lo que el usuario captura. Nunca guardar libras.
2. **El timer se basa en una hora de término absoluta**, nunca en un contador que
   resta por tick: iOS estrangula los timers en segundo plano.
3. **Todo aviso necesita canal visual.** Web Audio respeta el switch de silencio
   en iOS y Safari no soporta `navigator.vibrate`. El sonido es el extra.
4. **Cambiar la forma de los datos guardados exige subir `ESQUEMA_ACTUAL` y
   escribir su migración** en `src/logica/almacen.js`, con test. El historial de
   Tadeo no se puede perder.
5. **La lógica va en `src/logica/`, pura y testeada.** `src/ui/` solo pinta.
6. **Nada de re-render total al marcar una serie.** Actualizar solo la tarjeta
   afectada y los contadores; si no, se pierde el foco del input.
7. **Las zonas de pulso se calculan, nunca se escriben a mano.** Un rango fijo
   en `rutina.json` contradice el cálculo en cuanto cambie la FC en reposo. Hay
   un test que lo impide.
8. **Distancia en km, tiempo en segundos, ritmo en segundos por km.** Misma
   regla que el peso: una sola unidad guardada, la vista convierte.
9. **El plan de carrera no inventa días.** Reparte solo en los que Tadeo marca
   como libres, para que los cuatro de fuerza se respeten.
   Un día liberado (`ajustes.diasLiberados`) deja de bloquear esa fecha pero NO
   se borra de la rutina: si lo entrena, sus series cuentan igual. El piso es
   de tres días de fuerza, y lo decide `puedeLiberar()`, una sola regla.
10. **La progresión de volumen se calcula con el valor exacto y se redondea al
    publicar.** Redondear en cada paso acumula error y acaba incumpliendo la
    propia regla del 10%. Hay test.
11. **El gasto del entrenamiento se suma APARTE del factor de actividad.** Los
    factores de `ACTIVIDAD` son de vida diaria sin entrenar, a propósito: un
    factor "muy activo" ya incluye el ejercicio y sumarlo otra vez lo cuenta
    dos veces. Si tocas uno, revisa el otro.
12. **Los topes de nutrición no se negocian:** déficit máximo del 20%, nunca
    por debajo del metabolismo basal, proteína antes que nada. Un número más
    agresivo no acelera nada que valga la pena. Hay tests sobre cada tope.
13. **El historial se busca por EJERCICIO, nunca por día** (`sesionesConEjercicio`).
    El récord de un press de banca es del press de banca, no del lunes: si la
    rutina se rearma y el ejercicio cambia de día, sus marcas lo siguen.
14. **El generador recicla ids.** Un ejercicio que ya existía conserva el suyo y
    hereda su peso sugerido. Regenerar la rutina no puede costar meses de
    registro.
15. **El generador no toca los días de cardio.** `rutinaEnUso()` en `main.js`
    mezcla los días generados con los de cardio de `rutina.json`. Zona 2 y HIIT
    se manejan aparte.
16. **Si cambian los DÍAS y no solo su contenido, usa `app.pintarTodo()`**, no
    `app.pintar()`: la barra de pestañas también tiene que repintarse.
17. **Las fotos de técnica NO entran al precaché.** Son 3 MB contra los ~220 KB
    de la app: instalarla no puede costar eso por fotos que se miran de vez en
    cuando. Van por `runtimeCaching` (`CacheFirst` sobre `/ejercicios/`) y se
    guardan al abrirlas. Hay un test que vigila que `globPatterns` no incluya
    webp. Si alguna vez no cargan, el modal lo dice; nunca un hueco en blanco.
18. **`catalogoId` apunta al catálogo, no identifica al ejercicio.** Dos
    ejercicios distintos pueden compartir ficha y fotos ("Press banca ligero" y
    "Press banca con barra") y cada uno conserva su historial. Por eso
    `indiceIdsPrevios()` marca como ambigua la entrada compartida y deja que
    decida el nombre: si se reciclara a ciegas, regenerar movería meses de
    registro al ejercicio equivocado (ver regla 14).
19. **Al sustituir, todo lo que describe el MOVIMIENTO es del sustituto**:
    nombre, grupo, equipo y también `catalogoId`, que es de donde salen las
    fotos. Enseñar las del original bajo otro nombre es peor que no enseñar
    ninguna. La técnica escrita se cae (`tecnica: null`) porque el catálogo no
    la trae y la del original es de otro ejercicio; `sustituyeA` deja que la
    vista lo explique. Lo que NO cambia es la prescripción: series, reps, tempo
    y descanso son del hueco de la rutina.

## Al cambiar la rutina

Los ajustes que Tadeo hace desde la app viven en `datos.ajustesRutina` como una
CAPA, nunca como copia de la rutina: así hereda los despliegues nuevos. Lo que
alimenta otros cálculos (`grupo`, `equipo`, `patron`) no se edita desde la app.


`src/datos/rutina.json` es dato, no código. Correr `npm run validar` después de
tocarlo. `sugerido` siempre en kg o la cadena "peso corporal".

Todo ejercicio nuevo necesita `grupo` (y `secundarios` si aplica), o no cuenta
para el volumen semanal. Los grupos válidos están en `src/logica/volumen.js`.
También necesita `equipo`, `mecanica` y, si es compuesto, `patron`: de ahí sale
el orden de las sustituciones.

`src/datos/catalogo.json` NO se edita a mano: lo genera `npm run catalogo` desde
free-exercise-db. Para agregar una alternativa, edita la selección curada en
`scripts/importar-catalogo.js` y vuelve a correrlo.

`src/datos/imagenes.json` y `public/ejercicios/` tampoco: los genera
`npm run imagenes` desde la misma fuente. Un ejercicio nuevo de `rutina.json`
necesita `catalogoId` para tener fotos en la ventana de técnica; sin él la
ventana funciona igual, solo sin fotos.

## Idioma

Código, comentarios, commits, UI y tests en español. Los nombres de variables
también (`series`, `descanso`, `tonelaje`).

## Antes de hacer push

```bash
npm run validar && npm test && npm run build
```
