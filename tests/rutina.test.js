import { describe, it, expect } from "vitest";
import rutina from "../src/datos/rutina.json";
import { construirSecuencia, duracion, minutosTrabajo } from "../src/logica/secuencia.js";
import { rangoSugerido } from "../src/logica/unidades.js";

/**
 * rutina.json es editable desde el celular. Estos tests son la red que evita
 * que un cambio a mano rompa la app sin que nadie se entere hasta el gimnasio.
 */

describe("integridad de rutina.json", () => {
  it("tiene los siete días del protocolo", () => {
    expect(rutina.dias.map((d) => d.id)).toEqual([
      "torsoA", "piernaA", "torsoB", "piernaB", "z2", "hiitA", "hiitB"
    ]);
  });

  it("todos los ids de ejercicio son únicos", () => {
    const ids = rutina.dias.flatMap((d) => (d.ejercicios || []).map((e) => e.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("cada ejercicio trae los campos que la vista necesita", () => {
    rutina.dias
      .filter((d) => d.ejercicios)
      .forEach((d) => {
        d.ejercicios.forEach((e) => {
          expect(e.id, `${d.id}: id`).toBeTruthy();
          expect(e.nombre, `${e.id}: nombre`).toBeTruthy();
          expect(e.series, `${e.id}: series`).toBeGreaterThan(0);
          expect(e.repMax, `${e.id}: repMax`).toBeGreaterThan(0);
          expect(e.descanso, `${e.id}: descanso`).toBeGreaterThan(0);
          expect(e.tempo, `${e.id}: tempo`).toBeTruthy();
        });
      });
  });

  it("los pesos sugeridos están en kg o declaran peso corporal", () => {
    rutina.dias
      .filter((d) => d.ejercicios)
      .forEach((d) => {
        d.ejercicios.forEach((e) => {
          const r = rangoSugerido(e.sugerido);
          const corporal = /corporal/i.test(e.sugerido);
          expect(r !== null || corporal, `${e.id}: "${e.sugerido}" no tiene kg ni dice corporal`).toBe(true);
          if (r) expect(r[0], `${e.id}: rango invertido`).toBeLessThanOrEqual(r[1]);
        });
      });
  });

  it("los descansos son razonables para un gimnasio", () => {
    rutina.dias
      .filter((d) => d.ejercicios)
      .forEach((d) => {
        d.ejercicios.forEach((e) => {
          expect(e.descanso, `${e.id}`).toBeGreaterThanOrEqual(30);
          expect(e.descanso, `${e.id}`).toBeLessThanOrEqual(300);
        });
      });
  });
});

describe("secuencias de HIIT", () => {
  const A = rutina.dias.find((d) => d.id === "hiitA");
  const B = rutina.dias.find((d) => d.id === "hiitB");

  it("la rutina A arma 8 rounds con calentamiento y enfriamiento", () => {
    const pasos = construirSecuencia(A.secuencia);
    expect(pasos[0].tipo).toBe("calentamiento");
    expect(pasos.at(-1).tipo).toBe("enfriamiento");
    expect(pasos.filter((p) => /cuerda rápida/.test(p.n))).toHaveLength(8);
    expect(duracion(pasos)).toBe(300 + 8 * 120 + 300);
  });

  it("la rutina B arma 5 vueltas de EMOM con descanso entre vueltas", () => {
    const pasos = construirSecuencia(B.secuencia);
    expect(pasos.filter((p) => p.tipo === "descanso")).toHaveLength(4);
    expect(minutosTrabajo(pasos)).toBe(25);
    expect(duracion(pasos)).toBe(5 * 5 * 60 + 4 * 90);
  });

  it("la sesión completa cabe en media hora, que era el punto de recortarla", () => {
    expect(duracion(construirSecuencia(B.secuencia)) / 60).toBeLessThanOrEqual(32);
  });

  it("la descripción no promete más minutos de los que la secuencia tiene", () => {
    const declarados = Number(B.sub.match(/(\d+)\s*min/)[1]);
    expect(minutosTrabajo(construirSecuencia(B.secuencia))).toBe(declarados);
    expect(B.intro).toMatch(/5 vueltas/);
  });

  it("una especificación vacía no truena", () => {
    expect(construirSecuencia(null)).toEqual([]);
    expect(duracion([])).toBe(0);
  });
});

describe("la Zona 2 no trae pulsaciones escritas a mano", () => {
  const z2 = rutina.dias.find((d) => d.id === "z2");

  it("ningún texto fija un rango de ppm", () => {
    // Las zonas se calculan con Karvonen desde la FC en reposo de Tadeo. Un
    // rango escrito en el JSON contradice al cálculo en cuanto cambie su reposo.
    const todo = JSON.stringify(z2);
    expect(todo).not.toMatch(/\d{2,3}\s*[–-]\s*\d{2,3}\s*ppm/);
  });

  it("sigue trayendo la progresión de duración, que sí es del plan", () => {
    expect(JSON.stringify(z2)).toMatch(/30 min|35 min|40 min/);
  });
});
