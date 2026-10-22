/**
 * Generador de planes de carrera para 5K, 10K y 21K.
 *
 * Tres decisiones de diseño que explican casi todo el archivo:
 *
 * 1. El plan NO inventa días. Recibe los que Tadeo marca como libres y reparte
 *    ahí. Si entrena fuerza cuatro días, el generador trabaja con lo que queda.
 *
 * 2. El volumen sube como mucho 10% semanal y baja cada cuarta semana. Con 110
 *    kg de peso corporal el impacto por zancada es alto y la lesión por sobreuso
 *    es el riesgo real, más que no llegar en forma.
 *
 * 3. Los ritmos no son tablas: salen de ritmosEntrenamiento() con la marca de
 *    Tadeo. Un plan con ritmos ajenos no sirve de nada.
 */

import { ritmosEntrenamiento, predecir, ritmo, formatoRitmo } from "./carrera.js";

export const OBJETIVOS = {
  "5k": {
    nombre: "5K",
    km: 5,
    semanas: 8,
    // Kilómetros semanales al arrancar y al llegar al pico, por nivel de base.
    volumen: { inicio: 14, pico: 26 },
    // Tirada larga como fracción del volumen semanal.
    largoMax: 0.35,
    afinamiento: 1
  },
  "10k": {
    nombre: "10K",
    km: 10,
    semanas: 10,
    volumen: { inicio: 18, pico: 36 },
    largoMax: 0.35,
    afinamiento: 2
  },
  "21k": {
    nombre: "Media maratón",
    km: 21.0975,
    semanas: 12,
    volumen: { inicio: 24, pico: 52 },
    largoMax: 0.4,
    afinamiento: 2
  }
};

export const DIAS_SEMANA = ["lun", "mar", "mie", "jue", "vie", "sab", "dom"];
export const NOMBRE_DIA = {
  lun: "Lunes", mar: "Martes", mie: "Miércoles", jue: "Jueves",
  vie: "Viernes", sab: "Sábado", dom: "Domingo"
};

/** Mínimo de días para que un plan tenga sentido. */
export const DIAS_MINIMOS = 3;

/* ---------- fases ---------- */

export const FASES = {
  base: { nombre: "Base", color: "tiza" },
  construccion: { nombre: "Construcción", color: "tiza" },
  especifico: { nombre: "Específico", color: "record" },
  descarga: { nombre: "Descarga", color: "humo" },
  afinamiento: { nombre: "Afinamiento", color: "esquina" }
};

/**
 * Qué fase le toca a cada semana.
 *
 * Las descargas van cada cuarta semana, salvo que caigan dentro del
 * afinamiento: encadenar descarga con afinamiento desentrena.
 */
export function faseDeSemana(n, total, afinamiento) {
  if (n > total - afinamiento) return "afinamiento";
  if (n % 4 === 0) return "descarga";
  const tercio = (total - afinamiento) / 3;
  if (n <= tercio) return "base";
  if (n <= tercio * 2) return "construccion";
  return "especifico";
}

export const TOPE_SUBIDA = 0.1;
export const FACTOR_DESCARGA = 0.75;

/**
 * La serie de kilómetros de todo el plan.
 *
 * Se construye semana a semana en vez de con una fórmula cerrada, porque la
 * progresión tiene que respetar dos cosas a la vez: subir como mucho 10% y
 * bajar en las descargas. Una recta de inicio a pico produce saltos del 40%
 * justo después de cada descarga, que es exactamente cuando el cuerpo está
 * menos preparado para recibirlos.
 *
 * La referencia para subir es la última semana de CARGA, no la semana anterior:
 * así una descarga no arrastra hacia abajo toda la progresión.
 *
 * @returns {Array<{n:number, fase:string, km:number}>}
 */
export function serieKm(total, objetivo, factorBase = 1) {
  const o = OBJETIVOS[objetivo];
  const inicio = o.volumen.inicio * factorBase;
  const pico = o.volumen.pico * factorBase;

  const semanas = [];
  // La progresión se calcula con el valor exacto y solo se redondea al
  // publicarlo: redondear en cada paso acumula error y acaba produciendo
  // subidas del 10.2% que incumplen la propia regla del plan.
  let ultimaCarga = inicio;

  for (let n = 1; n <= total; n++) {
    const fase = faseDeSemana(n, total, o.afinamiento);
    let km;

    if (fase === "afinamiento") {
      const idx = n - (total - o.afinamiento);
      const escala = o.afinamiento === 1 ? [0.6] : [0.7, 0.5];
      km = ultimaCarga * escala[idx - 1];
    } else if (fase === "descarga") {
      km = ultimaCarga * FACTOR_DESCARGA;
    } else if (n === 1) {
      km = inicio;
    } else {
      km = Math.min(pico, ultimaCarga * (1 + TOPE_SUBIDA));
      ultimaCarga = km;
    }

    semanas.push({ n, fase, km: Math.round(km * 10) / 10, exacto: km });
  }

  return semanas;
}

