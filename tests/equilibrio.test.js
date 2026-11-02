import { describe, it, expect } from "vitest";
import rutinaReal from "../src/datos/rutina.json";
import catalogo from "../src/datos/catalogo.json";
import {
  desglose, porPatron, equilibrios, avisos, veredicto, PAREJAS, TOPE_POR_SESION
} from "../src/logica/equilibrio.js";
import { generarRutina } from "../src/logica/generador.js";
import { GRUPOS, rangoDe } from "../src/logica/volumen.js";

/**
 * Lo que un entrenador mira y una suma por grupo no enseña: si el volumen es
 * directo o de rebote, si cabe en una sesión y si empuja tanto como tira.
 */

const ej = (extra) => ({
  id: extra.id || "x", nombre: extra.nombre || "Ejercicio", series: 4,
  reps: "10", tempo: "2-1-1-0", rir: 2, descanso: 90, sugerido: "40 kg",
  mecanica: "compound", equipo: "barra", ...extra
});
const dia = (id, ejercicios) => ({ id, nombre: id, ejercicios });

describe("desglose directo e indirecto", () => {
  it("separa lo que el ejercicio entrena de frente de lo que deja de rebote", () => {
    const r = { dias: [dia("a", [ej({ grupo: "pecho", secundarios: ["triceps"], series: 4 })])] };
    const d = desglose(r);
    const pecho = d.find((x) => x.grupo === "pecho");
    const triceps = d.find((x) => x.grupo === "triceps");
    expect(pecho.directo).toBe(4);
    expect(pecho.indirecto).toBe(0);
    expect(triceps.directo).toBe(0);
    expect(triceps.indirecto).toBe(2);
    expect(triceps.total).toBe(2);
  });

  it("el máximo por sesión es de una sesión, no la suma de la semana", () => {
    const uno = ej({ id: "a", grupo: "espalda", series: 8 });
    const r = { dias: [dia("a", [uno]), dia("b", [{ ...uno, id: "b" }])] };
    const espalda = desglose(r).find((x) => x.grupo === "espalda");
    expect(espalda.total).toBe(16);
    expect(espalda.porSesion).toBe(8);
    expect(espalda.dias).toBe(2);
  });

  it("incluye todos los grupos, también los que no aparecen", () => {
    const d = desglose({ dias: [] });
    expect(d).toHaveLength(Object.keys(GRUPOS).length);
    expect(d.every((x) => x.total === 0)).toBe(true);
  });
});

describe("equilibrio de patrones", () => {
  const conPatrones = (lista) => ({
    dias: [dia("a", lista.map((p, i) => ej({ id: "e" + i, grupo: "pecho", patron: p.patron, series: p.series })))]
  });

  it("una banca por cada remo está bien", () => {
    const e = equilibrios(conPatrones([
      { patron: "empuje-horizontal", series: 8 },
      { patron: "traccion-horizontal", series: 8 }
    ]));
    expect(e.find((x) => x.id === "horizontal").estado).toBe("ok");
    expect(e.find((x) => x.id === "horizontal").ratio).toBe(1);
  });

  it("el doble de empuje que de tracción no", () => {
    const e = equilibrios(conPatrones([
      { patron: "empuje-horizontal", series: 12 },
      { patron: "traccion-horizontal", series: 4 }
    ]));
    expect(e.find((x) => x.id === "horizontal").estado).toBe("exceso");
  });

  it("tirar de más sí: es el desequilibrio sano", () => {
    // Nadie se lesiona el hombro por hacer demasiado remo.
    const e = equilibrios(conPatrones([
      { patron: "empuje-vertical", series: 3 },
      { patron: "traccion-vertical", series: 7 }
    ]));
    expect(e.find((x) => x.id === "vertical").estado).toBe("ok");
  });

  it("y que falte un patrón entero se dice", () => {
    const e = equilibrios(conPatrones([{ patron: "empuje-horizontal", series: 8 }]));
    expect(e.find((x) => x.id === "horizontal").estado).toBe("falta");
    expect(e.find((x) => x.id === "horizontal").ratio).toBe(null);
  });

  it("sin ningún ejercicio de la pareja no inventa un aviso", () => {
    const lista = avisos({ dias: [dia("a", [ej({ grupo: "core", series: 6 })])] });
    expect(lista.filter((a) => a.tipo === "equilibrio")).toEqual([]);
  });

  it("cuenta series, no ejercicios", () => {
    // Dos remos de 3 no compensan una banca de 12.
    const p = porPatron(conPatrones([
      { patron: "empuje-horizontal", series: 12 },
      { patron: "traccion-horizontal", series: 3 }
    ]));
    expect(p["empuje-horizontal"]).toBe(12);
  });
});

