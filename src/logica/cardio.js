/**
 * Modalidades y protocolos de cardio.
 *
 * El objetivo de Tadeo con el cardio es salud cardiovascular, no un tiempo en
 * una carrera. Eso cambia la pregunta: el corazón no sabe si estás corriendo o
 * remando, solo sabe cuánto tiempo pasas en qué zona. Así que la modalidad se
 * elige por lo que la rodea —impacto articular, qué músculo carga antes del
 * día de fuerza, qué máquina está libre— y no por una supuesta superioridad
 * aeróbica de correr.
 *
 * Dos cosas que SÍ cambian al cambiar de modalidad, y que la app tiene que
 * respetar:
 *
 * 1. La frecuencia cardiaca máxima no es la misma. En bicicleta se alcanzan
 *    unas 5 pulsaciones menos que corriendo y nadando unas 12: menos masa
 *    muscular en juego y, en el agua, la posición horizontal y la presión
 *    hidrostática. Usar la máxima de correr para pedalear deja las zonas
 *    demasiado altas y convierte un rodaje suave en un tempo. Por eso cada
 *    modalidad trae `ajusteFcMax` y las zonas se recalculan (regla 7: las
 *    zonas se calculan, nunca se escriben a mano).
 * 2. El gasto calórico por minuto. De ahí `met` y `metFuerte`.
 */

/**
 * Impacto articular por pisada. Importa porque ya hay dos días de pierna y
 * tres de cardio: el tope no es el corazón, son las rodillas y el aquiles.
 */
export const IMPACTO = {
  alto: "Impacto alto",
  bajo: "Impacto bajo",
  nulo: "Sin impacto"
};

/**
 * Las modalidades intercambiables.
 *
 * `carga` son los grupos musculares que deja cansados: sirve para avisar
 * cuando el cardio del día pisa el mismo músculo que la sesión de fuerza.
 */
