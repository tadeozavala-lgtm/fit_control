/**
 * Edición de la rutina desde el teléfono.
 *
 * El problema que resuelve: cambiar una serie o un descanso obligaba a editar
 * rutina.json con Working Copy y esperar a que Actions desplegara. Eso no se
 * hace de pie en el gimnasio.
 *
 * La solución es una CAPA de cambios encima de rutina.json, no una copia de la
 * rutina. Importa la diferencia: si mañana se despliega una versión nueva con
 * un ejercicio corregido, Tadeo conserva sus ajustes y hereda todo lo demás.
 * Una copia completa se quedaría congelada en el pasado.
 */

/** Lo único que se puede cambiar desde la app. El resto exige editar el JSON. */
export const EDITABLES = {
  series: { etiqueta: "Series", tipo: "numero", min: 1, max: 10 },
  reps: { etiqueta: "Reps", tipo: "texto" },
  repMax: { etiqueta: "Tope de reps", tipo: "numero", min: 1, max: 100 },
  tempo: { etiqueta: "Tempo", tipo: "texto" },
  rir: { etiqueta: "RIR", tipo: "numero", min: 0, max: 5 },
  descanso: { etiqueta: "Descanso (s)", tipo: "numero", min: 15, max: 300 },
  sugerido: { etiqueta: "Peso sugerido", tipo: "texto" }
};

export const CLAVES_EDITABLES = Object.keys(EDITABLES);

/** Valida un valor contra su definición. @returns {{ok:boolean, valor?, error?}} */
export function validar(clave, valor) {
  const def = EDITABLES[clave];
  if (!def) return { ok: false, error: "Ese campo no se puede editar desde aquí" };

  if (def.tipo === "numero") {
    const n = Number(valor);
    if (!Number.isFinite(n)) return { ok: false, error: "Tiene que ser un número" };
    if (n < def.min || n > def.max) {
      return { ok: false, error: `Entre ${def.min} y ${def.max}` };
    }
    return { ok: true, valor: n };
  }

  const texto = String(valor ?? "").trim();
  if (!texto) return { ok: false, error: "No puede quedar vacío" };

  // El sugerido alimenta la conversión a libras y la tabla de equivalencias.
  if (clave === "sugerido" && !/kg/i.test(texto) && !/corporal/i.test(texto)) {
    return { ok: false, error: 'En kg, por ejemplo "60 kg", o "peso corporal"' };
  }
  if (clave === "tempo" && !/^\d-\d-\d-\d$|^isom/i.test(texto)) {
    return { ok: false, error: 'Formato 3-1-1-0, o "isométrico"' };
  }
  return { ok: true, valor: texto };
}

/** Guarda un cambio en la capa. Un valor igual al original borra el ajuste. */
export function ajustar(ajustesRutina, ejercicioId, clave, valor, original) {
  const r = validar(clave, valor);
  if (!r.ok) return r;

  const capa = { ...(ajustesRutina || {}) };
  const delEj = { ...(capa[ejercicioId] || {}) };

  if (original !== undefined && r.valor === original) {
    delete delEj[clave];
  } else {
    delEj[clave] = r.valor;
  }

  if (Object.keys(delEj).length) capa[ejercicioId] = delEj;
  else delete capa[ejercicioId];

  return { ok: true, valor: r.valor, capa };
}

/** Quita todos los ajustes de un ejercicio. */
export function restaurar(ajustesRutina, ejercicioId) {
  const capa = { ...(ajustesRutina || {}) };
  delete capa[ejercicioId];
  return capa;
}

/** Un ejercicio con su capa de ajustes aplicada encima. */
export function aplicar(ejercicio, ajustesRutina) {
  const cambios = (ajustesRutina || {})[ejercicio.id];
  if (!cambios) return ejercicio;
  return { ...ejercicio, ...cambios };
}

/**
 * La rutina completa con la capa aplicada.
 * Devuelve la misma rutina si no hay ajustes, para no copiar de más.
 */
export function rutinaAjustada(rutina, ajustesRutina) {
  if (!ajustesRutina || !Object.keys(ajustesRutina).length) return rutina;
  return {
    ...rutina,
    dias: rutina.dias.map((d) =>
      d.ejercicios ? { ...d, ejercicios: d.ejercicios.map((e) => aplicar(e, ajustesRutina)) } : d
    )
  };
}

/** ¿Este ejercicio tiene algo cambiado? */
export function estaAjustado(ajustesRutina, ejercicioId) {
  return Boolean((ajustesRutina || {})[ejercicioId]);
}

/** Qué cambió, en texto, para mostrarlo en la tarjeta. */
export function resumenCambios(ajustesRutina, ejercicioId, original) {
  const cambios = (ajustesRutina || {})[ejercicioId];
  if (!cambios) return "";
  return Object.entries(cambios)
    .map(([k, v]) => `${EDITABLES[k]?.etiqueta || k} ${original?.[k]} → ${v}`)
    .join(" · ");
}

/** Cuántos ejercicios tienen ajustes. */
export function cuantosAjustados(ajustesRutina) {
  return Object.keys(ajustesRutina || {}).length;
}

/**
 * Exporta la capa como un parche legible, para pegarlo en rutina.json y
 * commitearlo cuando el cambio demuestre que vale la pena conservarlo.
 */
export function exportarParche(ajustesRutina, rutina) {
  const lineas = [];
  Object.entries(ajustesRutina || {}).forEach(([id, cambios]) => {
    const ej = rutina.dias
      .filter((d) => d.ejercicios)
      .flatMap((d) => d.ejercicios)
      .find((e) => e.id === id);
    lineas.push(`${id}  ${ej ? ej.nombre : "(ya no está en la rutina)"}`);
    Object.entries(cambios).forEach(([k, v]) => {
      lineas.push(`  "${k}": ${typeof v === "string" ? `"${v}"` : v},   // antes: ${JSON.stringify(ej?.[k])}`);
    });
  });
  return lineas.join("\n");
}
