/**
 * Cálculos de entrenamiento. Todo recibe y devuelve kilogramos.
 * Funciones puras: no tocan el DOM ni el almacenamiento, por eso son las que
 * están cubiertas por tests.
 */

/**
 * 1RM estimado por la fórmula de Epley.
 * Ojo: pierde precisión arriba de ~12 repeticiones, por eso `confiable()`.
 */
export function e1rm(peso, reps) {
  const p = Number(peso);
  const r = Number(reps);
  if (!p || !r || p <= 0 || r <= 0) return 0;
  return p * (1 + r / 30);
}

/** La estimación de 1RM solo es útil en rangos bajos de repeticiones. */
export function confiable(reps) {
  return Number(reps) > 0 && Number(reps) <= 12;
}

/**
 * La mejor serie de una lista, medida por 1RM estimado.
 * @returns {{e1rm:number, peso:number, reps:number}|null}
 */
export function mejorSerie(series) {
  let mejor = null;
  (series || []).forEach((s) => {
    if (!s || !s.ok || !s.p || !s.r) return;
    const v = e1rm(s.p, s.r);
    if (!mejor || v > mejor.e1rm) mejor = { e1rm: v, peso: Number(s.p), reps: Number(s.r) };
  });
  return mejor;
}

/** Tonelaje (kg levantados) de una lista de series completadas. */
export function tonelaje(series) {
  return (series || []).reduce(
    (a, s) => a + (s && s.ok ? (Number(s.p) || 0) * (Number(s.r) || 0) : 0),
    0
  );
}

/** Series efectivas: las marcadas como hechas. */
export function seriesHechas(series) {
  return (series || []).filter((s) => s && s.ok).length;
}

/**
 * Qué hacer la próxima sesión con este ejercicio.
 * @param {Array} series registradas hoy
 * @param {{repMax:number, tiempo?:boolean}} ejercicio
 * @returns {{accion:"subir"|"bajar"|"mantener", texto:string}}
 */
export function sugerencia(series, ejercicio, unidad = "kg") {
  const hechas = (series || []).filter((s) => s && s.ok && s.r);
  if (!hechas.length) return { accion: "mantener", texto: "" };

  const completas = hechas.length === (series || []).length;
  const todasAlTope = hechas.every((s) => Number(s.r) >= ejercicio.repMax);

  if (completas && todasAlTope) {
    const texto = ejercicio.tiempo
      ? "Súbele 10 s la próxima"
      : unidad === "lb"
        ? "Súbele 5 lb la próxima"
        : "Súbele 2.5 kg la próxima";
    return { accion: "subir", texto };
  }

  // Quedarse muy corto del rango dos veces seguidas significa que el peso es excesivo.
  if (hechas.some((s) => Number(s.r) < ejercicio.repMax * 0.7)) {
    return { accion: "bajar", texto: "Baja el peso y cuida el tempo" };
  }

  return { accion: "mantener", texto: "" };
}

/**
 * Semana de descarga: cada 4ª semana se baja la intensidad para poder seguir
 * progresando. Devuelve el multiplicador de carga a aplicar.
 */
export function factorSemana(semana, cadaCuantas = 4) {
  return Number(semana) > 0 && Number(semana) % cadaCuantas === 0 ? 0.9 : 1;
}

export function esDescarga(semana, cadaCuantas = 4) {
  return factorSemana(semana, cadaCuantas) < 1;
}

/**
 * Récord previo de un ejercicio, excluyendo una fecha (normalmente hoy).
 * @param {Array} sesiones ordenadas o no
 */
export function recordPrevio(sesiones, ejercicioId, fechaExcluida) {
  let mejor = 0;
  (sesiones || []).forEach((s) => {
    if (s.fecha === fechaExcluida) return;
    const m = mejorSerie(s.ej && s.ej[ejercicioId]);
    if (m && m.e1rm > mejor) mejor = m.e1rm;
  });
  return mejor;
}

/** ¿Esta serie supera el récord previo? Margen para evitar falsos positivos por redondeo. */
export function esRecord(serie, recordPrevio) {
  if (!serie || !serie.p || !serie.r || recordPrevio <= 0) return false;
  return e1rm(serie.p, serie.r) > recordPrevio * 1.001;
}
