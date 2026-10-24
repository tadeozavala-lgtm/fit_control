/**
 * Generador de rutinas de musculación a partir de un cuestionario.
 *
 * Cuatro decisiones que explican el archivo:
 *
 * 1. El tiempo por sesión es una RESTRICCIÓN DURA, no una sugerencia. Una
 *    rutina de 70 minutos para alguien que tiene 45 no se cumple: se abandona a
 *    media sesión y lo que se corta siempre es el final, que es donde está el
 *    trabajo accesorio. Por eso el generador recorta él mismo, empezando por lo
 *    que menos cuesta perder.
 *
 * 2. Los compuestos van primero y nunca se recortan. Son los que mueven el
 *    volumen de verdad; las elevaciones laterales son lo primero que sobra.
 *
 * 3. Los ids de ejercicio se reciclan. Si la rutina nueva incluye un press de
 *    banca que ya existía, conserva su id para que no se pierdan los récords ni
 *    el historial. Esto no es un detalle: regenerar la rutina no puede costar
 *    meses de registro.
 *
 * 4. El generador NO toca los días de cardio. Zona 2 y HIIT se manejan aparte,
 *    y el plan de carrera ya se encarga de ellos.
 */

import { GRUPOS, rangoDe } from "./volumen.js";
import { normalizar } from "./sustituciones.js";

/* ---------- el cuestionario ---------- */

export const OBJETIVOS_RUTINA = {
  fuerza: {
    nombre: "Fuerza",
    descripcion: "Cargas altas, pocas repeticiones, descansos largos",
    reps: [4, 6],
    rir: 2,
    tempo: "3-1-1-0",
    descanso: 180,
    seriesCompuesto: 4,
    seriesAislamiento: 3,
    factorVolumen: 0.85
  },
  hipertrofia: {
    nombre: "Hipertrofia",
    descripcion: "El rango clásico para ganar tamaño",
    reps: [8, 12],
    rir: 2,
    tempo: "3-1-1-0",
    descanso: 90,
    seriesCompuesto: 4,
    seriesAislamiento: 3,
    factorVolumen: 1
  },
  recomposicion: {
    nombre: "Recomposición",
    descripcion: "Mantener músculo mientras bajas grasa",
    reps: [8, 12],
    rir: 2,
    tempo: "3-1-1-0",
    descanso: 75,
    seriesCompuesto: 4,
    seriesAislamiento: 3,
    factorVolumen: 0.95
  },
  resistencia: {
    nombre: "Resistencia",
    descripcion: "Repeticiones altas y descansos cortos",
    reps: [15, 20],
    rir: 1,
    tempo: "2-0-1-0",
    descanso: 45,
    seriesCompuesto: 3,
    seriesAislamiento: 3,
    factorVolumen: 1.1
  }
};

export const EQUIPOS = {
  completo: {
    nombre: "Gimnasio completo",
    permite: ["barra", "mancuerna", "polea", "máquina", "peso corporal", "kettlebell", "barra Z"]
  },
  pesoLibre: {
    nombre: "Barra y mancuernas",
    permite: ["barra", "mancuerna", "peso corporal", "barra Z"]
  },
  mancuernas: {
    nombre: "Mancuernas y kettlebell",
    permite: ["mancuerna", "kettlebell", "peso corporal"]
  },
  corporal: {
    nombre: "Peso corporal",
    permite: ["peso corporal"]
  }
};

export const EXPERIENCIA = {
  principiante: { nombre: "Menos de 1 año", factorVolumen: 0.8, maxEjercicios: 5 },
  intermedio: { nombre: "1 a 3 años", factorVolumen: 1, maxEjercicios: 7 },
  avanzado: { nombre: "Más de 3 años", factorVolumen: 1.15, maxEjercicios: 8 }
};

export const MINUTOS_MINIMOS = 25;
export const MINUTOS_CALENTAMIENTO = 8;

/* ---------- splits ---------- */

/**
 * El esqueleto de cada día: qué grupos entrena y en qué orden.
 *
 * El orden importa dentro del día: lo que va primero recibe el músculo
 * descansado, así que los grupos grandes abren y los chicos cierran.
 */
