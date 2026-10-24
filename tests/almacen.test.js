import { describe, it, expect } from "vitest";
import {
  migrar, vacio, ESQUEMA_ACTUAL, claveSesion, partirClave,
  sesionesDe, sesionesConEjercicio, exportarJSON, importarJSON, exportarCSV
} from "../src/logica/almacen.js";

const S = (p, r, ok = true) => ({ p, r, ok });

describe("migraciones de esquema", () => {
  it("un almacén vacío queda en la versión actual", () => {
    expect(vacio().esquema).toBe(ESQUEMA_ACTUAL);
    expect(migrar(null).esquema).toBe(ESQUEMA_ACTUAL);
    expect(migrar(undefined).sesiones).toEqual({});
  });

  it("migra el formato v1 sin perder sesiones con contenido", () => {
    const v1 = {
      semana: 3,
      unidad: "lb",
      sesiones: {
        "push|2026-10-01": { fecha: "2026-10-01", ej: { pu1: [S(60, 8)] } }
      }
    };
    const v2 = migrar(v1);
    expect(v2.esquema).toBe(ESQUEMA_ACTUAL);
    expect(v2.semana).toBe(3);
    expect(v2.unidad).toBe("lb");
    expect(v2.sesiones["push|2026-10-01|1"].ej.pu1[0].p).toBe(60);
  });

  it("descarta las sesiones vacías que creaba la v1 al abrir pestañas", () => {
    const v1 = {
      sesiones: {
        "pull|2026-10-02": { fecha: "2026-10-02", ej: {} },
        "legs|2026-10-03": { fecha: "2026-10-03", ej: { lg1: [S("", "", false)] } },
        "push|2026-10-04": { fecha: "2026-10-04", ej: { pu1: [S(60, 8)] } }
      }
    };
    expect(Object.keys(migrar(v1).sesiones)).toEqual(["push|2026-10-04|1"]);
  });

  it("migra v2 a v3 dándole a cada sesión su mapa de sustituciones", () => {
    const v2 = {
      esquema: 2,
      sesiones: { "push|2026-10-01|1": { fecha: "2026-10-01", ej: { pu1: [S(60, 8)] } } }
    };
    const v3 = migrar(v2);
    expect(v3.esquema).toBe(ESQUEMA_ACTUAL);
    expect(v3.sesiones["push|2026-10-01|1"].sust).toEqual({});
    expect(v3.sesiones["push|2026-10-01|1"].ej.pu1[0].p).toBe(60);
  });

  it("una sustitución ya guardada sobrevive la migración", () => {
    const v3 = migrar({
      esquema: 2,
      sesiones: {
        "pull|2026-10-02|1": { fecha: "2026-10-02", sust: { pl2: "abc" }, ej: { abc: [S(50, 10)] } }
      }
    });
    expect(v3.sesiones["pull|2026-10-02|1"].sust).toEqual({ pl2: "abc" });
  });

  it("una base v1 llega hasta v3 en un solo paso", () => {
    const v3 = migrar({
      sesiones: { "push|2026-10-01": { fecha: "2026-10-01", ej: { pu1: [S(60, 8)] } } }
    });
    expect(v3.esquema).toBe(ESQUEMA_ACTUAL);
    expect(v3.sesiones["push|2026-10-01|1"].sust).toEqual({});
  });

  it("migrar dos veces no cambia nada", () => {
    const una = migrar({ sesiones: { "push|2026-10-01": { fecha: "2026-10-01", ej: { a: [S(1, 1)] } } } });
    expect(migrar(una)).toEqual(una);
  });

  it("rellena los campos que falten sin pisar los que vienen", () => {
    const d = migrar({ esquema: 2, sesiones: {}, semana: 7 });
    expect(d.semana).toBe(7);
    expect(d.unidad).toBe("kg");
  });
});

describe("claves de sesión", () => {
  it("este es el bug de la v1: dos sesiones el mismo día ya no se pisan", () => {
    const a = claveSesion("push", "2026-10-12", 1);
    const b = claveSesion("push", "2026-10-12", 2);
    expect(a).not.toBe(b);
    expect(partirClave(b)).toEqual({ dia: "push", fecha: "2026-10-12", n: 2 });
  });

  it("lee claves sin consecutivo asumiendo la primera", () => {
    expect(partirClave("push|2026-10-12").n).toBe(1);
  });
});

