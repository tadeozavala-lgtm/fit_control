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

## Al cambiar la rutina

`src/datos/rutina.json` es dato, no código. Correr `npm run validar` después de
tocarlo. `sugerido` siempre en kg o la cadena "peso corporal".

Todo ejercicio nuevo necesita `grupo` (y `secundarios` si aplica), o no cuenta
para el volumen semanal. Los grupos válidos están en `src/logica/volumen.js`.
También necesita `equipo`, `mecanica` y, si es compuesto, `patron`: de ahí sale
el orden de las sustituciones.

`src/datos/catalogo.json` NO se edita a mano: lo genera `npm run catalogo` desde
free-exercise-db. Para agregar una alternativa, edita la selección curada en
`scripts/importar-catalogo.js` y vuelve a correrlo.

## Idioma

Código, comentarios, commits, UI y tests en español. Los nombres de variables
también (`series`, `descanso`, `tonelaje`).

## Antes de hacer push

```bash
npm run validar && npm test && npm run build
```
