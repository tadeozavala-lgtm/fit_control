/**
 * Fórmulas de carrera: zonas de frecuencia cardiaca, ritmos y predicción.
 *
 * Todas son fórmulas públicas implementadas desde cero. No se copian las tablas
 * publicadas de ningún libro.
 *
 * Unidades internas: distancia en kilómetros, tiempo en SEGUNDOS, ritmo en
 * segundos por kilómetro. Igual que con el peso, se guarda una sola unidad y la
 * presentación convierte.
 */

/* ---------- frecuencia cardiaca ---------- */

/**
 * FC máxima estimada por la fórmula de Tanaka (208 − 0.7 × edad).
 *
 * Se prefiere sobre la clásica 220 − edad porque tiene menos dispersión entre
 * individuos y no subestima la máxima pasados los 40. A los 44 ambas dan casi
 * lo mismo (177 contra 176); la diferencia crece con la edad.
 *
 * Es una estimación poblacional con un error típico de ±10 ppm. Una prueba de
 * esfuerzo real siempre gana, y a 110 kg vale la pena hacerla.
 */
export function fcMaxEstimada(edad) {
  return Math.round(208 - 0.7 * Number(edad));
}

/**
 * Zonas por el método de Karvonen, que trabaja sobre la frecuencia cardiaca de
 * RESERVA (máxima menos reposo) en vez de sobre la máxima pelada.
 *
 * Importa: con la misma máxima, dos personas con reposo distinto entrenan a
 * pulsaciones distintas. Por eso un rango genérico de libro no sirve.
 */
export const ZONAS = [
  { n: 1, nombre: "Recuperación", min: 0.5, max: 0.6, para: "Caminata, calentamiento" },
  { n: 2, nombre: "Base aeróbica", min: 0.6, max: 0.7, para: "Tus 3 días de rodaje" },
  { n: 3, nombre: "Tempo", min: 0.7, max: 0.8, para: "Ritmo controlado, incómodo" },
  { n: 4, nombre: "Umbral", min: 0.8, max: 0.9, para: "Series largas" },
  { n: 5, nombre: "VO2 máx", min: 0.9, max: 1.0, para: "Intervalos del HIIT" }
];

/**
 * @param {number} fcMax
 * @param {number} fcReposo
 * @returns {Array<{n, nombre, para, desde, hasta}>} pulsaciones por zona
 */
export function zonasKarvonen(fcMax, fcReposo) {
  const reserva = Number(fcMax) - Number(fcReposo);
  if (!(reserva > 0)) return [];
  return ZONAS.map((z) => ({
    ...z,
    desde: Math.round(Number(fcReposo) + reserva * z.min),
    hasta: Math.round(Number(fcReposo) + reserva * z.max)
  }));
}

/** La zona a la que pertenece una pulsación dada. */
export function zonaDe(ppm, fcMax, fcReposo) {
  const zs = zonasKarvonen(fcMax, fcReposo);
  const z = zs.find((x) => ppm >= x.desde && ppm <= x.hasta);
  if (z) return z;
  if (zs.length && ppm < zs[0].desde) return null;
  return zs[zs.length - 1] || null;
}

/* ---------- ritmos ---------- */

/** Segundos por kilómetro. */
export function ritmo(km, segundos) {
  const d = Number(km);
  const t = Number(segundos);
  if (!(d > 0) || !(t > 0)) return 0;
  return t / d;
}

/** Segundos por km -> "5:45". */
export function formatoRitmo(segPorKm) {
  if (!(segPorKm > 0)) return "—";
  const m = Math.floor(segPorKm / 60);
  const s = Math.round(segPorKm % 60);
  // Redondear 59.6 segundos no debe producir "5:60".
  return s === 60 ? `${m + 1}:00` : `${m}:${String(s).padStart(2, "0")}`;
}

