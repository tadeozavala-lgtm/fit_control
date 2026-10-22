/**
 * Persistencia con versión de esquema y migraciones.
 *
 * El bug que esto resuelve: la v1 guardaba sin número de versión, así que
 * cualquier cambio de estructura rompía el historial sin forma de recuperarlo.
 * A partir de aquí cada cambio de forma sube ESQUEMA_ACTUAL y agrega su
 * migración; `migrar()` lleva cualquier respaldo viejo hasta la versión de hoy.
 */

export const CLAVE = "protocolo4d5:v1";
export const ESQUEMA_ACTUAL = 8;

/**
 * Ajustes del corredor. La edad y la FC en reposo deciden las zonas; sin ellas
 * habría que mostrar un rango genérico de libro, que es lo que esto reemplaza.
 */
export function AJUSTES_POR_DEFECTO() {
  return { edad: 44, fcReposo: 65, fcMax: null, marca: null, diasLiberados: [] };
}

export function vacio() {
  return {
    esquema: ESQUEMA_ACTUAL,
    sesiones: {},
    carreras: [],
    ajustes: AJUSTES_POR_DEFECTO(),
    ajustesRutina: {},
    plan: null,
    semana: 1,
    unidad: "kg"
  };
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

/**
 * v2 -> v3
 *  - cada sesión gana `sust`: qué ejercicio del catálogo ocupó el hueco de la
 *    rutina ese día. Las sesiones viejas no tienen sustituciones, así que
 *    simplemente arrancan con el mapa vacío.
 */
function v2_a_v3(datos) {
  const sesiones = {};
  Object.entries(datos.sesiones || {}).forEach(([clave, sesion]) => {
    sesiones[clave] = { ...sesion, sust: sesion.sust || {} };
  });
  return { ...datos, esquema: 3, sesiones };
}

/**
 * v3 -> v4
 *  - cada sesión gana `notas`: sueño, energía, molestias y texto libre.
 *    Las sesiones viejas quedan con las tres señales en null, que es distinto
 *    de "contestó 0": nunca se preguntó.
 */
function v3_a_v4(datos) {
  const sesiones = {};
  Object.entries(datos.sesiones || {}).forEach(([clave, sesion]) => {
    sesiones[clave] = {
      ...sesion,
      notas: sesion.notas || { sueno: null, energia: null, molestia: null, texto: "" }
    };
  });
  return { ...datos, esquema: 4, sesiones };
}

/**
 * v4 -> v5
 *  - `carreras`: registro de rodajes, aparte de las sesiones de fuerza porque
 *    no tienen series ni ejercicios, solo distancia y tiempo.
 *  - `ajustes`: edad y FC en reposo, de donde salen las zonas de Karvonen.
 */
function v4_a_v5(datos) {
  return {
    ...datos,
    esquema: 5,
    carreras: datos.carreras || [],
    ajustes: { ...AJUSTES_POR_DEFECTO(), ...(datos.ajustes || {}) }
  };
}

/**
 * v5 -> v6
 *  - `ajustesRutina`: capa de cambios encima de rutina.json, hecha desde el
 *    teléfono. Es una capa y no una copia a propósito: así un despliegue nuevo
 *    de la rutina se hereda, conservando solo lo que Tadeo cambió.
 */
function v5_a_v6(datos) {
  return { ...datos, esquema: 6, ajustesRutina: datos.ajustesRutina || {} };
}

/**
 * v6 -> v7
 *  - `plan`: el plan de carrera generado, o null si no hay ninguno activo.
 *    Se guarda ya desarrollado en semanas y no solo su configuración, para que
 *    regenerar no cambie bajo los pies un plan que Tadeo ya empezó a seguir.
 */
function v6_a_v7(datos) {
  return { ...datos, esquema: 7, plan: datos.plan || null };
}

/**
 * v7 -> v8
 *  - `ajustes.diasLiberados`: días de fuerza que Tadeo soltó para poder correr.
 *    No se borran de la rutina: siguen ahí y cuentan si los entrena igual, solo
 *    dejan de bloquear ese día para el plan de carrera.
 */
function v7_a_v8(datos) {
  return {
    ...datos,
    esquema: 8,
    ajustes: { ...datos.ajustes, diasLiberados: datos.ajustes?.diasLiberados || [] }
  };
}

const MIGRACIONES = {
  1: v1_a_v2, 2: v2_a_v3, 3: v3_a_v4, 4: v4_a_v5,
  5: v5_a_v6, 6: v6_a_v7, 7: v7_a_v8
};

/** Lleva cualquier versión guardada hasta ESQUEMA_ACTUAL. Nunca pierde datos. */
export function migrar(crudo) {
  let datos = crudo && typeof crudo === "object" ? { ...crudo } : vacio();
  if (!datos.sesiones) datos.sesiones = {};
  if (!datos.semana) datos.semana = 1;
  if (!datos.unidad) datos.unidad = "kg";
  if (!Array.isArray(datos.carreras)) datos.carreras = [];
  datos.ajustes = { ...AJUSTES_POR_DEFECTO(), ...(datos.ajustes || {}) };
  if (!Array.isArray(datos.ajustes.diasLiberados)) datos.ajustes.diasLiberados = [];
  if (!datos.ajustesRutina) datos.ajustesRutina = {};
  if (datos.plan === undefined) datos.plan = null;
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
  if (entrante.ajustes) datos.ajustes = { ...datos.ajustes, ...entrante.ajustes };
  if (entrante.ajustesRutina) {
    datos.ajustesRutina = { ...datos.ajustesRutina, ...entrante.ajustesRutina };
  }
  // Un plan solo entra si el respaldo trae uno y aquí no hay ninguno activo:
  // pisar un plan en curso con otro del respaldo perdería dónde va Tadeo.
  if (entrante.plan && !datos.plan) datos.plan = entrante.plan;

  // Las carreras se fusionan por id, igual que las sesiones por clave.
  const vistas = new Set((datos.carreras || []).map((c) => c.id));
  (entrante.carreras || []).forEach((c) => {
    if (!vistas.has(c.id)) {
      datos.carreras.push(c);
      vistas.add(c.id);
      agregadas++;
    }
  });
  datos.carreras.sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));

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