export const SPLITS = {
  2: {
    nombre: "Full body ×2",
    dias: [
      { id: "fbA", nombre: "Full Body A", grupos: ["cuadriceps", "pecho", "espalda", "hombro", "core"] },
      { id: "fbB", nombre: "Full Body B", grupos: ["isquios", "espalda", "pecho", "biceps", "triceps"] }
    ]
  },
  3: {
    nombre: "Push / Pull / Legs",
    dias: [
      { id: "push", nombre: "Push", grupos: ["pecho", "hombro", "triceps"] },
      { id: "pull", nombre: "Pull", grupos: ["espalda", "biceps"] },
      { id: "legs", nombre: "Legs", grupos: ["cuadriceps", "isquios", "gluteo", "gemelo", "core"] }
    ]
  },
  4: {
    nombre: "Torso / Pierna ×2",
    dias: [
      { id: "torsoA", nombre: "Torso A", grupos: ["pecho", "espalda", "hombro", "triceps"] },
      { id: "piernaA", nombre: "Pierna A", grupos: ["cuadriceps", "isquios", "gemelo", "core"] },
      { id: "torsoB", nombre: "Torso B", grupos: ["espalda", "pecho", "hombro", "biceps"] },
      { id: "piernaB", nombre: "Pierna B", grupos: ["isquios", "cuadriceps", "gluteo", "core"] }
    ]
  },
  5: {
    nombre: "Push / Pull / Legs + Torso / Pierna",
    dias: [
      { id: "push", nombre: "Push", grupos: ["pecho", "hombro", "triceps"] },
      { id: "pull", nombre: "Pull", grupos: ["espalda", "biceps"] },
      { id: "legs", nombre: "Legs", grupos: ["cuadriceps", "isquios", "gluteo", "gemelo"] },
      { id: "torso", nombre: "Torso", grupos: ["pecho", "espalda", "hombro"] },
      { id: "pierna", nombre: "Pierna", grupos: ["isquios", "cuadriceps", "core"] }
    ]
  },
  6: {
    nombre: "Push / Pull / Legs ×2",
    dias: [
      { id: "pushA", nombre: "Push A", grupos: ["pecho", "hombro", "triceps"] },
      { id: "pullA", nombre: "Pull A", grupos: ["espalda", "biceps"] },
      { id: "legsA", nombre: "Legs A", grupos: ["cuadriceps", "isquios", "gemelo"] },
      { id: "pushB", nombre: "Push B", grupos: ["hombro", "pecho", "triceps"] },
      { id: "pullB", nombre: "Pull B", grupos: ["espalda", "biceps", "core"] },
      { id: "legsB", nombre: "Legs B", grupos: ["isquios", "cuadriceps", "gluteo", "core"] }
    ]
  }
};

export const DIAS_MIN = 2;
export const DIAS_MAX = 6;

/* ---------- presupuesto de tiempo ---------- */

/** Segundos de tensión por repetición, leídos del tempo. */
export function segundosPorRep(tempo) {
  const m = String(tempo).match(/^(\d)-(\d)-(\d)-(\d)$/);
  if (!m) return 4;
  return Number(m[1]) + Number(m[2]) + Number(m[3]) + Number(m[4]);
}

export const SEGUNDOS_MONTAJE = 45;

/**
 * Minutos que cuesta un ejercicio.
 *
 * Incluye el montaje (buscar el peso, ajustar la máquina) y los descansos
 * entre series, pero NO el descanso de la última: ahí ya se pasa al siguiente.
 */
export function minutosEjercicio(ejercicio) {
  const reps = Number(String(ejercicio.reps).match(/\d+/)?.[0] || 10);
  const porRep = segundosPorRep(ejercicio.tempo);
  const trabajo = ejercicio.series * reps * porRep;
  const descansos = Math.max(0, ejercicio.series - 1) * ejercicio.descanso;
  return (trabajo + descansos + SEGUNDOS_MONTAJE) / 60;
}

