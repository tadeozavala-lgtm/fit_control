/**
 * Construye la lista de bloques de un día de intervalos a partir de la
 * especificación declarativa de rutina.json.
 *
 * En la v1 esto eran funciones JavaScript dentro del HTML, así que cambiar un
 * round obligaba a editar código. Ahora es dato.
 */

/**
 * @param {object} spec  día.secuencia de rutina.json
 * @returns {Array<{n:string, t:number, tipo:string}>}
 */
export function construirSecuencia(spec) {
  if (!spec) return [];
  const pasos = [];

  if (spec.calentamiento) {
    pasos.push({ ...spec.calentamiento, tipo: "calentamiento" });
  }

  const r = spec.rondas;
  if (r) {
    const etiqueta = r.etiqueta || "Round";
    for (let i = 1; i <= r.veces; i++) {
      r.pasos.forEach((p, idx) => {
        const esDescanso = /descanso/i.test(p.n);
        pasos.push({
          n: `${etiqueta}${etiqueta.length > 2 ? " " : ""}${i} · ${r.pasos.length > 3 ? `Min ${idx + 1} · ` : ""}${p.n}`,
          t: p.t,
          tipo: esDescanso ? "descanso" : "trabajo"
        });
      });
      if (r.descansoEntre && i < r.veces) {
        pasos.push({ n: "Descanso entre vueltas", t: r.descansoEntre, tipo: "descanso" });
      }
    }
  }

  if (spec.enfriamiento) {
    pasos.push({ ...spec.enfriamiento, tipo: "enfriamiento" });
  }

  return pasos;
}

/** Duración total en segundos. */
export function duracion(pasos) {
  return pasos.reduce((a, p) => a + p.t, 0);
}

/** Minutos de trabajo real, sin calentamiento ni descansos. */
export function minutosTrabajo(pasos) {
  return Math.round(
    pasos.filter((p) => p.tipo === "trabajo").reduce((a, p) => a + p.t, 0) / 60
  );
}
