/**
 * Fotos de técnica de cada ejercicio.
 *
 * Son dos por ejercicio, inicio y fin del movimiento. Alternarlas enseña la
 * mecánica mejor que una sola foto y mucho mejor que un párrafo, sin el peso
 * ni las dependencias de un vídeo.
 *
 * Las fotos NO están en el precaché del service worker: la app instalada pesa
 * ~100 KB y meterle 3 MB de fotos la volvería lenta de instalar para algo que
 * se mira de vez en cuando. Se cachean al abrirlas por primera vez. De ahí que
 * `necesitaRed()` exista: hay que poder avisar antes de que el usuario se
 * quede mirando un hueco en blanco en el sótano del gimnasio.
 */

import manifiesto from "../datos/imagenes.json";

export const CARPETA = "ejercicios/";
export const MS_POR_CUADRO = 1100;

/** Las fotos de un ejercicio, por su id de catálogo. */
export function fotosDe(catalogoId) {
  if (!catalogoId) return [];
  return (manifiesto.por[catalogoId] || []).map((f) => CARPETA + f);
}

/**
 * Las fotos de un ejercicio de la rutina.
 *
 * Mira primero `catalogoId` y, si no lo tiene, prueba con el propio id: los
 * ejercicios que el generador saca del catálogo usan el id del catálogo como
 * identificador cuando no reciclan uno anterior.
 */
export function fotosDeEjercicio(ejercicio) {
  if (!ejercicio) return [];
  const porCatalogo = fotosDe(ejercicio.catalogoId);
  if (porCatalogo.length) return porCatalogo;
  return fotosDe(ejercicio.id);
}

export function tieneFotos(ejercicio) {
  return fotosDeEjercicio(ejercicio).length > 0;
}

/** Cuántos ejercicios del catálogo traen fotos. */
export function cuantosConFotos() {
  return Object.keys(manifiesto.por).length;
}

export const FUENTE = manifiesto.fuente;

/**
 * Si hacen falta estas fotos de la red.
 *
 * Solo sirve de pista para avisar: el navegador puede tenerlas cacheadas de
 * una visita anterior y `navigator.onLine` miente a menudo. Por eso la vista
 * las intenta cargar igual y solo enseña el aviso si fallan de verdad.
 */
export function necesitaRed(ventana = globalThis) {
  return ventana.navigator?.onLine === false;
}