/** Segundos -> "48:20" o "1:12:05". */
export function formatoTiempo(segundos) {
  const t = Math.round(Number(segundos));
  if (!(t > 0)) return "—";
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  if (h) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** "48:20", "1:12:05" o "48" (minutos) -> segundos. */
export function leerTiempo(texto) {
  const partes = String(texto).trim().split(":").map(Number);
  if (partes.some((n) => !Number.isFinite(n) || n < 0)) return 0;
  if (partes.length === 3) return partes[0] * 3600 + partes[1] * 60 + partes[2];
  if (partes.length === 2) return partes[0] * 60 + partes[1];
  if (partes.length === 1) return partes[0] * 60;
  return 0;
}

/* ---------- predicción ---------- */

/**
 * Fórmula de Riegel: T2 = T1 × (D2 / D1)^1.06
 *
 * El exponente 1.06 es el que Pete Riegel derivó de resultados de carreras
 * reales. Predice bien entre distancias cercanas y se degrada en los extremos:
 * estimar un maratón desde un 5K es optimista, por eso `confiable()`.
 */
export const EXPONENTE_RIEGEL = 1.06;

export function predecir(kmConocida, segundosConocidos, kmObjetivo) {
  const d1 = Number(kmConocida);
  const t1 = Number(segundosConocidos);
  const d2 = Number(kmObjetivo);
  if (!(d1 > 0) || !(t1 > 0) || !(d2 > 0)) return 0;
  return t1 * Math.pow(d2 / d1, EXPONENTE_RIEGEL);
}

/** Riegel pierde fiabilidad cuando las distancias se separan más de 4 veces. */
export function confiable(kmConocida, kmObjetivo) {
  const razon = Math.max(kmObjetivo / kmConocida, kmConocida / kmObjetivo);
  return razon <= 4;
}

export const DISTANCIAS = [
  { km: 5, nombre: "5K" },
  { km: 10, nombre: "10K" },
  { km: 21.0975, nombre: "Media maratón" },
  { km: 42.195, nombre: "Maratón" }
];

export function tablaPredicciones(kmConocida, segundos) {
  return DISTANCIAS.map((d) => {
    const t = predecir(kmConocida, segundos, d.km);
    return {
      ...d,
      segundos: t,
      ritmo: ritmo(d.km, t),
      confiable: confiable(kmConocida, d.km)
    };
  });
}

/* ---------- VDOT ---------- */

/**
 * VDOT de Daniels-Gilbert: consumo de oxígeno estimado a partir de un resultado.
 *
 * Las dos ecuaciones son públicas; las tablas publicadas en el libro de Daniels
 * no se reproducen. El número en sí no dice nada útil, lo que sirve es derivar
 * de él los ritmos de entrenamiento.
 */
export function vdot(km, segundos) {
  const d = Number(km) * 1000;
  const minutos = Number(segundos) / 60;
  if (!(d > 0) || !(minutos > 0)) return 0;

  const velocidad = d / minutos; // metros por minuto
  const vo2 = -4.6 + 0.182258 * velocidad + 0.000104 * velocidad * velocidad;
  const porcentaje = 0.8 + 0.1894393 * Math.exp(-0.012778 * minutos) + 0.2989558 * Math.exp(-0.1932605 * minutos);
  return Math.round((vo2 / porcentaje) * 10) / 10;
}

/**
 * Ritmos de entrenamiento como fracción de la velocidad en el umbral.
 *
 * Los porcentajes son los que separan las intensidades clásicas; se aplican
 * sobre el ritmo del propio corredor, no sobre una tabla.
 */
export const RITMOS = [
  { id: "facil", nombre: "Fácil / Zona 2", factor: 1.28, para: "Tus 3 rodajes de la semana" },
  { id: "maraton", nombre: "Maratón", factor: 1.12, para: "Tirada larga a ritmo" },
  { id: "umbral", nombre: "Umbral", factor: 1.0, para: "20 min sostenidos" },
  { id: "intervalo", nombre: "Intervalos", factor: 0.92, para: "Series de 3 a 5 min" },
  { id: "repeticion", nombre: "Repeticiones", factor: 0.86, para: "Series cortas, 400 m" }
];

/**
 * Ritmos de entrenamiento derivados de un resultado conocido.
 * @returns {Array<{id, nombre, para, segPorKm}>}
 */
export function ritmoUmbral(km, segundos) {
  const d1 = Number(km);
  const t1 = Number(segundos);
  if (!(d1 > 0) || !(t1 > 0)) return 0;
  // El umbral es el ritmo que se sostiene una hora. Se despeja de Riegel la
  // distancia D que este corredor cubriría en 3600 s, y se divide.
  //   t1 × (D/d1)^1.06 = 3600  ->  D = d1 × (3600/t1)^(1/1.06)
  const distanciaUnaHora = d1 * Math.pow(3600 / t1, 1 / EXPONENTE_RIEGEL);
  return 3600 / distanciaUnaHora;
}

/**
 * Ritmos de entrenamiento derivados de un resultado conocido.
 * @returns {Array<{id, nombre, para, segPorKm}>}
 */
export function ritmosEntrenamiento(km, segundos) {
  const umbral = ritmoUmbral(km, segundos);
  if (!umbral) return [];
  return RITMOS.map((x) => ({ ...x, segPorKm: umbral * x.factor }));
}

/* ---------- registro de carreras ---------- */

export function nuevaCarrera(fecha, km, segundos, extra = {}) {
  return {
    id: `c${Date.now()}`,
    fecha,
    km: Number(km),
    segundos: Number(segundos),
    tipo: extra.tipo || "z2",
    esfuerzo: extra.esfuerzo ?? null,
    ppm: extra.ppm ?? null,
    nota: extra.nota || ""
  };
}

export const TIPOS = {
  z2: "Zona 2",
  tempo: "Tempo",
  series: "Series",
  hiit: "HIIT Box",
  caminata: "Caminata"
};

/** Carreras de una semana ISO, ordenadas por fecha. */
export function carrerasDeSemana(carreras, claveSemana, semanaISO) {
  return (carreras || [])
    .filter((c) => semanaISO(c.fecha) === claveSemana)
    .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
}

/** Kilómetros, tiempo y ritmo medio de un conjunto de carreras. */
export function resumenCarreras(carreras) {
  const lista = carreras || [];
  const km = lista.reduce((a, c) => a + (Number(c.km) || 0), 0);
  const segundos = lista.reduce((a, c) => a + (Number(c.segundos) || 0), 0);
  return {
    sesiones: lista.length,
    km: Math.round(km * 100) / 100,
    segundos,
    ritmoMedio: ritmo(km, segundos)
  };
}

/**
 * Aviso de progresión de volumen.
 *
 * La regla del 10% es el límite habitual para no acumular lesión por sobreuso.
 * Con 110 kg de peso corporal el impacto por zancada es mayor, así que subir
 * rápido sale caro.
 */
export function avisoVolumen(kmEstaSemana, kmSemanaPasada) {
  if (!(kmSemanaPasada > 0)) return null;
  const subida = ((kmEstaSemana - kmSemanaPasada) / kmSemanaPasada) * 100;
  if (subida <= 10) return null;
  return {
    subida: Math.round(subida),
    texto: `Subiste ${Math.round(subida)}% de volumen respecto a la semana pasada. Arriba del 10% es donde aparecen las lesiones por sobreuso.`
  };
}
