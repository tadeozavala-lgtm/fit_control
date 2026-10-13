/**
 * Volumen semanal por grupo muscular.
 *
 * Es la métrica que mejor predice si se mantiene músculo en déficit: el
 * tonelaje suma kilos pero no distingue entre pecho y pierna, así que un día
 * de sentadilla puede tapar que el pecho lleva tres semanas sin estímulo.
 *
 * La unidad es la SERIE EFECTIVA, no el kilo. Una serie cuenta 1 para el grupo
 * primario del ejercicio y 0.5 para cada secundario: el press de banca estimula
 * el tríceps, pero no como lo hace una extensión directa.
 */

export const GRUPOS = {
  pecho: "Pecho",
  espalda: "Espalda",
  hombro: "Hombro",
  biceps: "Bíceps",
  triceps: "Tríceps",
  cuadriceps: "Cuádriceps",
  isquios: "Isquios",
  gluteo: "Glúteo",
  gemelo: "Gemelo",
  core: "Core"
};

/**
 * Rangos de referencia en series semanales. 10 a 20 es la horquilla que se
 * maneja habitualmente para hipertrofia; core y gemelo toleran menos volumen
 * directo porque acumulan trabajo indirecto todo el tiempo.
 *
 * Son referencias, no reglas: en déficit calórico la mitad baja del rango es
 * terreno perfectamente razonable.
 */
export const RANGO_POR_DEFECTO = { min: 10, max: 20 };
export const RANGOS = {
  core: { min: 6, max: 16 },
  gemelo: { min: 6, max: 16 },
  gluteo: { min: 8, max: 20 }
};

export function rangoDe(grupo) {
  return RANGOS[grupo] || RANGO_POR_DEFECTO;
}

/**
 * Semana ISO de una fecha "YYYY-MM-DD", como "2026-W42".
 * Lunes a domingo, que es justo como está armado el split de Tadeo.
 */
export function semanaISO(fecha) {
  const [a, m, d] = String(fecha).split("-").map(Number);
  const f = new Date(Date.UTC(a, m - 1, d));
  // ISO: el jueves de la semana decide a qué año pertenece.
  const dia = f.getUTCDay() || 7;
  f.setUTCDate(f.getUTCDate() + 4 - dia);
  const inicioAnio = new Date(Date.UTC(f.getUTCFullYear(), 0, 1));
  const n = Math.ceil(((f - inicioAnio) / 86400000 + 1) / 7);
  return `${f.getUTCFullYear()}-W${String(n).padStart(2, "0")}`;
}

/** Lunes de una semana ISO, como "YYYY-MM-DD". Útil para etiquetar. */
export function lunesDe(claveSemana) {
  const [anio, sem] = String(claveSemana).split("-W").map(Number);
  const cuatroEnero = new Date(Date.UTC(anio, 0, 4));
  const dia = cuatroEnero.getUTCDay() || 7;
  const lunesSemana1 = new Date(cuatroEnero);
  lunesSemana1.setUTCDate(cuatroEnero.getUTCDate() - dia + 1);
  const lunes = new Date(lunesSemana1);
  lunes.setUTCDate(lunesSemana1.getUTCDate() + (sem - 1) * 7);
  return lunes.toISOString().slice(0, 10);
}

/** Índice id de ejercicio -> {grupo, secundarios} a partir de rutina.json. */
export function indiceGrupos(rutina) {
  const indice = {};
  (rutina.dias || []).forEach((d) => {
    (d.ejercicios || []).forEach((e) => {
      if (e.grupo) indice[e.id] = { grupo: e.grupo, secundarios: e.secundarios || [] };
    });
  });
  return indice;
}

/**
 * Series efectivas por grupo en una semana ISO.
 * @returns {Object<string, number>} solo los grupos con volumen mayor a 0
 */
export function volumenDeSemana(datos, rutina, claveSemana) {
  const indice = indiceGrupos(rutina);
  const total = {};

  Object.values(datos.sesiones || {}).forEach((sesion) => {
    if (semanaISO(sesion.fecha) !== claveSemana) return;
    Object.entries(sesion.ej || {}).forEach(([exId, series]) => {
      const def = indice[exId];
      if (!def) return;
      const hechas = (series || []).filter((s) => s && s.ok).length;
      if (!hechas) return;
      total[def.grupo] = (total[def.grupo] || 0) + hechas;
      def.secundarios.forEach((g) => {
        total[g] = (total[g] || 0) + hechas * 0.5;
      });
    });
  });

  return total;
}

/** Semanas ISO con al menos una serie completada, de la más vieja a la más nueva. */
export function semanasConDatos(datos) {
  const set = new Set();
  Object.values(datos.sesiones || {}).forEach((s) => {
    const tiene = Object.values(s.ej || {}).some((a) => (a || []).some((x) => x && x.ok));
    if (tiene) set.add(semanaISO(s.fecha));
  });
  return [...set].sort();
}

/** @returns {"bajo"|"dentro"|"alto"} */
export function estado(grupo, series) {
  const r = rangoDe(grupo);
  if (series < r.min) return "bajo";
  if (series > r.max) return "alto";
  return "dentro";
}

/**
 * Resumen ordenado para pintar: todos los grupos de la rutina, con su volumen,
 * rango y estado. Los que van bajos salen primero porque son los accionables.
 */
export function resumen(datos, rutina, claveSemana) {
  const indice = indiceGrupos(rutina);
  const presentes = new Set();
  Object.values(indice).forEach((d) => {
    presentes.add(d.grupo);
    d.secundarios.forEach((g) => presentes.add(g));
  });

  const vol = volumenDeSemana(datos, rutina, claveSemana);
  const orden = { bajo: 0, alto: 1, dentro: 2 };

  return [...presentes]
    .map((grupo) => {
      const series = Math.round((vol[grupo] || 0) * 10) / 10;
      return { grupo, nombre: GRUPOS[grupo] || grupo, series, rango: rangoDe(grupo), estado: estado(grupo, series) };
    })
    .sort((a, b) => orden[a.estado] - orden[b.estado] || b.series - a.series);
}

/**
 * Volumen planeado si se completara la rutina entera en una semana.
 * Sirve para saber si el problema es el plan o la adherencia.
 */
export function volumenPlaneado(rutina) {
  const total = {};
  (rutina.dias || []).forEach((d) => {
    (d.ejercicios || []).forEach((e) => {
      if (!e.grupo) return;
      total[e.grupo] = (total[e.grupo] || 0) + e.series;
      (e.secundarios || []).forEach((g) => {
        total[g] = (total[g] || 0) + e.series * 0.5;
      });
    });
  });
  return total;
}