describe("consulta de sesiones", () => {
  const datos = migrar({
    esquema: 2,
    sesiones: {
      "push|2026-10-08|1": { fecha: "2026-10-08", ej: { pu1: [S(60, 8)] } },
      "push|2026-10-01|1": { fecha: "2026-10-01", ej: { pu1: [S(55, 8)] } },
      "pull|2026-10-02|1": { fecha: "2026-10-02", ej: { pl1: [S(50, 10)] } },
      "push|2026-10-09|1": { fecha: "2026-10-09", ej: { pu1: [S("", "", false)] } }
    }
  });

  it("filtra por día y ordena por fecha", () => {
    const s = sesionesDe(datos, "push");
    expect(s.map((x) => x.fecha)).toEqual(["2026-10-01", "2026-10-08"]);
  });

  it("omite sesiones sin series completadas", () => {
    expect(sesionesDe(datos, "push").find((s) => s.fecha === "2026-10-09")).toBeUndefined();
  });
});

describe("respaldo", () => {
  const base = migrar({
    esquema: 2,
    semana: 2,
    sesiones: { "push|2026-10-01|1": { fecha: "2026-10-01", ej: { pu1: [S(60, 8)] } } }
  });

  it("exportar e importar devuelve lo mismo", () => {
    const { datos } = importarJSON(exportarJSON(base), vacio());
    expect(datos.sesiones["push|2026-10-01|1"].ej.pu1[0].p).toBe(60);
  });

  it("fusiona sin borrar lo que ya estaba", () => {
    const otro = migrar({
      esquema: 2,
      sesiones: { "pull|2026-10-02|1": { fecha: "2026-10-02", ej: { pl1: [S(50, 10)] } } }
    });
    const { datos, agregadas } = importarJSON(exportarJSON(otro), base);
    expect(agregadas).toBe(1);
    expect(Object.keys(datos.sesiones).sort()).toEqual(["pull|2026-10-02|1", "push|2026-10-01|1"]);
  });

  it("ante conflicto se queda con la sesión más completa", () => {
    const masCompleta = migrar({
      esquema: 2,
      sesiones: {
        "push|2026-10-01|1": { fecha: "2026-10-01", ej: { pu1: [S(60, 8), S(60, 8)] } }
      }
    });
    const { datos, actualizadas } = importarJSON(exportarJSON(masCompleta), base);
    expect(actualizadas).toBe(1);
    expect(datos.sesiones["push|2026-10-01|1"].ej.pu1).toHaveLength(2);
  });

  it("no pisa una sesión buena con una más pobre", () => {
    const pobre = migrar({
      esquema: 2,
      sesiones: { "push|2026-10-01|1": { fecha: "2026-10-01", ej: { pu1: [S(60, 8, false)] } } }
    });
    const { datos, actualizadas } = importarJSON(exportarJSON(pobre), base);
    expect(actualizadas).toBe(0);
    expect(datos.sesiones["push|2026-10-01|1"].ej.pu1[0].ok).toBe(true);
  });

  it("un archivo que no es JSON truena de forma controlada", () => {
    expect(() => importarJSON("esto no es json", base)).toThrow();
  });
});

describe("CSV", () => {
  it("incluye las dos unidades", () => {
    const rutina = { dias: [{ id: "push", ejercicios: [{ id: "pu1", nombre: "Press banca" }] }] };
    const datos = migrar({
      esquema: 2,
      sesiones: { "push|2026-10-01|1": { fecha: "2026-10-01", ej: { pu1: [S(60, 8)] } } }
    });
    const csv = exportarCSV(datos, rutina, (kg) => Math.round(kg * 2.20462 * 2) / 2);
    const lineas = csv.split("\n");
    expect(lineas[0]).toBe("fecha,dia,ejercicio,serie,peso_kg,peso_lb,reps,hecha");
    expect(lineas[1]).toBe("2026-10-01,push,Press banca,1,60,132.5,8,si");
  });
});

describe("migración v4 a v5: carreras y ajustes", () => {
  it("agrega el registro de carreras vacío y los ajustes por defecto", () => {
    const v5 = migrar({ esquema: 4, sesiones: {} });
    expect(v5.esquema).toBe(ESQUEMA_ACTUAL);
    expect(v5.carreras).toEqual([]);
    expect(v5.ajustes.edad).toBe(44);
    expect(v5.ajustes.fcReposo).toBe(65);
  });

  it("respeta unos ajustes ya guardados y completa los que falten", () => {
    const v5 = migrar({ esquema: 4, sesiones: {}, ajustes: { fcReposo: 58 } });
    expect(v5.ajustes.fcReposo).toBe(58);
    expect(v5.ajustes.edad).toBe(44);
  });

  it("una base v1 llega hasta v5 de un golpe sin perder las series", () => {
    const v5 = migrar({
      sesiones: { "push|2026-10-01": { fecha: "2026-10-01", ej: { pu1: [S(60, 8)] } } }
    });
    expect(v5.esquema).toBe(ESQUEMA_ACTUAL);
    expect(v5.sesiones["push|2026-10-01|1"].ej.pu1[0].p).toBe(60);
    expect(v5.sesiones["push|2026-10-01|1"].sust).toEqual({});
    expect(v5.sesiones["push|2026-10-01|1"].notas.sueno).toBeNull();
    expect(v5.carreras).toEqual([]);
  });

  it("el respaldo se lleva las carreras y las fusiona por id sin duplicar", () => {
    const base = migrar({
      esquema: 5,
      sesiones: {},
      carreras: [{ id: "c1", fecha: "2026-10-10", km: 6, segundos: 2400 }]
    });
    const otro = migrar({
      esquema: 5,
      sesiones: {},
      carreras: [
        { id: "c1", fecha: "2026-10-10", km: 6, segundos: 2400 },
        { id: "c2", fecha: "2026-10-12", km: 8, segundos: 3200 }
      ]
    });
    const { datos, agregadas } = importarJSON(exportarJSON(otro), base);
    expect(datos.carreras).toHaveLength(2);
    expect(agregadas).toBe(1);
  });

  it("el respaldo trae los ajustes del corredor", () => {
    const otro = migrar({ esquema: 5, sesiones: {}, ajustes: { fcReposo: 55, edad: 45 } });
    const { datos } = importarJSON(exportarJSON(otro), migrar({ esquema: 5, sesiones: {} }));
    expect(datos.ajustes.fcReposo).toBe(55);
  });
});