/** Minutos de una sesión completa, con calentamiento. */
export function minutosSesion(ejercicios) {
  const trabajo = (ejercicios || []).reduce((a, e) => a + minutosEjercicio(e), 0);
  return Math.round(MINUTOS_CALENTAMIENTO + trabajo);
}

/* ---------- selección de ejercicios ---------- */

/**
 * Veces por semana que se puede repetir un patrón muy fatigante.
 *
 * La bisagra de cadera (peso muerto, buenos días) es la que más sistema
 * nervioso cuesta y la que más tarda en recuperarse. Sin este tope, el
 * generador la metía cuatro veces por semana porque puntúa altísimo: es
 * compuesta y arrastra media espalda y toda la cadena posterior.
 */
export const TOPE_SEMANAL = { bisagra: 2 };

/**
 * Puntúa un ejercicio del catálogo para un grupo dado.
 *
 * Premia los compuestos y los que arrastran músculos secundarios: en una sesión
 * con el tiempo contado, un ejercicio que entrena tres grupos vale más que uno
 * que entrena uno. Penaliza repetir el mismo movimiento en la semana, porque
 * tres variantes de press de banca no son variedad, son el mismo estímulo.
 *
 * @param {Set} yaUsados       ids usados en ESTA sesión
 * @param {Map} usosSemanales  id -> veces que ya aparece en la semana
 * @param {Map} patronesSemana patrón -> veces en la semana
 * @param {Map} patronesSesion patrón -> veces en ESTA sesión
 */
export function puntuarEjercicio(
  ejercicio, grupo, yaUsados, equipo, usosSemanales, patronesSemana, patronesSesion
) {
  if (ejercicio.grupo !== grupo) return -1;
  if (!EQUIPOS[equipo].permite.includes(ejercicio.equipo)) return -1;
  if (yaUsados.has(ejercicio.id)) return -1;

  const tope = TOPE_SEMANAL[ejercicio.patron];
  if (tope && (patronesSemana?.get(ejercicio.patron) || 0) >= tope) return -1;

  let puntos = 0;
  if (ejercicio.mecanica === "compound") puntos += 5;
  puntos += (ejercicio.secundarios || []).length;
  // Variar el equipo reparte el estrés articular y evita esperar dos veces a
  // que se libere la misma máquina.
  if (ejercicio.equipo === "barra" || ejercicio.equipo === "mancuerna") puntos += 1;
  // Repetirlo en la semana resta: la segunda vez aporta menos que un
  // movimiento distinto para el mismo músculo.
  puntos -= 3 * (usosSemanales?.get(ejercicio.id) || 0);
  // Cuatro empujes horizontales seguidos no son variedad, son el mismo
  // estímulo cuatro veces. Repetir patrón dentro de la sesión resta.
  puntos -= 2 * (patronesSesion?.get(ejercicio.patron) || 0);
  return puntos;
}

/** El mejor ejercicio disponible para un grupo. */
export function elegirEjercicio(
  catalogo, grupo, yaUsados, equipo, usosSemanales, patronesSemana, patronesSesion
) {
  const candidatos = (catalogo.ejercicios || [])
    .map((e) => ({
      e,
      p: puntuarEjercicio(e, grupo, yaUsados, equipo, usosSemanales, patronesSemana, patronesSesion)
    }))
    .filter((x) => x.p >= 0)
    .sort((a, b) => b.p - a.p || a.e.nombre.localeCompare(b.e.nombre));
  return candidatos.length ? candidatos[0].e : null;
}

/* ---------- reciclado de ids ---------- */

/**
 * Índice para reutilizar los ids de la rutina anterior.
 *
 * Sin esto, regenerar la rutina orfana todo el historial: los récords, las
 * curvas de progreso y el volumen semanal están indexados por id de ejercicio.
 * Un press de banca que sigue siendo el mismo press de banca debe conservar su
 * id aunque la rutina se haya rearmado entera.
 */