export const MODALIDADES = [
  {
    id: "carrera",
    nombre: "Carrera continua",
    z2: true,
    hiit: true,
    impacto: "alto",
    ajusteFcMax: 0,
    met: 8.3,
    metFuerte: 11.5,
    carga: ["gemelo", "isquios", "cuadriceps"],
    fuerte: "corre fuerte",
    suave: "trota suave",
    porQue:
      "La referencia: no necesita máquina y es la que mejor traduce a correr más lejos.",
    ojo: "Es la de más impacto. Tres días a la semana sobre asfalto es lo que suele despertar el aquiles."
  },
  {
    id: "caminata",
    nombre: "Caminata en inclinación",
    z2: true,
    hiit: false,
    impacto: "bajo",
    ajusteFcMax: -2,
    met: 7,
    metFuerte: 8.5,
    carga: ["gemelo", "gluteo"],
    fuerte: "sube el porcentaje",
    suave: "baja la inclinación",
    porQue:
      "Caminar al 10–12% a 5–6 km/h pone la Zona 2 sin una sola pisada de carrera. La forma más barata de sumar minutos sin castigar la rodilla.",
    ojo: "Agarrarse de los pasamanos baja las pulsaciones y arruina el estímulo. Manos sueltas."
  },
  {
    id: "bici",
    nombre: "Bicicleta estática",
    z2: true,
    hiit: true,
    impacto: "nulo",
    ajusteFcMax: -5,
    met: 7,
    metFuerte: 11,
    carga: ["cuadriceps"],
    fuerte: "pedalea fuerte",
    suave: "pedalea suave",
    porQue:
      "Cero impacto y la zona se sostiene sin pensar: la resistencia la pones tú, no el terreno.",
    ojo: "Carga cuádriceps. En día de pierna, mejor después de las pesas y no antes."
  },
  {
    id: "eliptica",
    nombre: "Elíptica",
    z2: true,
    hiit: true,
    impacto: "bajo",
    ajusteFcMax: -3,
    met: 6.5,
    metFuerte: 9.5,
    carga: ["cuadriceps", "gluteo"],
    fuerte: "acelera y sube resistencia",
    suave: "cadencia suave",
    porQue:
      "Lo más parecido al gesto de correr sin el golpe. Útil la semana que la rodilla avisa.",
    ojo: "Es fácil dejar que la máquina te lleve y perder zona sin notarlo. Mira el pulso, no la pantalla."
  },
  {
    id: "remo",
    nombre: "Remo ergómetro",
    z2: true,
    hiit: true,
    impacto: "nulo",
    ajusteFcMax: -3,
    met: 7,
    metFuerte: 11,
    carga: ["espalda", "isquios", "cuadriceps"],
    fuerte: "rema fuerte",
    suave: "rema suave",
    porQue:
      "Sube pulsaciones con el cuerpo entero y sin impacto. El que más estímulo da por minuto de los que no golpean.",
    ojo: "Suma trabajo de espalda, que ya está en el techo de su rango. En día de torso, cuenta como series."
  },
  {
    id: "escaladora",
    nombre: "Escaladora",
    z2: true,
    hiit: true,
    impacto: "bajo",
    ajusteFcMax: -4,
    met: 8,
    metFuerte: 10.5,
    carga: ["gluteo", "cuadriceps", "gemelo"],
    fuerte: "sube el ritmo",
    suave: "escalón lento",
    porQue:
      "Sube el pulso rapidísimo con poco impacto. Buena para días cortos de tiempo.",
    ojo: "Carga glúteo y gemelo, justo lo que usa la carrera. Dos días seguidos con esto se nota."
  },
  {
    id: "natacion",
    nombre: "Natación",
    z2: true,
    hiit: true,
    impacto: "nulo",
    ajusteFcMax: -12,
    met: 7.5,
    metFuerte: 10,
    carga: ["espalda", "hombro"],
    fuerte: "nada fuerte",
    suave: "nada suave",
    porQue:
      "Descarga completa de articulaciones. La mejor opción cuando algo duele al correr.",
    ojo: "El pulso corre unas 12 pulsaciones por debajo del de tierra: las zonas de aquí ya vienen corregidas. Si la técnica es mala, mandará la respiración antes que el corazón."
  },
  {
    id: "cuerda",
    nombre: "Cuerda + sombra",
    z2: false,
    hiit: true,
    impacto: "alto",
    ajusteFcMax: -2,
    met: 9,
    metFuerte: 12,
    carga: ["gemelo", "hombro"],
    fuerte: "cuerda rápida",
    suave: "sombra suave",
    porQue:
      "La que ya haces: sube el pulso en segundos y entrena coordinación y pie.",
    ojo: "Impacto alto en gemelo y sóleo, los mismos que cargan los tres días de carrera."
  },
  {
    id: "box",
    nombre: "Circuito de box",
    z2: false,
    hiit: true,
    impacto: "alto",
    ajusteFcMax: -2,
    met: 9.5,
    metFuerte: 12,
    carga: ["hombro", "core", "gemelo"],
    fuerte: "combinación fuerte",
    suave: "sombra caminando",
    porQue:
      "La que más te entretiene, y entretenerse es el 90% de la adherencia a un HIIT.",
    ojo: "El pulso depende mucho de cuánto te emplees. Sin pulsómetro es fácil quedarse corto."
  }
];

export function modalidad(id) {
  return MODALIDADES.find((m) => m.id === id) || null;
}

/** Las modalidades que sirven para un tipo de sesión: "z2" o "hiit". */
export function modalidadesPara(tipo) {
  return MODALIDADES.filter((m) => (tipo === "hiit" ? m.hiit : m.z2));
}

/**
 * La FC máxima que toca usar en esta modalidad.
 *
 * `fcMaxCarrera` es la de correr: la medida o la estimada por edad. El ajuste
 * nunca puede dejarla por debajo del reposo, de ahí el tope.
 */
export function fcMaxDe(modalidadId, fcMaxCarrera, fcReposo = 0) {
  const m = modalidad(modalidadId);
  const ajuste = m ? m.ajusteFcMax : 0;
  return Math.max(Number(fcReposo) + 1, Math.round(Number(fcMaxCarrera) + ajuste));
}

/* ---------- protocolos de intervalos ---------- */

