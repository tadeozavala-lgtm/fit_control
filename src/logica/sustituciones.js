/**
 * Alternativas cuando la máquina está ocupada.
 *
 * El catálogo viene de free-exercise-db (dominio público) filtrado y traducido
 * en tiempo de build; ver scripts/importar-catalogo.js.
 *
 * La sustitución conserva la prescripción del hueco de la rutina (series, reps,
 * tempo, descanso) pero el registro se guarda bajo el id del ejercicio
 * sustituto, para que su historial no se mezcle con el del original.
 */

/** Normaliza para comparar nombres sin acentos ni mayúsculas. */
export function normalizar(texto) {
  return String(texto)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .trim();
}

/**
 * Puntúa qué tan buena es una alternativa para un ejercicio dado.
 *
 * El criterio no es "lo más parecido posible": si el banco está ocupado, otra
 * variante con banco no sirve de nada. Por eso cambiar de equipo SUMA.
 */
export function puntuar(ejercicio, candidato) {
  if (candidato.grupo !== ejercicio.grupo) return -1;

  let puntos = 0;

  // El patrón pesa más que todo lo demás: un remo y un jalón trabajan la misma
  // espalda, pero si lo que está ocupado es el banco de remo, otro movimiento
  // horizontal sustituye mejor que uno vertical.
  if (candidato.patron && ejercicio.patron) {
    puntos += candidato.patron === ejercicio.patron ? 5 : -2;
  }

  if (candidato.mecanica && ejercicio.mecanica && candidato.mecanica === ejercicio.mecanica) puntos += 3;
  if (candidato.fuerza && ejercicio.fuerza && candidato.fuerza === ejercicio.fuerza) puntos += 2;
  if (candidato.equipo !== ejercicio.equipo) puntos += 2;

  // Si el original lleva carga externa, el peso corporal es el último recurso:
  // unas lagartijas no sustituyen una banca de 60 kg.
  if (ejercicio.equipo !== "peso corporal" && candidato.equipo === "peso corporal") puntos -= 1;

  const secundarios = new Set(ejercicio.secundarios || []);
  (candidato.secundarios || []).forEach((g) => {
    if (secundarios.has(g)) puntos += 1;
  });

  return puntos;
}

/**
 * Alternativas ordenadas de mejor a peor.
 * @param {object} ejercicio  entrada de rutina.json (necesita `grupo`)
 * @param {object} catalogo   catalogo.json
 * @param {{limite?:number, equipoExcluido?:string}} opciones
 */
export function alternativas(ejercicio, catalogo, opciones = {}) {
  const { limite = 8, equipoExcluido } = opciones;
  const propio = normalizar(ejercicio.nombre);

  return (catalogo.ejercicios || [])
    .filter((c) => {
      if (normalizar(c.nombre) === propio) return false;
      if (equipoExcluido && c.equipo === equipoExcluido) return false;
      return c.grupo === ejercicio.grupo;
    })
    .map((c) => ({ ...c, puntos: puntuar(ejercicio, c) }))
    .filter((c) => c.puntos >= 0)
    .sort((a, b) => b.puntos - a.puntos || a.nombre.localeCompare(b.nombre))
    .slice(0, limite);
}

/** Busca una entrada del catálogo por id. */
export function buscar(catalogo, id) {
  return (catalogo.ejercicios || []).find((e) => e.id === id) || null;
}

/**
 * El ejercicio que toca hacer hoy en un hueco de la rutina: el original, o el
 * sustituto si hay uno registrado en la sesión.
 *
 * @returns {{ej:object, sustituido:boolean, original:object, clave:string}}
 *   `clave` es bajo qué id se guardan las series.
 */
export function resolver(ejercicio, sesion, catalogo) {
  const sustId = (sesion && sesion.sust && sesion.sust[ejercicio.id]) || null;
  const sust = sustId ? buscar(catalogo, sustId) : null;

  if (!sust) {
    return { ej: ejercicio, sustituido: false, original: ejercicio, clave: ejercicio.id };
  }

  // La prescripción es del hueco, no del sustituto: mismas series, reps, tempo
  // y descanso. Lo que cambia es el movimiento y a qué músculos cuenta.
  //
  // Todo lo que describe el MOVIMIENTO pasa a ser del sustituto, y eso incluye
  // `catalogoId`, de donde salen las fotos de la ventana de técnica: enseñar
  // las del original bajo el nombre del sustituto sería peor que no enseñar
  // ninguna. La técnica escrita se cae por lo mismo —el catálogo no la trae y
  // las indicaciones del original no aplican a otro movimiento—; `sustituyeA`
  // deja que la vista lo explique en vez de dejar huecos sin razón.
  return {
    ej: {
      ...ejercicio,
      nombre: sust.nombre,
      grupo: sust.grupo,
      secundarios: sust.secundarios,
      equipo: sust.equipo,
      mecanica: sust.mecanica,
      patron: sust.patron,
      catalogoId: sust.id,
      tecnica: null,
      sustituyeA: ejercicio.nombre,
      sugerido: "peso a criterio"
    },
    sustituido: true,
    original: ejercicio,
    sustituto: sust,
    clave: sust.id
  };
}

/** Registra una sustitución en la sesión. `sustId` null la deshace. */
export function sustituir(sesion, ejercicioId, sustId) {
  if (!sesion.sust) sesion.sust = {};
  if (sustId) sesion.sust[ejercicioId] = sustId;
  else delete sesion.sust[ejercicioId];
  return sesion;
}

/** Índice id -> {grupo, secundarios} del catálogo, para el conteo de volumen. */
export function gruposDelCatalogo(catalogo) {
  const indice = {};
  (catalogo.ejercicios || []).forEach((e) => {
    indice[e.id] = { grupo: e.grupo, secundarios: e.secundarios || [] };
  });
  return indice;
}
