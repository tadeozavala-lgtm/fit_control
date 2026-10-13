/**
 * Conversión de unidades.
 *
 * Regla invariable de todo el proyecto: el peso SIEMPRE se guarda en kilogramos.
 * La unidad elegida por el usuario solo afecta lo que se muestra y lo que escribe.
 * Así puede alternar kg/lb sin que el historial se desordene.
 */

export const FACTOR = 2.20462;

/** Incremento mínimo realista según los discos que hay en un gimnasio. */
export const SALTO = { kg: 2.5, lb: 5 };

/** @param {number} kg @returns {number} libras, al 0.5 más cercano */
export function kgALb(kg) {
  return Math.round(kg * FACTOR * 2) / 2;
}

/** @param {number} lb @returns {number} kilos, con 2 decimales */
export function lbAKg(lb) {
  return Math.round((lb / FACTOR) * 100) / 100;
}

/**
 * Kilos guardados -> número en la unidad activa, listo para pintar en un input.
 * @param {number|string|null} kg
 * @param {"kg"|"lb"} unidad
 */
export function mostrar(kg, unidad) {
  if (kg === "" || kg == null) return "";
  const n = Number(kg);
  if (!Number.isFinite(n)) return "";
  return unidad === "lb" ? kgALb(n) : Math.round(n * 100) / 100;
}

/**
 * Lo que escribió el usuario -> kilos para guardar.
 * @param {number|string|null} valor
 * @param {"kg"|"lb"} unidad
 */
export function aKg(valor, unidad) {
  if (valor === "" || valor == null) return "";
  const n = Number(valor);
  if (!Number.isFinite(n)) return "";
  return unidad === "lb" ? lbAKg(n) : n;
}

/** Texto corto con unidad: "60 kg" / "132.5 lb". */
export function conUnidad(kg, unidad, decimales) {
  if (kg === "" || kg == null) return "—";
  const v = mostrar(kg, unidad);
  return (decimales === 0 ? Math.round(Number(v)) : v) + " " + unidad;
}

/** Etiqueta chica dentro del campo: muestra SIEMPRE la unidad contraria. */
export function etiquetaEquiv(kg, unidad) {
  if (kg === "" || kg == null) return unidad;
  const n = Number(kg);
  return unidad === "lb"
    ? "= " + Math.round(n * 10) / 10 + " kg"
    : "= " + kgALb(n) + " lb";
}

/**
 * Lee el rango numérico de un texto como "55–60 kg c/u" o "24–32 kg kettlebell".
 * @returns {[number, number]|null}
 */
export function rangoSugerido(texto) {
  const m = String(texto).match(/([\d.]+)\s*(?:[–-]\s*([\d.]+))?\s*kg/);
  if (!m) return null;
  const a = parseFloat(m[1]);
  return [a, m[2] ? parseFloat(m[2]) : a];
}

/** Sugerido en las dos unidades, con la activa primero. */
export function textoSugerido(texto, unidad) {
  const r = rangoSugerido(texto);
  if (!r) return texto;
  const [a, b] = r;
  const kg = a === b ? `${a} kg` : `${a}–${b} kg`;
  const lb = a === b ? `${kgALb(a)} lb` : `${kgALb(a)}–${kgALb(b)} lb`;
  const extra = String(texto)
    .replace(/[\d.]+\s*(?:[–-]\s*[\d.]+)?\s*kg/, "")
    .trim();
  const par = unidad === "lb" ? `${lb} · ${kg}` : `${kg} · ${lb}`;
  return extra ? `${par} ${extra}` : par;
}
