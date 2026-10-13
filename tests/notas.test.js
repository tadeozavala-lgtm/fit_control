import { describe, it, expect } from "vitest";
import {
  ESCALAS, CLAVES, MAYOR_ES_MEJOR, vacia, tieneAlgo, anotar,
  promedio, alerta, consejo, serie, sesionesConNotas
} from "../src/logica/notas.js";
import { migrar, ESQUEMA_ACTUAL } from "../src/logica/almacen.js";

const ses = (fecha, sueno, energia, molestia, texto = "") => ({
  fecha,
  notas: { sueno, energia, molestia, texto }
});

describe("estructura de las escalas", () => {
  it("las tres señales tienen 5 niveles y pregunta", () => {
    CLAVES.forEach((k) => {
      expect(ESCALAS[k].niveles).toHaveLength(5);
      expect(ESCALAS[k].pregunta).toBeTruthy();
      expect(ESCALAS[k].etiqueta).toBeTruthy();
    });
  });

  it("en molestias más es peor, y eso está declarado", () => {
    expect(MAYOR_ES_MEJOR.sueno).toBe(true);
    expect(MAYOR_ES_MEJOR.energia).toBe(true);
    expect(MAYOR_ES_MEJOR.molestia).toBe(false);
  });
});

describe("anotar", () => {
  it("guarda un valor y lo deja leer", () => {
    const s = anotar({}, "sueno", 4);
    expect(s.notas.sueno).toBe(4);
  });

  it("acota al rango 1 a 5", () => {
    expect(anotar({}, "energia", 9).notas.energia).toBe(5);
    expect(anotar({}, "energia", 0).notas.energia).toBe(1);
  });

  it("null borra la respuesta, que no es lo mismo que contestar 1", () => {
    const s = anotar({}, "molestia", 3);
    anotar(s, "molestia", null);
    expect(s.notas.molestia).toBeNull();
  });

  it("ignora claves que no existen", () => {
    const s = anotar({}, "peso", 80);
    expect(s.notas.peso).toBeUndefined();
  });

  it("el texto libre se guarda tal cual", () => {
    expect(anotar({}, "texto", "rodilla izquierda").notas.texto).toBe("rodilla izquierda");
  });

  it("tieneAlgo distingue vacío de contestado", () => {
    expect(tieneAlgo(vacia())).toBe(false);
    expect(tieneAlgo(null)).toBe(false);
    expect(tieneAlgo({ ...vacia(), sueno: 3 })).toBe(true);
    expect(tieneAlgo({ ...vacia(), texto: "hombro" })).toBe(true);
  });
});

describe("promedios", () => {
  const sesiones = [ses("2026-10-01", 4, 3, 1), ses("2026-10-03", 2, 5, null)];

  it("promedia solo lo contestado", () => {
    expect(promedio(sesiones, "sueno")).toBe(3);
    expect(promedio(sesiones, "energia")).toBe(4);
    expect(promedio(sesiones, "molestia")).toBe(1);
  });

  it("devuelve null si nadie contestó", () => {
    expect(promedio([ses("2026-10-01", null, null, null)], "sueno")).toBeNull();
    expect(promedio([], "sueno")).toBeNull();
  });
});

describe("alerta de fatiga", () => {
  it("una sola sesión mala no dispara nada: todos tenemos días", () => {
    const r = alerta([ses("2026-10-01", 4, 4, 1), ses("2026-10-03", 1, 1, 1)]);
    expect(r.nivel).toBe("ninguna");
  });

  it("dos seguidas durmiendo mal sí avisan", () => {
    const r = alerta([ses("2026-10-01", 4, 4, 1), ses("2026-10-03", 2, 4, 1), ses("2026-10-05", 1, 4, 1)]);
    expect(r.nivel).toBe("atencion");
    expect(r.motivos[0]).toMatch(/durmiendo mal/);
  });

  it("sueño y energía bajos a la vez es alerta alta", () => {
    const r = alerta([ses("2026-10-03", 2, 2, 1), ses("2026-10-05", 1, 1, 1)]);
    expect(r.nivel).toBe("alta");
    expect(r.motivos).toHaveLength(2);
  });

  it("una molestia que limitó el movimiento basta para avisar", () => {
    const r = alerta([ses("2026-10-03", 4, 4, 1), ses("2026-10-05", 4, 4, 4)]);
    expect(r.nivel).toBe("atencion");
    expect(r.motivos[0]).toMatch(/limitó/);
  });

  it("molestias repetidas pesan más que una aislada", () => {
    const r = alerta([ses("2026-10-03", 4, 4, 3), ses("2026-10-05", 4, 4, 3)]);
    expect(r.motivos[0]).toMatch(/repetidas/);
  });

  it("no alerta con menos de dos sesiones contestadas", () => {
    expect(alerta([ses("2026-10-05", 1, 1, 5)]).nivel).toBe("ninguna");
    expect(alerta([]).nivel).toBe("ninguna");
  });

  it("las sesiones sin notas no cuentan para la ventana", () => {
    const r = alerta([ses("2026-10-01", 1, 1, 1), { fecha: "2026-10-02" }, ses("2026-10-03", 1, 1, 1)]);
    expect(r.nivel).toBe("alta");
  });

  it("todo bien no dice nada", () => {
    expect(alerta([ses("2026-10-03", 5, 5, 1), ses("2026-10-05", 4, 4, 1)]).nivel).toBe("ninguna");
  });

  it("cada nivel tiene su consejo y el nivel sano no tiene ninguno", () => {
    expect(consejo("alta")).toMatch(/descarga|Zona 2/);
    expect(consejo("atencion")).toBeTruthy();
    expect(consejo("ninguna")).toBe("");
  });
});