describe("avisos", () => {
  it("detecta el grupo que llega a su rango solo de rebote", () => {
    // El caso real del glúteo: diez series que salen todas de sentadillas y
    // pesos muertos. Cuentan para el volumen, pero nadie lo entrenó de frente.
    const r = {
      dias: [
        dia("a", [ej({ id: "s", grupo: "cuadriceps", secundarios: ["gluteo"], series: 8 })]),
        dia("b", [ej({ id: "p", grupo: "isquios", secundarios: ["gluteo"], series: 8 })])
      ]
    };
    const a = avisos(r).find((x) => x.tipo === "sin-directo");
    expect(a.grupo).toBe("gluteo");
    expect(a.nivel).toBe("alto");
  });

  it("y no lo dice del grupo que sí tiene trabajo propio", () => {
    const r = { dias: [dia("a", [ej({ grupo: "gluteo", series: 10 })])] };
    expect(avisos(r).some((x) => x.tipo === "sin-directo")).toBe(false);
  });

  it("avisa de la sesión que concentra demasiado del mismo músculo", () => {
    const r = { dias: [dia("a", [ej({ grupo: "espalda", series: TOPE_POR_SESION + 4 })])] };
    const a = avisos(r).find((x) => x.tipo === "dosis");
    expect(a.texto).toMatch(/en una misma sesión/);
  });

  it("justo en el tope todavía no avisa", () => {
    const r = { dias: [dia("a", [ej({ grupo: "espalda", series: TOPE_POR_SESION })])] };
    expect(avisos(r).some((x) => x.tipo === "dosis")).toBe(false);
  });

  it("el grupo que no se entrena pesa más que el que se pasa", () => {
    const r = {
      dias: [dia("a", [
        ej({ id: "a", grupo: "pecho", series: 30 }),
        ej({ id: "b", grupo: "espalda", series: 12 })
      ])]
    };
    const l = avisos(r);
    expect(l[0].nivel).toBe("alto");
    expect(l.some((x) => x.tipo === "ausente" && x.grupo === "biceps")).toBe(true);
  });

  it("un grupo que solo se entrena un día lo dice", () => {
    const r = { dias: [dia("a", [ej({ grupo: "pecho", series: 12 })])] };
    expect(avisos(r).some((x) => x.tipo === "frecuencia" && x.grupo === "pecho")).toBe(true);
  });

  it("una rutina equilibrada no produce avisos de peso", () => {
    const r = {
      dias: [
        dia("a", [
          ej({ id: "1", grupo: "pecho", patron: "empuje-horizontal", series: 6 }),
          ej({ id: "2", grupo: "espalda", patron: "traccion-horizontal", series: 6 })
        ]),
        dia("b", [
          ej({ id: "3", grupo: "pecho", patron: "empuje-horizontal", series: 6 }),
          ej({ id: "4", grupo: "espalda", patron: "traccion-horizontal", series: 6 })
        ])
      ]
    };
    const altos = avisos(r).filter((x) => x.nivel === "alto" && x.tipo === "equilibrio");
    expect(altos).toEqual([]);
  });
});

describe("veredicto", () => {
  it("una rutina vacía no pasa por buena", () => {
    expect(veredicto({ dias: [] }).ok).toBe(false);
  });

  it("y la respuesta dice cuántas cosas hay que arreglar", () => {
    const r = { dias: [dia("a", [ej({ grupo: "pecho", series: 30 })])] };
    expect(veredicto(r).texto).toMatch(/arreglar/);
  });
});