/**
 * Las estructuras de HIIT, separadas de la modalidad.
 *
 * Separarlas es lo que permite intercambiar: un 4×4 es un 4×4 en bici, en remo
 * o corriendo, y lo único que cambia es el verbo. Los dos protocolos de box
 * declaran sus modalidades porque un EMOM de sombra no se hace pedaleando.
 *
 * `modalidades: null` significa que vale con cualquiera. `minutos` es la
 * duración REAL de la secuencia, calentamiento y enfriamiento incluidos: es lo
 * que se enseña en el menú y hay un test que no deja que se separen.
 */
export const PROTOCOLOS = [
  {
    id: "4x4",
    nombre: "4×4 noruego",
    modalidades: null,
    minutos: 43,
    zona: "4–5",
    porQue:
      "El protocolo más estudiado para subir el VO2 máx, que es el número que mejor predice salud cardiovascular. Cuatro bloques de cuatro minutos duros con tres de respiro.",
    secuencia: {
      calentamiento: { n: "Calentamiento progresivo", t: 600 },
      rondas: {
        veces: 4,
        etiqueta: "Bloque",
        pasos: [
          { t: 240, i: "fuerte" },
          { t: 180, i: "suave" }
        ]
      },
      enfriamiento: { n: "Enfriamiento suave", t: 300 }
    }
  },
  {
    id: "30-30",
    nombre: "30-30",
    modalidades: null,
    minutos: 27,
    zona: "5",
    porQue:
      "Treinta segundos fuerte, treinta suave, catorce veces. Acumula mucho tiempo cerca del máximo sin que ningún bloque se haga eterno.",
    secuencia: {
      calentamiento: { n: "Calentamiento progresivo", t: 480 },
      rondas: {
        veces: 14,
        etiqueta: "Serie",
        pasos: [
          { t: 30, i: "fuerte" },
          { t: 30, i: "suave" }
        ]
      },
      enfriamiento: { n: "Enfriamiento suave", t: 300 }
    }
  },
  {
    id: "10-20-30",
    nombre: "10-20-30",
    modalidades: null,
    minutos: 32,
    zona: "3–5",
    porQue:
      "Cinco minutos seguidos alternando 30 s suave, 20 s medio y 10 s casi a tope, tres veces. Sube el consumo máximo con poco volumen total.",
    secuencia: {
      calentamiento: { n: "Calentamiento progresivo", t: 480 },
      rondas: {
        veces: 3,
        etiqueta: "Bloque",
        descansoEntre: 120,
        pasos: [
          { t: 30, i: "suave" },
          { t: 20, i: "medio" },
          { t: 10, i: "tope" },
          { t: 30, i: "suave" },
          { t: 20, i: "medio" },
          { t: 10, i: "tope" },
          { t: 30, i: "suave" },
          { t: 20, i: "medio" },
          { t: 10, i: "tope" },
          { t: 30, i: "suave" },
          { t: 20, i: "medio" },
          { t: 10, i: "tope" },
          { t: 30, i: "suave" },
          { t: 20, i: "medio" },
          { t: 10, i: "tope" }
        ]
      },
      enfriamiento: { n: "Enfriamiento suave", t: 300 }
    }
  },
  {
    id: "cuerda-sombra",
    nombre: "Cuerda + sombra",
    modalidades: ["cuerda", "box"],
    minutos: 26,
    zona: "4–5",
    porQue: "Ocho rounds cortos con descanso caminando. Es tu HIIT A de siempre.",
    secuencia: {
      calentamiento: { n: "Calentamiento · cuerda suave", t: 300 },
      rondas: {
        veces: 8,
        etiqueta: "Round",
        pasos: [
          { n: "cuerda rápida", t: 40 },
          { n: "sombra 1-2", t: 20 },
          { n: "descanso caminando", t: 60 }
        ]
      },
      enfriamiento: { n: "Enfriamiento · sombra lenta + movilidad", t: 300 }
    }
  },
  {
    id: "emom-box",
    nombre: "EMOM de box",
    modalidades: ["box", "cuerda"],
    minutos: 31,
    zona: "4",
    porQue: "Cinco vueltas de cinco minutos, cambiando de tarea cada minuto. Tu HIIT B.",
    secuencia: {
      rondas: {
        veces: 5,
        etiqueta: "V",
        descansoEntre: 90,
        pasos: [
          { n: "60 saltos de cuerda", t: 60 },
          { n: "Sombra 1-2-3-2", t: 60 },
          { n: "Jumping jacks 45 s", t: 60 },
          { n: "Sombra defensiva + 4 uppercuts", t: 60 },
          { n: "10 burpees o 20 mountain climbers", t: 60 }
        ]
      }
    }
  }
];

