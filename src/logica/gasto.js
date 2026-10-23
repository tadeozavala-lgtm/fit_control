/**
 * Lo que Tadeo gastó de verdad, leído de sus registros.
 *
 * Esta es la pieza que une entrenamiento y nutrición: en vez de preguntarle
 * "¿cuánto entrenas?" y multiplicar por un factor, la app ya sabe cuántas
 * series marcó y cuántos kilómetros corrió. El número sale de ahí.
 *
 * Importa que el gasto del entrenamiento se sume APARTE del factor de vida
 * diaria: un factor "muy activo" ya incluye el ejercicio, y sumar ambos cuenta
 * dos veces lo mismo. Por eso ACTIVIDAD en nutricion.js tiene factores bajos.
 */

import { gastoCarrera, gastoFuerza, gastoBase } from "./nutricion.js";
import { seriesHechas } from "./fuerza.js";
import { semanaISO } from "./volumen.js";

/** Series completadas en una sesión de fuerza. */
export function seriesDeSesion(sesion) {
  return Object.values(sesion?.ej || {}).reduce((a, arr) => a + seriesHechas(arr), 0);
}

/**
 * Gasto de entrenamiento de un día concreto.
 *
 * @returns {{fuerza:number, carrera:number, total:number, series:number, km:number}}
 */
export function gastoDelDia(datos, fecha, peso, tmbValor) {
  const sesiones = Object.values(datos.sesiones || {}).filter((s) => s.fecha === fecha);
  const series = sesiones.reduce((a, s) => a + seriesDeSesion(s), 0);
  const fuerza = gastoFuerza(series, peso);

  const carreras = (datos.carreras || []).filter((c) => c.fecha === fecha);
  const km = Math.round(carreras.reduce((a, c) => a + (Number(c.km) || 0), 0) * 100) / 100;
  const carrera = carreras.reduce(
    (a, c) => a + gastoCarrera(c.km, c.segundos, peso, tmbValor),
    0
  );

  return { fuerza, carrera, total: fuerza + carrera, series, km };
}

/**
 * Gasto medio de entrenamiento por día, sobre los últimos N días.
 *
 * Es el número que de verdad conviene usar para comer: ajustar las calorías
 * día a día según lo que se entrenó ese día produce oscilaciones de 600 kcal
 * que nadie sigue, y la grasa no se gana ni se pierde en 24 horas. El de hoy
 * se muestra aparte, como dato.
 */
export function gastoMedioDiario(datos, hoy, peso, tmbValor, dias = 14) {
  const desde = new Date(hoy + "T12:00:00Z");
  desde.setUTCDate(desde.getUTCDate() - (dias - 1));
  const limite = desde.toISOString().slice(0, 10);

  let total = 0;
  let conActividad = 0;

  for (let i = 0; i < dias; i++) {
    const d = new Date(desde);
    d.setUTCDate(desde.getUTCDate() + i);
    const fecha = d.toISOString().slice(0, 10);
    const g = gastoDelDia(datos, fecha, peso, tmbValor);
    total += g.total;
    if (g.total > 0) conActividad++;
  }

  return {
    medio: Math.round(total / dias),
    total,
    dias,
    diasConActividad: conActividad,
    desde: limite,
    hasta: hoy
  };
}

/** Gasto de entrenamiento de una semana ISO. */
export function gastoDeSemana(datos, claveSemana, peso, tmbValor) {
  const fechas = new Set();
  Object.values(datos.sesiones || {}).forEach((s) => {
    if (semanaISO(s.fecha) === claveSemana) fechas.add(s.fecha);
  });
  (datos.carreras || []).forEach((c) => {
    if (semanaISO(c.fecha) === claveSemana) fechas.add(c.fecha);
  });

  let fuerza = 0;
  let carrera = 0;
  fechas.forEach((f) => {
    const g = gastoDelDia(datos, f, peso, tmbValor);
    fuerza += g.fuerza;
    carrera += g.carrera;
  });

  return { fuerza, carrera, total: fuerza + carrera, dias: fechas.size };
}

/**
 * El gasto diario completo: vivir más entrenar.
 *
 * @returns {{base:number, entrenamiento:number, total:number, hoy:object, medio:object}}
 */
export function gastoTotalDiario(datos, hoy, peso, tmbValor, nivelActividad) {
  const base = gastoBase(tmbValor, nivelActividad);
  const medio = gastoMedioDiario(datos, hoy, peso, tmbValor);
  const delDia = gastoDelDia(datos, hoy, peso, tmbValor);

  return {
    base,
    entrenamiento: medio.medio,
    total: base + medio.medio,
    hoy: delDia,
    medio
  };
}

/** El peso más reciente registrado, o el configurado si no hay ninguno. */
export function pesoActual(datos) {
  const pesos = [...(datos.pesos || [])].sort((a, b) =>
    String(a.fecha).localeCompare(String(b.fecha))
  );
  if (pesos.length) return pesos[pesos.length - 1].kg;
  return datos.nutricion?.pesoInicial || 0;
}

/** Guarda el peso de una fecha; si ya existe uno ese día, lo reemplaza. */
export function registrarPeso(datos, fecha, kg) {
  const n = Number(kg);
  if (!(n > 0) || n > 400) return datos.pesos || [];
  const sinEseDia = (datos.pesos || []).filter((p) => p.fecha !== fecha);
  return [...sinEseDia, { fecha, kg: Math.round(n * 10) / 10 }].sort((a, b) =>
    String(a.fecha).localeCompare(String(b.fecha))
  );
}