export function indiceIdsPrevios(rutinaPrevia) {
  const porCatalogo = new Map();
  const porNombre = new Map();
  const sugeridos = new Map();
  (rutinaPrevia?.dias || [])
    .filter((d) => d.ejercicios)
    .forEach((d) => {
      d.ejercicios.forEach((e) => {
        if (e.catalogoId) porCatalogo.set(e.catalogoId, e.id);
        porNombre.set(normalizar(e.nombre), e.id);
        if (e.sugerido && /kg/i.test(e.sugerido)) sugeridos.set(e.id, e.sugerido);
      });
    });
  return { porCatalogo, porNombre, sugeridos };
}

/** El id que debe llevar un ejercicio del catálogo: el viejo si existía. */
export function idPara(ejercicioCatalogo, indice) {
  return (
    indice.porCatalogo.get(ejercicioCatalogo.id) ||
    indice.porNombre.get(normalizar(ejercicioCatalogo.nombre)) ||
    ejercicioCatalogo.id
  );
}

/* ---------- generación ---------- */

function prescribir(ejercicioCatalogo, objetivo, indice) {
  const o = OBJETIVOS_RUTINA[objetivo];
  const esCompuesto = ejercicioCatalogo.mecanica === "compound";
  const series = esCompuesto ? o.seriesCompuesto : o.seriesAislamiento;
  const [repMin, repMax] = o.reps;
  const id = idPara(ejercicioCatalogo, indice);

  return {
    id,
    nombre: ejercicioCatalogo.nombre,
    series,
    reps: `${repMin}-${repMax}`,
    repMax,
    tempo: o.tempo,
    rir: o.rir,
    // Si este ejercicio ya estaba en la rutina anterior, hereda su peso: es
    // información real que Tadeo ya conoce y que no hay por qué perder.
    sugerido: indice.sugeridos.get(id) || "ajusta en la primera serie",
    grupo: ejercicioCatalogo.grupo,
    ...(ejercicioCatalogo.secundarios?.length ? { secundarios: ejercicioCatalogo.secundarios } : {}),
    equipo: ejercicioCatalogo.equipo,
    mecanica: ejercicioCatalogo.mecanica,
    fuerza: ejercicioCatalogo.fuerza,
    ...(ejercicioCatalogo.patron ? { patron: ejercicioCatalogo.patron } : {}),
    catalogoId: ejercicioCatalogo.id,
    descanso: o.descanso,
    tecnica: null
  };
}

/**
 * Recorta una sesión hasta que entra en el tiempo disponible.
 *
 * El orden del recorte no es casual: primero se baja una serie a los
 * aislamientos, luego se quitan aislamientos enteros empezando por el último, y
 * solo si aún no entra se toca un compuesto. Los compuestos son los que
 * justifican la sesión.
 */
export function recortarATiempo(ejercicios, minutosDisponibles) {
  let lista = ejercicios.map((e) => ({ ...e }));
  const cabe = () => minutosSesion(lista) <= minutosDisponibles;
  const recortes = [];

  if (cabe()) return { ejercicios: lista, recortes };

  // 1. Una serie menos en los aislamientos.
  lista.forEach((e) => {
    if (e.mecanica !== "compound" && e.series > 2 && !cabe()) {
      e.series -= 1;
      recortes.push(`${e.nombre}: una serie menos`);
    }
  });

  // 2. Quitar aislamientos desde el final.
  for (let i = lista.length - 1; i >= 0 && !cabe(); i--) {
    if (lista[i].mecanica !== "compound") {
      recortes.push(`Fuera ${lista[i].nombre}`);
      lista.splice(i, 1);
    }
  }

  // 3. Última opción: bajar series a los compuestos, nunca por debajo de 3.
  lista.forEach((e) => {
    while (!cabe() && e.series > 3) {
      e.series -= 1;
      recortes.push(`${e.nombre}: una serie menos`);
    }
  });

  // 4. Si sigue sin entrar, quitar el último compuesto. Mejor una sesión corta
  //    completa que una larga que se abandona a la mitad.
  while (!cabe() && lista.length > 2) {
    recortes.push(`Fuera ${lista[lista.length - 1].nombre}`);
    lista.pop();
  }

  return { ejercicios: lista, recortes };
}