export function protocolo(id) {
  return PROTOCOLOS.find((p) => p.id === id) || null;
}

/** Los protocolos que se pueden hacer con una modalidad. */
export function protocolosPara(modalidadId) {
  return PROTOCOLOS.filter((p) => !p.modalidades || p.modalidades.includes(modalidadId));
}

/**
 * La secuencia lista para el cronómetro: el protocolo con los verbos de la
 * modalidad. Un "4 min FUERTE" se convierte en "4 min pedalea fuerte" si el
 * día es de bici, para que la voz diga algo que se pueda obedecer.
 */
export function secuenciaDe(protocoloId, modalidadId) {
  const p = protocolo(protocoloId);
  if (!p) return null;
  // Los protocolos de box ya nombran lo que hay que hacer; los genéricos traen
  // la intensidad de cada paso y aquí se le pone el verbo de la modalidad.
  const m = modalidad(modalidadId);
  if (!m || p.modalidades) return p.secuencia;

  const s = p.secuencia;
  return {
    ...s,
    rondas: { ...s.rondas, pasos: s.rondas.pasos.map((x) => nombrarPaso(x, m)) }
  };
}

/** "30 s" o "4 min", como se lee de un vistazo con el teléfono en el suelo. */
function enTiempo(segundos) {
  return segundos >= 60 ? `${Math.round(segundos / 60)} min` : `${segundos} s`;
}

function nombrarPaso(paso, m) {
  if (paso.n || !paso.i) return paso;
  const verbo = {
    fuerte: `FUERTE · ${m.fuerte}`,
    tope: `CASI A TOPE · ${m.fuerte}`,
    medio: `medio · ${m.fuerte} a medias`,
    suave: `suave · ${m.suave}`
  }[paso.i];
  return { n: `${enTiempo(paso.t)} ${verbo}`, t: paso.t };
}

/* ---------- choques con la fuerza ---------- */

/**
 * Los grupos que el cardio del día deja cansados y que la sesión de fuerza de
 * ese mismo día también entrena.
 *
 * No es una prohibición: es el aviso que falta cuando uno elige la máquina por
 * lo que está libre. Remar antes de un día de torso y sentir la espalda muerta
 * no es mala suerte, es esto.
 */
export function choqueConFuerza(modalidadId, diaFuerza) {
  const m = modalidad(modalidadId);
  if (!m || !diaFuerza) return [];
  const grupos = new Set();
  (diaFuerza.ejercicios || []).forEach((e) => {
    if (e.grupo) grupos.add(e.grupo);
    (e.secundarios || []).forEach((g) => grupos.add(g));
  });
  return m.carga.filter((g) => grupos.has(g));
}

/* ---------- días de la semana ---------- */

export const DIAS_SEMANA = [
  { id: "lun", nombre: "Lun" },
  { id: "mar", nombre: "Mar" },
  { id: "mie", nombre: "Mié" },
  { id: "jue", nombre: "Jue" },
  { id: "vie", nombre: "Vie" },
  { id: "sab", nombre: "Sáb" },
  { id: "dom", nombre: "Dom" }
];

const ORDEN = DIAS_SEMANA.map((d) => d.id);

/** Ordena y limpia una lista de días, sin repetidos. */
export function ordenarDias(dias) {
  return [...new Set((dias || []).filter((d) => ORDEN.includes(d)))].sort(
    (a, b) => ORDEN.indexOf(a) - ORDEN.indexOf(b)
  );
}

/** "Lun · Mié · Jue", que es como rutina.json escribe los días de cardio. */
export function etiquetaDias(dias) {
  const l = ordenarDias(dias);
  if (!l.length) return "Sin día fijo";
  return l.map((d) => DIAS_SEMANA.find((x) => x.id === d).nombre).join(" · ");
}

