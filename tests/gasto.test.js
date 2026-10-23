import { describe, it, expect } from "vitest";
import {
  seriesDeSesion, gastoDelDia, gastoMedioDiario, gastoDeSemana,
  gastoTotalDiario, pesoActual, registrarPeso
} from "../src/logica/gasto.js";
import { tmb, gastoBase, ACTIVIDAD } from "../src/logica/nutricion.js";

const PESO = 110;
const TMB = tmb("hombre", PESO, 178, 44);
const S = (ok = true) => ({ p: 60, r: 8, ok });

const datos = {
  sesiones: {
    "push|2026-10-20|1": {
      fecha: "2026-10-20",
      ej: { pu1: [S(), S(), S(), S()], pu2: [S(), S(), S()], pu3: [S(), S(), S(false)] }
    },
    "pull|2026-10-21|1": { fecha: "2026-10-21", ej: { pl1: [S(), S(), S(), S()] } }
  },
  carreras: [
    { id: "c1", fecha: "2026-10-20", km: 5, segundos: 1800 },
    { id: "c2", fecha: "2026-10-22", km: 8, segundos: 3000 }
  ],
  pesos: [],
  nutricion: { pesoInicial: 110 }
};

describe("series de una sesión", () => {
  it("cuenta solo las marcadas como hechas", () => {
    expect(seriesDeSesion(datos.sesiones["push|2026-10-20|1"])).toBe(9);
  });

  it("una sesión vacía no suma", () => {
    expect(seriesDeSesion({ ej: {} })).toBe(0);
    expect(seriesDeSesion(null)).toBe(0);
  });
});

describe("gasto de un día", () => {
  it("suma fuerza y carrera del mismo día", () => {
    const g = gastoDelDia(datos, "2026-10-20", PESO, TMB);
    expect(g.series).toBe(9);
    expect(g.km).toBe(5);
    expect(g.fuerza).toBeGreaterThan(0);
    expect(g.carrera).toBeGreaterThan(0);
    expect(g.total).toBe(g.fuerza + g.carrera);
  });

  it("un día solo de fuerza no inventa carrera", () => {
    const g = gastoDelDia(datos, "2026-10-21", PESO, TMB);
    expect(g.carrera).toBe(0);
    expect(g.km).toBe(0);
    expect(g.fuerza).toBeGreaterThan(0);
  });

  it("un día solo de carrera no inventa fuerza", () => {
    const g = gastoDelDia(datos, "2026-10-22", PESO, TMB);
    expect(g.fuerza).toBe(0);
    expect(g.km).toBe(8);
  });

  it("un día de descanso gasta cero de entrenamiento", () => {
    expect(gastoDelDia(datos, "2026-10-19", PESO, TMB).total).toBe(0);
  });
});

describe("gasto medio diario", () => {
  it("reparte el gasto de la quincena entre todos los días", () => {
    // Comer según lo que se entrenó cada día produce oscilaciones de 600 kcal
    // que nadie sigue; la grasa no se gana ni se pierde en 24 horas.
    const m = gastoMedioDiario(datos, "2026-10-22", PESO, TMB, 14);
    expect(m.dias).toBe(14);
    expect(m.diasConActividad).toBe(3);
    expect(m.medio).toBe(Math.round(m.total / 14));
    expect(m.medio).toBeLessThan(gastoDelDia(datos, "2026-10-20", PESO, TMB).total);
  });

  it("sin registros el medio es cero, no una estimación inventada", () => {
    const m = gastoMedioDiario({ sesiones: {}, carreras: [] }, "2026-10-22", PESO, TMB);
    expect(m.medio).toBe(0);
    expect(m.diasConActividad).toBe(0);
  });

  it("solo mira la ventana pedida, contando hoy dentro de ella", () => {
    // Dos días desde el 22 son el 21 y el 22: ambos con actividad.
    const corta = gastoMedioDiario(datos, "2026-10-22", PESO, TMB, 2);
    expect(corta.diasConActividad).toBe(2);
    expect(corta.desde).toBe("2026-10-21");
    expect(corta.hasta).toBe("2026-10-22");

    // Un solo día es solo hoy.
    expect(gastoMedioDiario(datos, "2026-10-19", PESO, TMB, 1).diasConActividad).toBe(0);
  });
});

describe("gasto de una semana", () => {
  it("agrupa por semana ISO", () => {
    const g = gastoDeSemana(datos, "2026-W43", PESO, TMB);
    expect(g.dias).toBe(3);
    expect(g.total).toBeGreaterThan(0);
    expect(g.total).toBe(g.fuerza + g.carrera);
  });

  it("una semana sin nada registrado da cero", () => {
    expect(gastoDeSemana(datos, "2026-W01", PESO, TMB).total).toBe(0);
  });
});

describe("gasto total del día", () => {
  it("separa vivir de entrenar, y los suma", () => {
    const g = gastoTotalDiario(datos, "2026-10-22", PESO, TMB, "sentado");
    expect(g.base).toBe(gastoBase(TMB, "sentado"));
    expect(g.total).toBe(g.base + g.entrenamiento);
  });

  it("no cuenta dos veces el ejercicio: el factor base es de vida diaria", () => {
    // Con un factor "muy activo" que ya incluyera el gym, sumar el entrenamiento
    // medido inflaría el gasto. Por eso los factores son bajos.
    expect(ACTIVIDAD.sentado.factor).toBeLessThan(1.4);
    expect(ACTIVIDAD.muyActiva.factor).toBeLessThan(1.7);
  });

  it("trae el gasto de hoy aparte del medio, como dato", () => {
    const g = gastoTotalDiario(datos, "2026-10-20", PESO, TMB, "sentado");
    expect(g.hoy.series).toBe(9);
    expect(g.hoy.total).toBeGreaterThan(g.entrenamiento);
  });
});

describe("registro de peso", () => {
  it("devuelve el más reciente", () => {
    const d = { pesos: [{ fecha: "2026-10-01", kg: 110 }, { fecha: "2026-10-15", kg: 108.4 }] };
    expect(pesoActual(d)).toBe(108.4);
  });

  it("sin registros cae en el peso configurado", () => {
    expect(pesoActual({ pesos: [], nutricion: { pesoInicial: 110 } })).toBe(110);
  });

  it("guarda un peso nuevo ordenado por fecha", () => {
    const p = registrarPeso({ pesos: [{ fecha: "2026-10-05", kg: 110 }] }, "2026-10-01", 111);
    expect(p.map((x) => x.fecha)).toEqual(["2026-10-01", "2026-10-05"]);
  });

  it("dos pesos el mismo día: gana el último, no se duplica la fecha", () => {
    let p = registrarPeso({ pesos: [] }, "2026-10-01", 110);
    p = registrarPeso({ pesos: p }, "2026-10-01", 109.5);
    expect(p).toHaveLength(1);
    expect(p[0].kg).toBe(109.5);
  });

  it("redondea a décimas, que es lo que distingue una báscula", () => {
    expect(registrarPeso({ pesos: [] }, "2026-10-01", 110.37)[0].kg).toBe(110.4);
  });

  it("rechaza valores imposibles sin tocar lo guardado", () => {
    const previos = [{ fecha: "2026-10-01", kg: 110 }];
    expect(registrarPeso({ pesos: previos }, "2026-10-02", 0)).toBe(previos);
    expect(registrarPeso({ pesos: previos }, "2026-10-02", 999)).toBe(previos);
  });
});
