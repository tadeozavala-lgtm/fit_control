import { describe, it, expect } from "vitest";
import {
  e1rm, confiable, mejorSerie, tonelaje, seriesHechas,
  sugerencia, factorSemana, esDescarga, recordPrevio, esRecord
} from "../src/logica/fuerza.js";

const S = (p, r, ok = true) => ({ p, r, ok });

describe("1RM estimado", () => {
  it("aplica Epley", () => {
    expect(e1rm(100, 1)).toBeCloseTo(103.33, 1);
    expect(e1rm(60, 10)).toBe(80);
  });

  it("devuelve 0 con datos incompletos", () => {
    expect(e1rm(0, 10)).toBe(0);
    expect(e1rm(60, 0)).toBe(0);
    expect(e1rm("", "")).toBe(0);
  });

  it("marca como poco confiable arriba de 12 reps", () => {
    expect(confiable(8)).toBe(true);
    expect(confiable(12)).toBe(true);
    expect(confiable(20)).toBe(false);
  });
});

describe("mejor serie y volumen", () => {
  it("elige la de mayor 1RM estimado, no la más pesada", () => {
    const m = mejorSerie([S(80, 3), S(70, 10), S(60, 12)]);
    expect(m.peso).toBe(70); // 93.3 vs 88 vs 84
  });

  it("ignora las series no marcadas", () => {
    expect(mejorSerie([S(100, 10, false), S(60, 8)]).peso).toBe(60);
  });

  it("devuelve null si no hay nada completado", () => {
    expect(mejorSerie([S(60, 8, false)])).toBeNull();
    expect(mejorSerie([])).toBeNull();
    expect(mejorSerie(undefined)).toBeNull();
  });

  it("suma tonelaje solo de lo completado", () => {
    expect(tonelaje([S(60, 10), S(60, 8), S(60, 8, false)])).toBe(1080);
  });

  it("cuenta series hechas", () => {
    expect(seriesHechas([S(60, 8), S(60, 8, false), S(60, 6)])).toBe(2);
  });
});

describe("sugerencia de progresión", () => {
  const ej = { repMax: 8, series: 3 };

  it("sube cuando completa todo en el tope del rango", () => {
    const s = sugerencia([S(60, 8), S(60, 8), S(60, 9)], ej, "kg");
    expect(s.accion).toBe("subir");
    expect(s.texto).toContain("2.5 kg");
  });

  it("sugiere en libras cuando esa es la unidad activa", () => {
    const s = sugerencia([S(60, 8), S(60, 8), S(60, 8)], ej, "lb");
    expect(s.texto).toContain("5 lb");
  });

  it("no sube si faltan series por completar", () => {
    const s = sugerencia([S(60, 8), S(60, 8), { p: "", r: "", ok: false }], ej, "kg");
    expect(s.accion).not.toBe("subir");
  });

  it("manda bajar si se queda muy corto del rango", () => {
    expect(sugerencia([S(80, 4)], ej, "kg").accion).toBe("bajar");
  });

  it("no dice nada sin series registradas", () => {
    expect(sugerencia([], ej, "kg").texto).toBe("");
  });

  it("usa segundos para los ejercicios de tiempo", () => {
    const plancha = { repMax: 45, tiempo: true };
    expect(sugerencia([S("", 45), S("", 50)], plancha, "kg").texto).toContain("10 s");
  });
});

describe("periodización", () => {
  it("descarga cada cuarta semana", () => {
    expect(factorSemana(1)).toBe(1);
    expect(factorSemana(3)).toBe(1);
    expect(factorSemana(4)).toBe(0.9);
    expect(factorSemana(8)).toBe(0.9);
    expect(esDescarga(4)).toBe(true);
    expect(esDescarga(5)).toBe(false);
  });
});

describe("récords", () => {
  const sesiones = [
    { fecha: "2026-10-01", ej: { pu1: [S(60, 8)] } },
    { fecha: "2026-10-08", ej: { pu1: [S(62.5, 8)] } },
    { fecha: "2026-10-12", ej: { pu1: [S(80, 8)] } }
  ];

  it("excluye la sesión de hoy del récord previo", () => {
    const r = recordPrevio(sesiones, "pu1", "2026-10-12");
    expect(r).toBeCloseTo(e1rm(62.5, 8), 5);
  });

  it("detecta que la serie de hoy es récord", () => {
    const r = recordPrevio(sesiones, "pu1", "2026-10-12");
    expect(esRecord(S(80, 8), r)).toBe(true);
    expect(esRecord(S(60, 8), r)).toBe(false);
  });

  it("no marca récord sin historial previo", () => {
    expect(esRecord(S(100, 10), 0)).toBe(false);
  });
});