describe("migración v6 a v7: plan de carrera", () => {
  it("agrega el plan vacío", () => {
    const v7 = migrar({ esquema: 6, sesiones: {} });
    expect(v7.esquema).toBe(ESQUEMA_ACTUAL);
    expect(v7.plan).toBeNull();
  });

  it("una base v1 llega hasta v7 conservando todo lo del camino", () => {
    const v7 = migrar({
      sesiones: { "push|2026-10-01": { fecha: "2026-10-01", ej: { pu1: [S(60, 8)] } } }
    });
    expect(v7.esquema).toBe(ESQUEMA_ACTUAL);
    expect(v7.sesiones["push|2026-10-01|1"].ej.pu1[0].p).toBe(60);
    expect(v7.sesiones["push|2026-10-01|1"].sust).toEqual({});
    expect(v7.sesiones["push|2026-10-01|1"].notas.sueno).toBeNull();
    expect(v7.carreras).toEqual([]);
    expect(v7.ajustesRutina).toEqual({});
    expect(v7.plan).toBeNull();
  });

  it("el respaldo trae un plan cuando aquí no hay ninguno", () => {
    const otro = migrar({ esquema: 7, sesiones: {}, plan: { objetivo: "10k", semanas: 10 } });
    const { datos } = importarJSON(exportarJSON(otro), migrar({ esquema: 7, sesiones: {} }));
    expect(datos.plan.objetivo).toBe("10k");
  });

  it("pero NO pisa un plan en curso: se perdería dónde va Tadeo", () => {
    const enCurso = migrar({ esquema: 7, sesiones: {}, plan: { objetivo: "21k", semanas: 12 } });
    const otro = migrar({ esquema: 7, sesiones: {}, plan: { objetivo: "5k", semanas: 8 } });
    const { datos } = importarJSON(exportarJSON(otro), enCurso);
    expect(datos.plan.objetivo).toBe("21k");
  });
});

describe("historial por ejercicio, no por día", () => {
  const datos = migrar({
    esquema: ESQUEMA_ACTUAL,
    sesiones: {
      "push|2026-10-01|1": { fecha: "2026-10-01", ej: { pu1: [S(60, 8)] } },
      "torsoA|2026-10-20|1": { fecha: "2026-10-20", ej: { pu1: [S(65, 8)] } },
      "pull|2026-10-02|1": { fecha: "2026-10-02", ej: { pl2: [S(50, 10)] } }
    }
  });

  it("reúne un ejercicio aunque se haya hecho en días distintos", () => {
    // Este es el punto de rearmar la rutina: el press de banca puede pasar de
    // Push a Torso A, y su historial tiene que seguirlo.
    const h = sesionesConEjercicio(datos, "pu1");
    expect(h).toHaveLength(2);
    expect(h.map((s) => s.fecha)).toEqual(["2026-10-01", "2026-10-20"]);
  });

  it("no mezcla ejercicios distintos", () => {
    expect(sesionesConEjercicio(datos, "pl2")).toHaveLength(1);
  });

  it("ignora las series no completadas", () => {
    const sinMarcar = migrar({
      esquema: ESQUEMA_ACTUAL,
      sesiones: { "a|2026-10-01|1": { fecha: "2026-10-01", ej: { x: [S(60, 8, false)] } } }
    });
    expect(sesionesConEjercicio(sinMarcar, "x")).toHaveLength(0);
  });

  it("un ejercicio que nunca se hizo devuelve lista vacía", () => {
    expect(sesionesConEjercicio(datos, "zzz")).toEqual([]);
    expect(sesionesConEjercicio({}, "pu1")).toEqual([]);
  });
});