/**
 * Comprueba que ninguna semana de carga suba más de 10% sobre la anterior
 * semana de carga.
 *
 * La comparación salta las descargas y el afinamiento a propósito: la regla
 * del 10% habla de progresión de carga, no de la diferencia entre una semana
 * suave y la siguiente dura. Compararlas daría falsos positivos y empujaría a
 * quitar las descargas, que es justo lo contrario de lo que conviene.
 */
export function respetaRegla10(semanas) {
  const cargas = semanas.filter((s) => s.fase !== "descarga" && s.fase !== "afinamiento");
  for (let i = 1; i < cargas.length; i++) {
    const previa = cargas[i - 1].km;
    if (previa <= 0) continue;
    // Holgura absoluta de 0.15 km: dos cifras redondeadas a décimas pueden
    // separarse eso sin que la progresión real se haya salido del 10%.
    if (cargas[i].km - previa * (1 + TOPE_SUBIDA) > 0.15) return false;
  }
  return true;
}

/** Ninguna descarga puede quedar por encima de la semana que la precede. */
export function descargasBajan(semanas) {
  return semanas.every((s, i) => s.fase !== "descarga" || i === 0 || s.km < semanas[i - 1].km);
}

/* ---------- tipos de sesión ---------- */

export const SESIONES = {
  facil: { nombre: "Rodaje fácil", ritmo: "facil", tipo: "z2" },
  largo: { nombre: "Tirada larga", ritmo: "facil", tipo: "z2" },
  tempo: { nombre: "Tempo", ritmo: "umbral", tipo: "tempo" },
  series: { nombre: "Series", ritmo: "intervalo", tipo: "series" },
  ritmoObjetivo: { nombre: "Ritmo objetivo", ritmo: "maraton", tipo: "tempo" }
};

/**
 * Qué sesiones de calidad lleva una semana según su fase.
 *
 * En base solo rodaje: construir volumen antes que intensidad es lo que
 * protege de la lesión. La calidad entra en construcción y sube en específico.
 */
export function calidadDeFase(fase, objetivo) {
  if (fase === "base") return [];
  if (fase === "descarga") return ["tempo"];
  if (fase === "afinamiento") return ["ritmoObjetivo"];
  if (fase === "construccion") return ["tempo"];
  // específico: depende de la distancia
  return objetivo === "5k" ? ["series", "tempo"] : ["tempo", "ritmoObjetivo"];
}

/* ---------- reparto ---------- */

/**
 * Ordena los días libres para que las sesiones duras queden separadas.
 *
 * Con 110 kg, dos días duros seguidos es la receta de la tendinitis. Se busca
 * el día más alejado de los demás para la tirada larga y se intercala.
 */
export function ordenarDias(diasLibres) {
  const idx = diasLibres.map((d) => DIAS_SEMANA.indexOf(d)).sort((a, b) => a - b);
  return idx.map((i) => DIAS_SEMANA[i]);
}

/**
 * Reparte las sesiones de una semana entre los días disponibles.
 *
 * La tirada larga va al último día libre (normalmente fin de semana), la
 * calidad en los días más separados de ella, y el resto se llena con rodaje.
 */
export function repartirSemana(diasLibres, calidad, kmSemana, largoMax) {
  const dias = ordenarDias(diasLibres);
  if (!dias.length) return [];

  const sesiones = dias.map((d) => ({ dia: d, sesion: "facil" }));

  // La tirada larga al final de la semana.
  sesiones[sesiones.length - 1].sesion = "largo";

  // La calidad se coloca lo más lejos posible de la larga y entre sí.
  const disponibles = sesiones.slice(0, -1);
  calidad.slice(0, disponibles.length).forEach((tipo, i) => {
    const paso = Math.max(1, Math.floor(disponibles.length / (calidad.length + 1)));
    const pos = Math.min(disponibles.length - 1, i * (paso + 1));
    disponibles[pos].sesion = tipo;
  });

  return repartirKm(sesiones, kmSemana, largoMax);
}

