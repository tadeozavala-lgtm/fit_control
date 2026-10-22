/**
 * Negociación entre los días de fuerza y los de carrera.
 *
 * Cuando el plan de carrera necesita un día más del que hay libre, la pregunta
 * no es "¿puedo quitar un día de pesas?" sino "¿cuál cuesta menos?". La app ya
 * sabe cuántas series semanales recibe cada grupo muscular, así que puede
 * responderlo con números en vez de con una corazonada.
 *
 * El criterio no es cuántas series se pierden sino cuánto se hunde cada grupo
 * por debajo de su rango. Perder 30 series repartidas entre ocho grupos no es
 * lo mismo que perder 15 todas de espalda.
 */

import { volumenPlaneado, rangoDe, estado, GRUPOS } from "./volumen.js";

// rutina.json escribe los días de dos formas: completos en los días de fuerza
// ("Lunes") y abreviados en los de cardio ("Lun · Mié · Jue").
const DIA_RUTINA = {
  lunes: "lun", lun: "lun",
  martes: "mar", mar: "mar",
  miercoles: "mie", mie: "mie",
  jueves: "jue", jue: "jue",
  viernes: "vie", vie: "vie",
  sabado: "sab", sab: "sab",
  domingo: "dom", dom: "dom"
};

function normalizar(texto) {
  return String(texto)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Los días de la semana que ocupa cada día de fuerza de la rutina. */
export function diaDeRutina(dia) {
  return String(dia.dia || "")
    .split(/[·,]/)
    .map((x) => DIA_RUTINA[normalizar(x)])
    .filter(Boolean);
}

/**
 * Días ocupados por la fuerza, descontando los que se hayan liberado.
 * @param {string[]} liberados ids de días de rutina soltados (p.ej. ["full"])
 */
export function diasOcupados(rutina, liberados = []) {
  const dias = new Set();
  rutina.dias
    .filter((d) => d.ejercicios && !liberados.includes(d.id))
    .forEach((d) => diaDeRutina(d).forEach((x) => dias.add(x)));
  return [...dias];
}

/** La rutina sin los días liberados, para calcular volumen real. */
export function rutinaSin(rutina, liberados = []) {
  return { ...rutina, dias: rutina.dias.filter((d) => !liberados.includes(d.id)) };
}

/**
 * Qué cuesta soltar un día de fuerza.
 *
 * @returns {{
 *   id, nombre, dia, diasSemana,
 *   seriesPerdidas: number,
 *   porGrupo: Array<{grupo, nombre, antes, despues, rango, estado}>,
 *   caenBajo: string[],
 *   deficit: number
 * }}
 */
export function costoDeLiberar(rutina, diaId, yaLiberados = []) {
  const dia = rutina.dias.find((d) => d.id === diaId);
  if (!dia || !dia.ejercicios) return null;

  const antes = volumenPlaneado(rutinaSin(rutina, yaLiberados));
  const despues = volumenPlaneado(rutinaSin(rutina, [...yaLiberados, diaId]));

  const porGrupo = [];
  const caenBajo = [];
  let deficit = 0;
  let seriesPerdidas = 0;

  Object.keys(GRUPOS).forEach((g) => {
    const a = Math.round((antes[g] || 0) * 10) / 10;
    const d = Math.round((despues[g] || 0) * 10) / 10;
    if (a === d) return;

    seriesPerdidas += a - d;
    const rango = rangoDe(g);
    const est = estado(g, d);
    porGrupo.push({ grupo: g, nombre: GRUPOS[g], antes: a, despues: d, rango, estado: est });

    // Solo cuenta el hundimiento nuevo: un grupo que ya estaba bajo no se
    // apunta dos veces, pero sí suma lo que empeora.
    const faltaAntes = Math.max(0, rango.min - a);
    const faltaDespues = Math.max(0, rango.min - d);
    deficit += faltaDespues - faltaAntes;
    if (est === "bajo" && estado(g, a) !== "bajo") caenBajo.push(GRUPOS[g]);
  });

  porGrupo.sort((x, y) => y.antes - y.despues - (x.antes - x.despues));

  return {
    id: dia.id,
    nombre: dia.nombre,
    dia: dia.dia,
    diasSemana: diaDeRutina(dia),
    seriesPerdidas: Math.round(seriesPerdidas * 10) / 10,
    porGrupo,
    caenBajo,
    deficit: Math.round(deficit * 10) / 10
  };
}

/**
 * Los días de fuerza ordenados de menos a más costoso de soltar.
 *
 * Ordena por déficit (cuánto se hunden los grupos bajo su mínimo) y desempata
 * por series perdidas. Un día que reparte su trabajo entre muchos grupos
 * siempre sale mejor parado que uno que concentra todo en dos.
 */
export function candidatosALiberar(rutina, yaLiberados = []) {
  return rutina.dias
    .filter((d) => d.ejercicios && !yaLiberados.includes(d.id))
    .map((d) => costoDeLiberar(rutina, d.id, yaLiberados))
    .filter(Boolean)
    .sort((a, b) => a.deficit - b.deficit || a.seriesPerdidas - b.seriesPerdidas);
}

/** El día que menos cuesta soltar, o null si solo queda uno. */
export function mejorCandidato(rutina, yaLiberados = []) {
  // Se apoya en puedeLiberar() para que el piso de tres días sea uno solo y no
  // dos reglas parecidas que se contradicen.
  if (!puedeLiberar(rutina, yaLiberados)) return null;
  return candidatosALiberar(rutina, yaLiberados)[0] || null;
}

/** Días de fuerza que quedan si se liberan estos. */
export function diasRestantes(rutina, liberados = []) {
  return rutina.dias.filter((d) => d.ejercicios && !liberados.includes(d.id)).length;
}

export const MINIMO_FUERZA = 3;

/**
 * ¿Se puede soltar otro día?
 * Tres días de fuerza es el piso para mantener músculo en déficit calórico.
 */
export function puedeLiberar(rutina, liberados = []) {
  return diasRestantes(rutina, liberados) > MINIMO_FUERZA;
}

/**
 * Qué hacer con el trabajo que se pierde.
 *
 * No basta con avisar del hueco: lo útil es decir dónde recolocarlo. Se busca,
 * entre los días que siguen en pie, el que ya entrena ese grupo.
 */
export function compensaciones(rutina, diaId, yaLiberados = []) {
  const costo = costoDeLiberar(rutina, diaId, yaLiberados);
  if (!costo || !costo.caenBajo.length) return [];

  const quedan = rutina.dias.filter(
    (d) => d.ejercicios && d.id !== diaId && !yaLiberados.includes(d.id)
  );

  return costo.porGrupo
    .filter((g) => g.estado === "bajo")
    .map((g) => {
      const donde = quedan.find((d) =>
        d.ejercicios.some((e) => e.grupo === g.grupo || (e.secundarios || []).includes(g.grupo))
      );
      const falta = Math.ceil(g.rango.min - g.despues);
      return {
        grupo: g.grupo,
        nombre: g.nombre,
        faltan: falta,
        dia: donde ? donde.nombre : null,
        texto: donde
          ? `${g.nombre}: suma ${falta} ${falta === 1 ? "serie" : "series"} en ${donde.nombre}`
          : `${g.nombre}: faltan ${falta} series y ningún día restante lo entrena`
      };
    });
}
