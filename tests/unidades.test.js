import { describe, it, expect } from "vitest";
import {
  kgALb, lbAKg, mostrar, aKg, conUnidad, etiquetaEquiv,
  rangoSugerido, textoSugerido
} from "../src/logica/unidades.js";

describe("conversión kg <-> lb", () => {
  it("convierte kilos a libras al medio más cercano", () => {
    expect(kgALb(60)).toBe(132.5);
    expect(kgALb(20)).toBe(44);
    expect(kgALb(100)).toBe(220.5);
  });

  it("convierte libras a kilos", () => {
    expect(lbAKg(135)).toBeCloseTo(61.23, 1);
    expect(lbAKg(45)).toBeCloseTo(20.41, 1);
  });

  it("ida y vuelta no acumula error perceptible", () => {
    [20, 42.5, 60, 87.5, 140].forEach((kg) => {
      expect(Math.abs(lbAKg(kgALb(kg)) - kg)).toBeLessThan(0.3);
    });
  });
});

describe("mostrar y capturar", () => {
  it("muestra el valor guardado en la unidad activa", () => {
    expect(mostrar(60, "kg")).toBe(60);
    expect(mostrar(60, "lb")).toBe(132.5);
  });

  it("devuelve cadena vacía si no hay valor", () => {
    expect(mostrar("", "kg")).toBe("");
    expect(mostrar(null, "lb")).toBe("");
    expect(aKg("", "lb")).toBe("");
  });

  it("guarda siempre en kilos, escriba en la unidad que escriba", () => {
    expect(aKg(60, "kg")).toBe(60);
    expect(aKg(135, "lb")).toBeCloseTo(61.23, 1);
  });

  it("ignora texto que no es número", () => {
    expect(aKg("abc", "kg")).toBe("");
    expect(mostrar("abc", "kg")).toBe("");
  });

  it("la etiqueta chica muestra siempre la unidad contraria", () => {
    expect(etiquetaEquiv(60, "kg")).toBe("= 132.5 lb");
    expect(etiquetaEquiv(61.2, "lb")).toBe("= 61.2 kg");
    expect(etiquetaEquiv("", "kg")).toBe("kg");
  });

  it("conUnidad redondea cuando se le pide", () => {
    expect(conUnidad(60, "kg")).toBe("60 kg");
    expect(conUnidad(72.456, "kg", 0)).toBe("72 kg");
    expect(conUnidad("", "kg")).toBe("—");
  });
});

describe("rangos sugeridos de rutina.json", () => {
  it("lee rangos con guion largo", () => {
    expect(rangoSugerido("55–60 kg")).toEqual([55, 60]);
  });

  it("lee un valor único", () => {
    expect(rangoSugerido("50 kg")).toEqual([50, 50]);
  });

  it("lee rangos con texto alrededor", () => {
    expect(rangoSugerido("24–32 kg kettlebell")).toEqual([24, 32]);
    expect(rangoSugerido("16–20 kg c/u")).toEqual([16, 20]);
    expect(rangoSugerido("disco 5–10 kg")).toEqual([5, 10]);
  });

  it("devuelve null cuando no hay kilos", () => {
    expect(rangoSugerido("peso corporal")).toBeNull();
  });

  it("muestra las dos unidades con la activa primero", () => {
    expect(textoSugerido("55–60 kg", "kg")).toBe("55–60 kg · 121.5–132.5 lb");
    expect(textoSugerido("55–60 kg", "lb")).toBe("121.5–132.5 lb · 55–60 kg");
  });

  it("conserva el texto extra del sugerido", () => {
    expect(textoSugerido("24–32 kg kettlebell", "kg")).toContain("kettlebell");
  });

  it("deja pasar sin tocar lo que no tiene número", () => {
    expect(textoSugerido("peso corporal", "kg")).toBe("peso corporal");
  });
});