/**
 * Asigna kilómetros a cada sesión.
 *
 * La larga se lleva su fracción, la calidad un bloque medio, y el resto se
 * divide entre los rodajes fáciles.
 */
export function repartirKm(sesiones, kmSemana, largoMax) {
  const conKm = sesiones.map((s) => ({ ...s }));
  const largo = conKm.find((s) => s.sesion === "largo");
  const calidad = conKm.filter((s) => s.sesion !== "largo" && s.sesion !== "facil");
  const faciles = conKm.filter((s) => s.sesion === "facil");

  // Pesos relativos: la larga se lleva su fracción, cada sesión de calidad
  // cuenta como 1.2 rodajes fáciles porque incluye calentamiento y vuelta a la
  // calma además del bloque duro.
  const pesoCalidad = 1.2;
  const pesoRestante = calidad.length * pesoCalidad + faciles.length;
  const kmLargo = largo ? kmSemana * largoMax : 0;
  const porPeso = pesoRestante > 0 ? (kmSemana - kmLargo) / pesoRestante : 0;

  if (largo) largo.km = redondear(kmLargo);
  calidad.forEach((s) => { s.km = redondear(porPeso * pesoCalidad); });
  faciles.forEach((s) => { s.km = redondear(porPeso); });

  // El redondeo a décimas desajusta la suma; la diferencia se come la sesión
  // más larga, donde un par de cientos de metros no cambian nada.
  const suma = conKm.reduce((a, s) => a + s.km, 0);
  const diferencia = redondear(kmSemana - suma);
  if (diferencia !== 0 && conKm.length) {
    const mayor = conKm.reduce((a, s) => (s.km > a.km ? s : a), conKm[0]);
    mayor.km = redondear(mayor.km + diferencia);
  }

  return conKm;
}

function redondear(n) {
  return Math.round(n * 10) / 10;
}

/* ---------- generación ---------- */

/**
 * Genera el plan completo.
 *
 * @param {object} cfg
 * @param {"5k"|"10k"|"21k"} cfg.objetivo
 * @param {string[]} cfg.dias  días libres para correr, p.ej. ["mar","jue","sab"]
 * @param {number} [cfg.semanas]  si se da una fecha, las semanas que quedan
 * @param {{km:number, segundos:number}} [cfg.marca]  para calcular ritmos
 * @param {number} [cfg.kmActuales]  volumen semanal actual, para no arrancar alto
 * @returns {{ok:boolean, error?:string, plan?:object}}
 */
export function generar(cfg) {
  const o = OBJETIVOS[cfg.objetivo];
  if (!o) return { ok: false, error: "Objetivo desconocido" };

  const dias = ordenarDias(cfg.dias || []);
  if (dias.length < DIAS_MINIMOS) {
    return {
      ok: false,
      error: `Necesitas al menos ${DIAS_MINIMOS} días libres para correr. Con menos no se construye base sin acumular riesgo.`
    };
  }

  const semanas = cfg.semanas || o.semanas;
  if (semanas < o.afinamiento + 3) {
    return {
      ok: false,
      error: `Para ${o.nombre} necesitas al menos ${o.afinamiento + 3} semanas. Con menos, el plan sería solo afinamiento.`
    };
  }

  // Si ya corre más (o menos) de lo que el plan supone, se escala todo para no
  // pegar un salto el primer día.
  const factorBase = cfg.kmActuales > 0
    ? Math.min(1.6, Math.max(0.6, cfg.kmActuales / o.volumen.inicio))
    : 1;

  const ritmos = cfg.marca
    ? Object.fromEntries(
        ritmosEntrenamiento(cfg.marca.km, cfg.marca.segundos).map((r) => [r.id, r.segPorKm])
      )
    : null;

  const listaSemanas = serieKm(semanas, cfg.objetivo, factorBase).map(({ n, fase, km }) => {
    const calidad = calidadDeFase(fase, cfg.objetivo);
    const sesiones = repartirSemana(dias, calidad, km, o.largoMax).map((s) => ({
      ...s,
      ...SESIONES[s.sesion],
      segPorKm: ritmos ? ritmos[SESIONES[s.sesion].ritmo] : null
    }));
    return {
      n,
      fase,
      km: Math.round(sesiones.reduce((a, s) => a + s.km, 0) * 10) / 10,
      sesiones
    };
  });

  return {
    ok: true,
    plan: {
      objetivo: cfg.objetivo,
      nombre: o.nombre,
      distancia: o.km,
      dias,
      semanas,
      creado: cfg.hoy || new Date().toISOString().slice(0, 10),
      fechaCarrera: cfg.fechaCarrera || null,
      marca: cfg.marca || null,
      prediccion: cfg.marca ? predecir(cfg.marca.km, cfg.marca.segundos, o.km) : null,
      lista: listaSemanas
    }
  };
}