/**
 * Configuración de cardio por defecto: lo que hoy está escrito en rutina.json.
 *
 * Vive aquí y no en rutina.json porque a partir de ahora los días los decide
 * Tadeo desde la app; esto es solo el punto de partida.
 */
export function CARDIO_POR_DEFECTO() {
  return {
    z2: { dias: ["lun", "mie", "jue"], modalidad: "carrera", minutos: 30 },
    hiitA: { dias: ["mar"], modalidad: "cuerda", protocolo: "cuerda-sombra" },
    hiitB: { dias: ["vie"], modalidad: "box", protocolo: "emom-box" }
  };
}

/**
 * La configuración de un día de cardio, con los valores por defecto rellenados
 * y la modalidad y el protocolo verificados: un id que ya no existe no puede
 * dejar la pestaña en blanco.
 */
export function configDe(datos, diaId) {
  const base = CARDIO_POR_DEFECTO()[diaId];
  if (!base) return null;
  const guardado = (datos?.cardio || {})[diaId] || {};
  const cfg = { ...base, ...guardado };

  // Una lista vacía es una decisión: apagar esa sesión. Solo cuando no hay
  // nada guardado se cae a los días de siempre.
  cfg.dias = ordenarDias(Array.isArray(guardado.dias) ? guardado.dias : base.dias);
  if (!modalidad(cfg.modalidad)) cfg.modalidad = base.modalidad;

  if (base.protocolo) {
    const permitidos = protocolosPara(cfg.modalidad);
    if (!permitidos.some((p) => p.id === cfg.protocolo)) {
      cfg.protocolo = permitidos[0]?.id || base.protocolo;
    }
  }
  return cfg;
}

/** Minutos de Zona 2 recomendados según la semana del bloque. */
export function minutosZ2(semana) {
  if (semana <= 2) return 30;
  if (semana <= 4) return 35;
  return 40;
}

/**
 * Minutos semanales de cardio y cuántos de ellos son de alta intensidad.
 *
 * La referencia para salud cardiovascular son 150 min semanales moderados o 75
 * vigorosos, y se pueden mezclar contando cada minuto vigoroso por dos.
 */
export function resumenSemanal(datos, semana = 1) {
  const z2 = configDe(datos, "z2");
  const a = configDe(datos, "hiitA");
  const b = configDe(datos, "hiitB");

  const minutosModerados = z2.dias.length * minutosZ2(semana);
  const vigorosos =
    a.dias.length * (protocolo(a.protocolo)?.minutos || 0) +
    b.dias.length * (protocolo(b.protocolo)?.minutos || 0);

  return {
    sesiones: z2.dias.length + a.dias.length + b.dias.length,
    moderados: minutosModerados,
    vigorosos,
    // Un minuto vigoroso cuenta por dos moderados.
    equivalente: minutosModerados + vigorosos * 2,
    cumpleRecomendacion: minutosModerados + vigorosos * 2 >= 150
  };
}

/**
 * El cardio que cae en un día de la semana.
 *
 * Lo usa la pestaña de fuerza para decir qué toca al terminar las pesas. Antes
 * era una frase escrita a mano en rutina.json ("+ 30 min carrera Zona 2"), que
 * dejaba de ser verdad en cuanto se movía un día.
 *
 * @param {string} diaSemana "lun", "mar"…
 */
export function cardioDelDia(datos, diaSemana) {
  return ["z2", "hiitA", "hiitB"]
    .map((id) => ({ id, cfg: configDe(datos, id) }))
    .filter(({ cfg }) => cfg.dias.includes(diaSemana))
    .map(({ id, cfg }) => {
      const m = modalidad(cfg.modalidad);
      if (id === "z2") {
        return { id, texto: `${cfg.minutos} min de ${m.nombre.toLowerCase()} en Zona 2` };
      }
      return { id, texto: `${protocolo(cfg.protocolo)?.nombre || "HIIT"} · ${m.nombre.toLowerCase()}` };
    });
}

/** Todos los días de la semana que ocupa el cardio. */
export function diasDeCardio(datos) {
  return ordenarDias(
    ["z2", "hiitA", "hiitB"].flatMap((id) => configDe(datos, id)?.dias || [])
  );
}
