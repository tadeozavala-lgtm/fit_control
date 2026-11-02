/**
 * Equilibrio de una rutina de fuerza.
 *
 * El volumen por grupo (volumen.js) responde "¿cuántas series recibe el
 * pecho?". Esto responde las preguntas que un entrenador hace después, y que
 * una suma por grupo no ve:
 *
 * - ¿Ese volumen es trabajo directo o solo lo que cae de rebote? Diez series
 *   de glúteo que salen todas de sentadillas y pesos muertos no son diez
 *   series de glúteo: nunca se le pidió al glúteo que fuera el protagonista.
 * - ¿Cabe en una sesión? Pasadas unas diez series por grupo en el mismo día,
 *   las siguientes rinden cada vez menos. Veinte series de espalda repartidas
 *   en dos días no son lo mismo que veinte el martes.
 * - ¿Empuja tanto como tira? Un hombro que recibe el triple de empuje que de
 *   tracción termina dando problemas, y es el desequilibrio más común en
 *   cualquier rutina armada a ojo.
 * - ¿La rodilla manda sobre la cadera? En alguien que corre, unos isquios y
 *   glúteos flojos frente al cuádriceps son la receta de la rodilla dolorida.
 *
 * Todo esto son AVISOS, no prohibiciones: la rutina sigue siendo de Tadeo.
 */

import { GRUPOS, rangoDe } from "./volumen.js";

/**
 * Series efectivas de un mismo grupo en una sola sesión a partir de las cuales
 * el resto rinde poco. No es un acantilado, es un rendimiento decreciente.
 */
export const TOPE_POR_SESION = 10;

/**
 * El tope se mide sobre las series DIRECTAS cuando se está armando una rutina,
 * porque es lo único que se decide: lo que cae de rebote depende de qué otros
 * ejercicios haya ese día y no se puede fijar por adelantado. El aviso sí mira
 * el total efectivo, que es lo que el músculo acaba recibiendo.
 */

/**
 * Rangos sanos de las parejas de patrones, en series.
 *
 * Tirar de más es barato: casi nadie se lesiona por hacer demasiado remo. Por
 * eso los límites no son simétricos.
 */
export const PAREJAS = [
  {
    id: "horizontal",
    nombre: "Empuje y tracción horizontal",
    empuje: "empuje-horizontal",
    traccion: "traccion-horizontal",
    min: 0.6,
    max: 1.4,
    porQue: "Banca contra remo. Más empuje que tracción adelanta el hombro y cierra el pecho."
  },
  {
    id: "vertical",
    nombre: "Empuje y tracción vertical",
    empuje: "empuje-vertical",
    traccion: "traccion-vertical",
    min: 0.3,
    max: 1.4,
    porQue: "Press militar contra jalón. Aquí tirar de más es sano; empujar de más, no."
  },
  {
    id: "pierna",
    nombre: "Rodilla y cadera",
    empuje: "rodilla",
    traccion: "bisagra",
    min: 0.7,
    max: 2.2,
    porQue:
      "Sentadilla contra peso muerto. Si la rodilla manda muy por encima de la cadera, el isquio y el glúteo se quedan cortos, y eso se paga corriendo."
  }
];

/**
 * Desglose por grupo: directo, indirecto, máximo en una sesión y frecuencia.
 */
export function desglose(rutina) {
  const grupos = {};
  const dar = (g) =>
    (grupos[g] ||= {
      grupo: g, nombre: GRUPOS[g], directo: 0, indirecto: 0,
      porSesion: 0, porSesionDirecto: 0, dias: 0
    });

  Object.keys(GRUPOS).forEach(dar);

  (rutina?.dias || [])
    .filter((d) => d.ejercicios)
    .forEach((d) => {
      const enDia = {};
      const directoEnDia = {};
      d.ejercicios.forEach((e) => {
        if (!e.grupo) return;
        const s = Number(e.series) || 0;
        dar(e.grupo).directo += s;
        enDia[e.grupo] = (enDia[e.grupo] || 0) + s;
        directoEnDia[e.grupo] = (directoEnDia[e.grupo] || 0) + s;
        (e.secundarios || []).forEach((g) => {
          dar(g).indirecto += s * 0.5;
          enDia[g] = (enDia[g] || 0) + s * 0.5;
        });
      });
      Object.entries(enDia).forEach(([g, s]) => {
        const x = dar(g);
        x.porSesion = Math.max(x.porSesion, s);
        x.porSesionDirecto = Math.max(x.porSesionDirecto, directoEnDia[g] || 0);
        x.dias += 1;
      });
    });

  return Object.values(grupos).map((x) => {
    const total = redondear(x.directo + x.indirecto);
    const rango = rangoDe(x.grupo);
    return {
      ...x,
      indirecto: redondear(x.indirecto),
      porSesion: redondear(x.porSesion),
      porSesionDirecto: redondear(x.porSesionDirecto),
      total,
      rango,
      estado: total < rango.min ? "bajo" : total > rango.max ? "alto" : "ok"
    };
  });
}

/** Series por patrón de movimiento en toda la semana. */
export function porPatron(rutina) {
  const total = {};
  (rutina?.dias || [])
    .filter((d) => d.ejercicios)
    .forEach((d) =>
      d.ejercicios.forEach((e) => {
        if (e.patron) total[e.patron] = (total[e.patron] || 0) + (Number(e.series) || 0);
      })
    );
  return total;
}