describe("el generador tiene esto en cuenta al armar", () => {
  const base = { objetivo: "recomposicion", equipo: "completo", experiencia: "intermedio", catalogo };
  const armar = (dias, minutos = 60) => generarRutina({ ...base, dias, minutos });

  it("devuelve su propia revisión junto con la rutina", () => {
    const r = armar(4);
    expect(r.ok).toBe(true);
    expect(Array.isArray(r.equilibrio)).toBe(true);
  });

  it("de 3 a 6 días no deja ningún grupo corto ni sin entrenar", () => {
    for (const dias of [3, 4, 5, 6]) {
      const r = armar(dias);
      const fuera = avisos(r.rutina).filter((a) => ["bajo", "ausente"].includes(a.tipo));
      expect(fuera.map((a) => a.texto), `${dias} días`).toEqual([]);
    }
  });

  it("ni prescribe series directas por encima del máximo de nadie", () => {
    // El rebote puede pasar del techo y no hay nada que recortar; lo directo
    // sí se decide, y de eso responde el generador.
    for (const dias of [3, 4, 5, 6]) {
      const r = armar(dias);
      desglose(r.rutina).forEach((g) =>
        expect(g.directo, `${dias} días · ${g.nombre}`).toBeLessThanOrEqual(rangoDe(g.grupo).max)
      );
    }
  });

  it("ni ningún músculo sin trabajo directo", () => {
    // Antes el glúteo llegaba a su rango entero de rebote en todos los splits.
    for (const dias of [3, 4, 5, 6]) {
      const r = armar(dias);
      const soloRebote = avisos(r.rutina).filter((a) => a.tipo === "sin-directo");
      expect(soloRebote.map((a) => a.texto), `${dias} días`).toEqual([]);
    }
  });

  it("ni un desequilibrio grave de empuje contra tracción", () => {
    for (const dias of [3, 4, 5, 6]) {
      const r = armar(dias);
      const graves = avisos(r.rutina).filter((a) => a.tipo === "equilibrio" && a.nivel === "alto");
      expect(graves.map((a) => a.texto), `${dias} días`).toEqual([]);
    }
  });

  it("ni más de diez series DIRECTAS del mismo músculo en una sesión", () => {
    // Lo directo es lo que el generador decide; lo que cae de rebote depende
    // de qué más tenga el día y no se puede fijar por adelantado.
    for (const dias of [3, 4, 5, 6]) {
      const r = armar(dias);
      desglose(r.rutina).forEach((g) =>
        expect(g.porSesionDirecto, `${dias} días · ${g.nombre}`).toBeLessThanOrEqual(TOPE_POR_SESION)
      );
    }
  });

  it("con dos días no puede cumplirlo todo, y lo dice en vez de fingir", () => {
    // Dos sesiones no alcanzan para diez grupos. El valor está en avisarlo.
    const r = armar(2);
    expect(r.ok).toBe(true);
    expect(avisos(r.rutina).some((a) => a.nivel === "alto")).toBe(true);
    expect(veredicto(r.rutina).ok).toBe(false);
  });

  it("cuenta lo que repara en los avisos de la generación", () => {
    const r = armar(4);
    expect(r.avisos.some((a) => a.startsWith("Equilibrio:"))).toBe(true);
  });
});

describe("la rutina de Tadeo", () => {
  const soloFuerza = { dias: rutinaReal.dias.filter((d) => d.tipo === "fuerza") };

  it("se puede revisar entera sin reventar", () => {
    expect(desglose(soloFuerza)).toHaveLength(Object.keys(GRUPOS).length);
    expect(veredicto(soloFuerza).texto).toBeTruthy();
  });

  it("ningún grupo pasa de su máximo", () => {
    desglose(soloFuerza).forEach((g) =>
      expect(g.total, g.nombre).toBeLessThanOrEqual(rangoDe(g.grupo).max)
    );
  });

  it("las tres parejas de patrones están cubiertas", () => {
    equilibrios(soloFuerza).forEach((e) => {
      expect(e.series.empuje + e.series.traccion, e.nombre).toBeGreaterThan(0);
    });
    expect(PAREJAS).toHaveLength(3);
  });
});