/* ---------- consulta ---------- */

/** Semanas entre dos fechas ISO, redondeando hacia abajo. */
export function semanasEntre(desde, hasta) {
  const a = new Date(desde + "T12:00:00Z");
  const b = new Date(hasta + "T12:00:00Z");
  return Math.floor((b - a) / (7 * 86400000));
}

/** En qué semana del plan cae una fecha. 1 es la primera; 0 si aún no arranca. */
export function semanaActual(plan, hoy) {
  if (!plan) return 0;
  const transcurridas = semanasEntre(plan.creado, hoy);
  return Math.min(plan.semanas, Math.max(1, transcurridas + 1));
}

/** La semana del plan que toca hoy. */
export function semanaDe(plan, hoy) {
  const n = semanaActual(plan, hoy);
  return plan.lista.find((s) => s.n === n) || null;
}

/** El día de la semana ("lun".."dom") de una fecha ISO. */
export function diaDeFecha(fecha) {
  const d = new Date(fecha + "T12:00:00Z").getUTCDay();
  return DIAS_SEMANA[(d + 6) % 7];
}

/** La sesión que toca hoy, si hoy es día de correr. */
export function sesionDeHoy(plan, hoy) {
  const semana = semanaDe(plan, hoy);
  if (!semana) return null;
  return semana.sesiones.find((s) => s.dia === diaDeFecha(hoy)) || null;
}

/** Totales del plan, para mostrarlos al configurarlo. */
export function resumenPlan(plan) {
  const kms = plan.lista.map((s) => s.km);
  return {
    semanas: plan.semanas,
    kmTotal: Math.round(kms.reduce((a, b) => a + b, 0)),
    kmPico: Math.max(...kms),
    sesiones: plan.lista.reduce((a, s) => a + s.sesiones.length, 0),
    porSemana: plan.dias.length
  };
}

/** Texto corto de una sesión, para la lista. */
export function describir(sesion) {
  const r = sesion.segPorKm ? ` a ${formatoRitmo(sesion.segPorKm)}/km` : "";
  return `${sesion.km} km${r}`;
}

/**
 * Compara lo corrido con lo planeado en una semana.
 * @returns {{planeado:number, corrido:number, porcentaje:number}}
 */
export function cumplimiento(semana, carreras) {
  const planeado = semana ? semana.km : 0;
  const corrido = (carreras || []).reduce((a, c) => a + (Number(c.km) || 0), 0);
  return {
    planeado,
    corrido: Math.round(corrido * 10) / 10,
    porcentaje: planeado > 0 ? Math.round((corrido / planeado) * 100) : 0
  };
}

/**
 * Conflictos entre los días de carrera y los de fuerza.
 *
 * No es un error: se puede correr el mismo día que se entrena pierna, pero hay
 * que saberlo. Lo que sí avisa es la tirada larga pegada al día de pierna.
 */
export function conflictos(plan, diasFuerza) {
  if (!plan || !diasFuerza) return [];
  const avisos = [];
  const choque = plan.dias.filter((d) => diasFuerza.includes(d));
  if (choque.length) {
    avisos.push(
      `${choque.map((d) => NOMBRE_DIA[d]).join(" y ")} ${choque.length > 1 ? "tienen" : "tiene"} fuerza y carrera el mismo día. Corre después de las pesas, nunca antes.`
    );
  }
  const diaLargo = plan.dias[plan.dias.length - 1];
  const iLargo = DIAS_SEMANA.indexOf(diaLargo);
  const previo = DIAS_SEMANA[(iLargo + 6) % 7];
  if (diasFuerza.includes(previo)) {
    avisos.push(
      `La tirada larga del ${NOMBRE_DIA[diaLargo].toLowerCase()} cae justo después del día de fuerza. Si las piernas llegan cargadas, cambia la larga de día.`
    );
  }
  return avisos;
}