/**
 * Genera la rutina de fuerza.
 *
 * @param {object} cfg
 * @param {number} cfg.dias        días de fuerza por semana (2 a 6)
 * @param {number} cfg.minutos     minutos por sesión
 * @param {string} cfg.objetivo    clave de OBJETIVOS_RUTINA
 * @param {string} cfg.equipo      clave de EQUIPOS
 * @param {string} cfg.experiencia clave de EXPERIENCIA
 * @param {object} cfg.catalogo    catalogo.json
 * @param {object} [cfg.rutinaPrevia] para reciclar ids y conservar historial
 * @returns {{ok:boolean, error?:string, rutina?:object, avisos?:string[]}}
 */
export function generarRutina(cfg) {
  const { dias, minutos, objetivo, equipo, experiencia, catalogo, rutinaPrevia } = cfg;

  if (!SPLITS[dias]) {
    return { ok: false, error: `Elige entre ${DIAS_MIN} y ${DIAS_MAX} días de fuerza por semana.` };
  }
  if (!OBJETIVOS_RUTINA[objetivo]) return { ok: false, error: "Objetivo desconocido" };
  if (!EQUIPOS[equipo]) return { ok: false, error: "Equipo desconocido" };
  if (!(minutos >= MINUTOS_MINIMOS)) {
    return {
      ok: false,
      error: `Con menos de ${MINUTOS_MINIMOS} minutos no da tiempo ni a calentar y hacer dos ejercicios. Mejor entrena un día menos pero completo.`
    };
  }

  const exp = EXPERIENCIA[experiencia] || EXPERIENCIA.intermedio;
  const split = SPLITS[dias];
  const indice = indiceIdsPrevios(rutinaPrevia);
  const minutosUtiles = minutos - MINUTOS_CALENTAMIENTO;

  if (minutosUtiles <= 0) {
    return { ok: false, error: "El calentamiento ya se come toda la sesión." };
  }

  const avisos = [];
  // Se llevan a lo largo de toda la semana, no por sesión: son los que evitan
  // cuatro peso muerto y tres press de banca repartidos entre los días.
  const usosSemanales = new Map();
  const patronesSemana = new Map();

  const apuntar = (e) => {
    usosSemanales.set(e.id, (usosSemanales.get(e.id) || 0) + 1);
    if (e.patron) patronesSemana.set(e.patron, (patronesSemana.get(e.patron) || 0) + 1);
  };

  const diasGenerados = split.dias.map((plantilla, idx) => {
    const usados = new Set();
    const candidatos = [];
    const patronesSesion = new Map();
    const seriesPorGrupo = {};
    plantilla.grupos.forEach((g) => {
      seriesPorGrupo[g] = 0;
    });

    const anadir = (e) => {
      usados.add(e.id);
      apuntar(e);
      if (e.patron) patronesSesion.set(e.patron, (patronesSesion.get(e.patron) || 0) + 1);
      const pres = prescribir(e, objetivo, indice);
      candidatos.push(pres);
      seriesPorGrupo[e.grupo] = (seriesPorGrupo[e.grupo] || 0) + pres.series;
      (e.secundarios || []).forEach((g) => {
        if (g in seriesPorGrupo) seriesPorGrupo[g] += pres.series * 0.5;
      });
    };

    // Primera pasada: un ejercicio por grupo, en el orden del split.
    plantilla.grupos.forEach((g) => {
      const e = elegirEjercicio(
        catalogo, g, usados, equipo, usosSemanales, patronesSemana, patronesSesion
      );
      if (e) anadir(e);
    });

    // Segunda pasada: rellenar atendiendo al grupo MÁS NECESITADO, no al que
    // vaya primero en la lista. Con el orden de la plantilla, bíceps y core
    // quedaban siempre fuera por ir al final.
    while (candidatos.length < exp.maxEjercicios) {
      const pendientes = [...plantilla.grupos].sort(
        (a, b) => (seriesPorGrupo[a] || 0) - (seriesPorGrupo[b] || 0)
      );
      let anadido = false;
      for (const g of pendientes) {
        const e = elegirEjercicio(
          catalogo, g, usados, equipo, usosSemanales, patronesSemana, patronesSesion
        );
        if (e) {
          anadir(e);
          anadido = true;
          break;
        }
      }
      if (!anadido) break;
    }

    // Los compuestos abren la sesión: el músculo fresco va donde más rinde.
    candidatos.sort((a, b) => {
      if (a.mecanica === b.mecanica) return 0;
      return a.mecanica === "compound" ? -1 : 1;
    });

    const { ejercicios, recortes } = recortarATiempo(
      candidatos.slice(0, exp.maxEjercicios),
      minutosUtiles + MINUTOS_CALENTAMIENTO
    );

    if (recortes.length) {
      avisos.push(`${plantilla.nombre}: ${recortes.length} ajuste(s) para entrar en ${minutos} min`);
    }

    return {
      id: plantilla.id,
      nombre: plantilla.nombre,
      dia: DIAS_SUGERIDOS[dias][idx],
      sub: plantilla.grupos.map((g) => GRUPOS[g]).join(" · "),
      ejercicios,
      minutosEstimados: minutosSesion(ejercicios)
    };
  });

  // Un día es válido si tiene al menos dos ejercicios Y entrena su grupo
  // principal. Sin la segunda condición, con solo peso corporal salía un día
  // "Legs" compuesto de dos ejercicios de core: pasa el conteo y no es un día
  // de pierna.
  const invalidos = diasGenerados.filter((d, i) => {
    const principal = split.dias[i].grupos[0];
    const entrenaPrincipal = d.ejercicios.some(
      (e) => e.grupo === principal || (e.secundarios || []).includes(principal)
    );
    return d.ejercicios.length < 2 || !entrenaPrincipal;
  });
  if (invalidos.length) {
    return {
      ok: false,
      error: `Con "${EQUIPOS[equipo].nombre}" no hay ejercicios suficientes para armar ${invalidos
        .map((d) => d.nombre)
        .join(", ")}. Prueba con más equipo o con menos días.`
    };
  }

  return {
    ok: true,
    avisos,
    rutina: {
      generada: true,
      split: split.nombre,
      objetivo,
      equipo,
      experiencia,
      minutos,
      creada: cfg.hoy || new Date().toISOString().slice(0, 10),
      dias: diasGenerados
    }
  };
}

