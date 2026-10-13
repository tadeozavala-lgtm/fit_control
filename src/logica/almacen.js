/**
 * Persistencia con versión de esquema y migraciones.
 *
 * El bug que esto resuelve: la v1 guardaba sin número de versión, así que
 * cualquier cambio de estructura rompía el historial sin forma de recuperarlo.
 * A partir de aquí cada cambio de forma sube ESQUEMA_ACTUAL y agrega su
 * migración; `migrar()` lleva cualquier respaldo viejo hasta la versión de hoy.
 */

export const CLAVE = "protocolo4d5:v1";
export const ESQUEMA_ACTUAL = 2;

export function vacio() {
  return { esquema: ESQUEMA_ACTUAL, sesiones: {}, semana: 1, unidad: "kg" };
}

/**
 * v1 -> v2
 *  - agrega `esquema`
 *  - la clave de sesión pasa de "dia|fecha" a "dia|fecha|n", para poder
 *    entrenar el mismo día dos veces sin sobrescribir
 *  - descarta las sesiones vacías que la v1 creaba al abrir cada pestaña
 */
function v1_a_v2(datos) {
  const sesiones = {};
  Object.entries(datos.sesiones || {}).forEach(([clave, sesion]) => {
    const tieneAlgo = Object.values(sesion.ej || {}).some((arr) =>
      (arr || []).some((s) => s && (s.ok || s.p || s.r))
    );
    if (!tieneAlgo) return;
    const partes = clave.split("|");
    sesiones[`${partes[0]}|${partes[1]}|1`] = sesion;
  });
  return { ...datos, esquema: 2, sesiones };
}

const MIGRACIONES = { 1: v1_a_v2 };

/** Lleva cualquier versión guardada hasta ESQUEMA_ACTUAL. Nunca pierde datos. */
export function migrar(crudo) {
  let datos = crudo && typeof crudo === "object" ? { ...crudo } : vacio();
  if (!datos.sesiones) datos.sesiones = {};
  if (!datos.semana) datos.semana = 1;
  if (!datos.unidad) datos.unidad = "kg";
  let v = Number(datos.esquema) || 1;
  while (v < ESQUEMA_ACTUAL && MIGRACIONES[v]) {
    datos = MIGRACIONES[v](datos);
    v = Number(datos.esquema);
  }
  datos.esquema = ESQUEMA_ACTUAL;
  return datos;
}

/** Clave de sesión. `n` permite repetir el mismo día de rutina en una fecha. */
export function claveSesion(dia, fecha, n = 1) {
  return `${dia}|${fecha}|${n}`;
}

export function partirClave(clave) {
  const [dia, fecha, n] = String(clave).split("|");
  return { dia, fecha, n: Number(n) || 1 };
}

/** Las sesiones de un día de rutina, con contenido real, ordenadas por fecha. */
export function sesionesDe(datos, dia) {
  return Object.entries(datos.sesiones || {})
    .filter(([clave]) => partirClave(clave).dia === dia)
    .map(([clave, s]) => ({ clave, ...s }))
    .filter((s) => Object.values(s.ej || {}).some((a) => (a || []).some((x) => x && x.ok)))
    .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
}

/**
 * Capa de almacenamiento en cascada: window.storage (dentro de Claude) ->
 * localStorage (app instalada) -> memoria (modo degradado, no truena nada).
 */
export function crearAlmacen(ventana = globalThis) {
  let cache = null;

  async function leer() {
    if (cache) return cache;
    let crudo = null;
    try {
      const r = await ventana.storage.get(CLAVE);
      if (r && r.value) crudo = r.value;
    } catch (e) {
      /* sin window.storage: seguimos */
    }
    if (crudo === null) {
      try {
        crudo = ventana.localStorage.getItem(CLAVE);
      } catch (e) {
        /* Safari privado o storage bloqueado */
      }
    }
    let objeto = null;
    try {
      objeto = crudo ? JSON.parse(crudo) : null;
    } catch (e) {
      objeto = null;
    }
    cache = migrar(objeto);
    return cache;
  }

  async function escribir() {
    const txt = JSON.stringify(cache);
    let ok = false;
    try {
      ventana.localStorage.setItem(CLAVE, txt);
      ok = true;
    } catch (e) {
      /* ignorar */
    }
    try {
      await ventana.storage.set(CLAVE, txt);
      ok = true;
    } catch (e) {
      /* ignorar */
    }
    return ok;
  }

  function reemplazar(datos) {
    cache = migrar(datos);
    return cache;
  }

  return { leer, escribir, reemplazar, get datos() { return cache; } };
}

/* ---------- respaldo ---------- */

export function exportarJSON(datos) {
  return JSON.stringify(
    { ...datos, exportado: new Date().toISOString(), app: "protocolo-4d5" },
    null,
    2
  );
}

/**
 * Importa un respaldo. Fusiona por clave de sesión: lo que ya existe se
 * conserva salvo que el respaldo traiga más series completadas.
 * @returns {{datos:object, agregadas:number, actualizadas:number}}
 */
export function importarJSON(texto, actuales) {
  const entrante = migrar(JSON.parse(texto));
  const datos = migrar({ ...actuales });
  let agregadas = 0;
  let actualizadas = 0;

  Object.entries(entrante.sesiones).forEach(([clave, sesion]) => {
    const previa = datos.sesiones[clave];
    if (!previa) {
      datos.sesiones[clave] = sesion;
      agregadas++;
      return;
    }
    const cuenta = (s) =>
      Object.values(s.ej || {}).reduce(
        (a, arr) => a + (arr || []).filter((x) => x && x.ok).length,
        0
      );
    if (cuenta(sesion) > cuenta(previa)) {
      datos.sesiones[clave] = sesion;
      actualizadas++;
    }
  });

  if (entrante.unidad) datos.unidad = entrante.unidad;
  if (entrante.semana > datos.semana) datos.semana = entrante.semana;
  return { datos, agregadas, actualizadas };
}

export function exportarCSV(datos, rutina, kgALb) {
  const filas = [
    ["fecha", "dia", "ejercicio", "serie", "peso_kg", "peso_lb", "reps", "hecha"]
  ];
  Object.entries(datos.sesiones || {})
    .sort((a, b) => String(a[1].fecha).localeCompare(String(b[1].fecha)))
    .forEach(([clave, s]) => {
      const { dia } = partirClave(clave);
      const defDia = rutina.dias.find((d) => d.id === dia);
      Object.entries(s.ej || {}).forEach(([exId, arr]) => {
        const ex = defDia && defDia.ejercicios ? defDia.ejercicios.find((x) => x.id === exId) : null;
        (arr || []).forEach((x, i) => {
          if (!x || (!x.p && !x.r)) return;
          filas.push([
            s.fecha,
            dia,
            ex ? ex.nombre : exId,
            i + 1,
            x.p || "",
            x.p ? kgALb(Number(x.p)) : "",
            x.r || "",
            x.ok ? "si" : "no"
          ]);
        });
      });
    });
  return filas.map((f) => f.join(",")).join("\n");
}