describe("serie para graficar", () => {
  it("ordena por fecha y salta lo no contestado", () => {
    const s = serie([ses("2026-10-05", 3, 1, 1), ses("2026-10-01", 5, 1, 1), ses("2026-10-03", null, 1, 1)], "sueno");
    expect(s).toEqual([
      { fecha: "2026-10-01", valor: 5 },
      { fecha: "2026-10-05", valor: 3 }
    ]);
  });
});

describe("migración v3 a v4", () => {
  it("las sesiones viejas quedan con las señales en null, no en cero", () => {
    const v4 = migrar({
      esquema: 3,
      sesiones: { "push|2026-10-01|1": { fecha: "2026-10-01", ej: {}, sust: {} } }
    });
    expect(v4.esquema).toBe(ESQUEMA_ACTUAL);
    expect(v4.sesiones["push|2026-10-01|1"].notas).toEqual({
      sueno: null, energia: null, molestia: null, texto: ""
    });
  });

  it("unas notas ya guardadas sobreviven", () => {
    const v4 = migrar({
      esquema: 3,
      sesiones: {
        "push|2026-10-01|1": { fecha: "2026-10-01", ej: {}, notas: { sueno: 4, energia: 3, molestia: 1, texto: "ok" } }
      }
    });
    expect(v4.sesiones["push|2026-10-01|1"].notas.sueno).toBe(4);
  });

  it("una base v1 llega hasta v4 de un golpe", () => {
    const v4 = migrar({
      sesiones: { "push|2026-10-01": { fecha: "2026-10-01", ej: { pu1: [{ p: 60, r: 8, ok: true }] } } }
    });
    expect(v4.esquema).toBe(ESQUEMA_ACTUAL);
    expect(v4.sesiones["push|2026-10-01|1"].sust).toEqual({});
    expect(v4.sesiones["push|2026-10-01|1"].notas.sueno).toBeNull();
  });
});

describe("qué sesiones cuentan para la fatiga", () => {
  it("una sesión con notas pero sin series marcadas SÍ cuenta", () => {
    // Es justo la sesión más informativa: llegaste mal y entrenaste poco o nada.
    const datos = {
      sesiones: {
        "push|2026-10-12|1": { fecha: "2026-10-12", ej: {}, notas: { sueno: 1, energia: 1, molestia: 2, texto: "" } },
        "pull|2026-10-10|1": { fecha: "2026-10-10", ej: {}, notas: { sueno: 2, energia: 2, molestia: 1, texto: "" } }
      }
    };
    expect(sesionesConNotas(datos)).toHaveLength(2);
    expect(alerta(sesionesConNotas(datos)).nivel).toBe("alta");
  });

  it("devuelve las sesiones ordenadas por fecha", () => {
    const datos = {
      sesiones: {
        a: { fecha: "2026-10-12", notas: { sueno: 3, energia: null, molestia: null, texto: "" } },
        b: { fecha: "2026-10-01", notas: { sueno: 4, energia: null, molestia: null, texto: "" } }
      }
    };
    expect(sesionesConNotas(datos).map((s) => s.fecha)).toEqual(["2026-10-01", "2026-10-12"]);
  });

  it("salta las sesiones sin notas y aguanta un almacén vacío", () => {
    expect(sesionesConNotas({ sesiones: { x: { fecha: "2026-10-01", ej: {} } } })).toHaveLength(0);
    expect(sesionesConNotas({})).toHaveLength(0);
  });
});