/** Días de la semana sugeridos para cada número de sesiones. */
export const DIAS_SUGERIDOS = {
  2: ["Lunes", "Jueves"],
  3: ["Lunes", "Miércoles", "Viernes"],
  4: ["Lunes", "Martes", "Jueves", "Viernes"],
  5: ["Lunes", "Martes", "Miércoles", "Viernes", "Sábado"],
  6: ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]
};

/* ---------- comprobación del resultado ---------- */

/**
 * Volumen semanal que produce la rutina generada, por grupo.
 * Mismas reglas que volumen.js: 1 para el primario, 0.5 para cada secundario.
 */
export function volumenDeRutina(rutina) {
  const total = {};
  (rutina?.dias || []).forEach((d) => {
    (d.ejercicios || []).forEach((e) => {
      total[e.grupo] = (total[e.grupo] || 0) + e.series;
      (e.secundarios || []).forEach((g) => {
        total[g] = (total[g] || 0) + e.series * 0.5;
      });
    });
  });
  Object.keys(total).forEach((g) => {
    total[g] = Math.round(total[g] * 10) / 10;
  });
  return total;
}

/**
 * Grupos que quedan por debajo de su rango con la rutina generada.
 *
 * Es información, no un error: con 2 o 3 días a la semana es imposible cubrir
 * los diez grupos en rango, y conviene decirlo en vez de fingir que sí.
 */
export function gruposCortos(rutina) {
  const vol = volumenDeRutina(rutina);
  return Object.keys(GRUPOS)
    .map((g) => ({ grupo: g, nombre: GRUPOS[g], series: vol[g] || 0, rango: rangoDe(g) }))
    .filter((x) => x.series < x.rango.min)
    .sort((a, b) => a.series - b.series);
}
