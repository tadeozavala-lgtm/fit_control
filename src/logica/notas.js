/**
 * Notas de sesión: sueño, energía y molestias.
 *
 * Por qué existen: con 4 días de fuerza, 5 de cardio y déficit calórico, el
 * estancamiento se anuncia antes en estas tres señales que en los pesos. Cuando
 * los kilos empiezan a bajar ya llevas dos o tres semanas acumulando fatiga.
 *
 * La escala es de 1 a 5 a propósito: más granularidad no se contesta honestamente
 * de pie en el gimnasio, y menos no distingue nada.
 */

export const ESCALAS = {
  sueno: {
    etiqueta: "Sueño",
    pregunta: "¿Cómo dormiste anoche?",
    niveles: ["Pésimo", "Malo", "Normal", "Bien", "Excelente"]
  },
  energia: {
    etiqueta: "Energía",
    pregunta: "¿Con qué energía llegaste?",
    niveles: ["En el piso", "Baja", "Normal", "Buena", "De sobra"]
  },
  molestia: {
    etiqueta: "Molestias",
    pregunta: "¿Alguna molestia articular?",
    niveles: ["Ninguna", "Leve", "Notoria", "Limita el movimiento", "Tuve que parar"]
  }
};

export const CLAVES = Object.keys(ESCALAS);

/**
 * Ojo con el signo: en sueño y energía más es mejor, en molestias más es PEOR.
 * Cualquier cosa que promedie o compare tiene que respetarlo.
 */
export const MAYOR_ES_MEJOR = { sueno: true, energia: true, molestia: false };

export function vacia() {
  return { sueno: null, energia: null, molestia: null, texto: "" };
}

export function tieneAlgo(notas) {
  if (!notas) return false;
  return CLAVES.some((k) => notas[k] != null) || Boolean(notas.texto?.trim());
}

/** Escribe un valor en las notas de una sesión; `null` lo borra. */
export function anotar(sesion, clave, valor) {
  if (!sesion.notas) sesion.notas = vacia();
  if (clave === "texto") {
    sesion.notas.texto = String(valor || "");
  } else if (CLAVES.includes(clave)) {
    sesion.notas[clave] = valor == null ? null : Math.min(5, Math.max(1, Number(valor)));
  }
  return sesion;
}

/**
 * Promedio de una señal en las sesiones dadas.
 * @returns {number|null} null si nadie la contestó
 */
export function promedio(sesiones, clave) {
  const valores = (sesiones || [])
    .map((s) => s.notas && s.notas[clave])
    .filter((v) => v != null);
  if (!valores.length) return null;
  return Math.round((valores.reduce((a, b) => a + b, 0) / valores.length) * 10) / 10;
}

/**
 * Alerta de fatiga acumulada.
 *
 * El umbral no es arbitrario: dos sesiones seguidas con sueño o energía en 2 o
 * menos, o cualquier molestia en 3 o más, es el patrón que precede al
 * estancamiento. Con una sola sesión mala no se dice nada: todos tenemos días.
 *
 * @returns {{nivel:"ninguna"|"atencion"|"alta", motivos:string[]}}
 */
export function alerta(sesiones) {
  const recientes = (sesiones || [])
    .filter((s) => tieneAlgo(s.notas))
    .slice(-3);
  if (recientes.length < 2) return { nivel: "ninguna", motivos: [] };

  const motivos = [];
  const ultimas2 = recientes.slice(-2);

  const bajo = (clave) => ultimas2.every((s) => s.notas[clave] != null && s.notas[clave] <= 2);
  if (bajo("sueno")) motivos.push("Dos sesiones seguidas durmiendo mal");
  if (bajo("energia")) motivos.push("Dos sesiones seguidas con energía baja");

  const molestiaAlta = ultimas2.filter((s) => (s.notas.molestia || 0) >= 3).length;
  if (molestiaAlta >= 2) motivos.push("Molestias articulares repetidas");
  else if (recientes.some((s) => (s.notas.molestia || 0) >= 4)) {
    motivos.push("Una molestia que limitó el movimiento");
  }

  if (!motivos.length) return { nivel: "ninguna", motivos: [] };
  return { nivel: motivos.length >= 2 ? "alta" : "atencion", motivos };
}

/** Texto accionable para la alerta. Es lo único que se le pide decidir al usuario. */
export function consejo(nivel) {
  if (nivel === "alta") {
    return "Considera adelantar la semana de descarga o quitar un día de Zona 2 antes de tocar la fuerza: el músculo es lo que estás protegiendo.";
  }
  if (nivel === "atencion") {
    return "Vigila la próxima sesión. Si se repite, baja volumen antes de que se note en los pesos.";
  }
  return "";
}

/**
 * Todas las sesiones con notas contestadas, ordenadas por fecha.
 *
 * Lee `datos.sesiones` directamente y NO pasa por sesionesDe(), que exige al
 * menos una serie completada: una sesión donde solo contestaste cómo llegaste
 * —porque te sentías mal y entrenaste poco o nada— es justo la que más importa
 * para detectar fatiga, y se perdía del conteo.
 */
export function sesionesConNotas(datos) {
  return Object.values(datos.sesiones || {})
    .filter((s) => tieneAlgo(s.notas))
    .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
}

/**
 * Serie para graficar una señal en el tiempo.
 * @returns {Array<{fecha:string, valor:number}>}
 */
export function serie(sesiones, clave) {
  return (sesiones || [])
    .filter((s) => s.notas && s.notas[clave] != null)
    .map((s) => ({ fecha: s.fecha, valor: s.notas[clave] }))
    .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
}