/** El estado de cada pareja de patrones, con su proporción. */
export function equilibrios(rutina) {
  const p = porPatron(rutina);
  return PAREJAS.map((par) => {
    const empuje = p[par.empuje] || 0;
    const traccion = p[par.traccion] || 0;
    // Sin nada de una de las dos no hay proporción que calcular, pero que
    // falte un patrón entero sí es un hallazgo.
    const ratio = traccion ? redondear(empuje / traccion) : null;
    let estado = "ok";
    if (!empuje || !traccion) estado = "falta";
    else if (ratio > par.max) estado = "exceso";
    else if (ratio < par.min) estado = "defecto";
    return { ...par, series: { empuje, traccion }, ratio, estado };
  });
}

/**
 * Todo lo que un entrenador diría al ver la rutina, de lo más importante a lo
 * menos. `nivel` es "alto" para lo que conviene arreglar y "medio" para lo que
 * vale la pena saber.
 */
export function avisos(rutina) {
  const lista = [];
  const g = desglose(rutina);

  g.filter((x) => x.estado === "bajo" && x.total > 0).forEach((x) =>
    lista.push({
      nivel: "alto",
      grupo: x.grupo,
      tipo: "bajo",
      texto: `${x.nombre}: ${x.total} series semanales, por debajo del mínimo de ${x.rango.min}.`
    })
  );

  g.filter((x) => x.total === 0).forEach((x) =>
    lista.push({
      nivel: "alto",
      grupo: x.grupo,
      tipo: "ausente",
      texto: `${x.nombre} no se entrena en toda la semana.`
    })
  );

  // Pasarse del rango no siempre significa lo mismo. Si el exceso es trabajo
  // DIRECTO, hay series de más que se pueden quitar. Si llega de rebote —el
  // hombro recibe algo de cada press y de cada remo—, el número avisa pero no
  // hay nada que recortar sin cambiar la rutina entera: el 0.5 de las series
  // secundarias es una aproximación, no una medida.
  g.filter((x) => x.estado === "alto").forEach((x) =>
    lista.push(
      x.directo > x.rango.max
        ? {
            nivel: "alto",
            grupo: x.grupo,
            tipo: "alto",
            texto: `${x.nombre}: ${x.directo} series directas, por encima del máximo de ${x.rango.max}. Sobran series.`
          }
        : {
            nivel: "medio",
            grupo: x.grupo,
            tipo: "alto",
            texto: `${x.nombre}: ${x.total} series, por encima de ${x.rango.max}, pero solo ${x.directo} son directas; el resto llega de rebote de otros ejercicios.`
          }
    )
  );

  // El caso glúteo: llega a su rango sin que ningún ejercicio lo tenga como
  // protagonista. Cuenta para el volumen pero no es el mismo estímulo.
  g.filter((x) => x.total > 0 && x.directo === 0).forEach((x) =>
    lista.push({
      nivel: "alto",
      grupo: x.grupo,
      tipo: "sin-directo",
      texto: `${x.nombre}: sus ${x.total} series salen todas de rebote de otros ejercicios. Ninguno lo entrena de frente.`
    })
  );

  g.filter((x) => x.porSesion > TOPE_POR_SESION).forEach((x) =>
    lista.push({
      nivel: "medio",
      grupo: x.grupo,
      tipo: "dosis",
      texto: `${x.nombre}: ${x.porSesion} series en una misma sesión. Pasadas ${TOPE_POR_SESION}, las últimas rinden poco; reparte en otro día.`
    })
  );

  g.filter((x) => x.total >= x.rango.min && x.dias === 1).forEach((x) =>
    lista.push({
      nivel: "medio",
      grupo: x.grupo,
      tipo: "frecuencia",
      texto: `${x.nombre} se entrena un solo día. Dos veces por semana rinde más con las mismas series.`
    })
  );

  equilibrios(rutina).forEach((e) => {
    if (e.estado === "exceso") {
      lista.push({
        nivel: "alto",
        tipo: "equilibrio",
        texto: `${e.nombre}: ${e.series.empuje} contra ${e.series.traccion} series. ${e.porQue}`
      });
    } else if (e.estado === "defecto") {
      lista.push({
        nivel: "medio",
        tipo: "equilibrio",
        texto: `${e.nombre}: solo ${e.series.empuje} contra ${e.series.traccion} series. No es peligroso, pero ese lado se está quedando sin trabajo.`
      });
    } else if (e.estado === "falta" && (e.series.empuje || e.series.traccion)) {
      const falta = e.series.empuje ? e.traccion : e.empuje;
      lista.push({
        nivel: "alto",
        tipo: "equilibrio",
        texto: `${e.nombre}: falta por completo el patrón de ${nombrePatron(falta)}.`
      });
    }
  });

  const orden = { alto: 0, medio: 1 };
  return lista.sort((a, b) => orden[a.nivel] - orden[b.nivel]);
}

/** Resumen de una línea, para enseñar antes de aplicar una rutina. */
export function veredicto(rutina) {
  const l = avisos(rutina);
  const altos = l.filter((x) => x.nivel === "alto").length;
  if (!l.length) return { ok: true, texto: "Equilibrada: todos los grupos en rango y los patrones compensados." };
  if (!altos) return { ok: true, texto: `Sin problemas de peso. ${l.length} detalle(s) que puedes mirar.` };
  return { ok: false, texto: `${altos} cosa(s) que conviene arreglar antes de usarla.` };
}

const NOMBRES_PATRON = {
  "empuje-horizontal": "empuje horizontal",
  "empuje-vertical": "empuje vertical",
  "traccion-horizontal": "tracción horizontal",
  "traccion-vertical": "tracción vertical",
  rodilla: "rodilla",
  bisagra: "bisagra de cadera"
};

function nombrePatron(p) {
  return NOMBRES_PATRON[p] || p;
}

function redondear(x) {
  return Math.round(x * 10) / 10;
}
