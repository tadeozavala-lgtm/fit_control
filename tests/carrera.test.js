import { describe, it, expect } from "vitest";
import {
  fcMaxEstimada, zonasKarvonen, zonaDe, ZONAS,
  ritmo, formatoRitmo, formatoTiempo, leerTiempo,
  predecir, confiable, tablaPredicciones, DISTANCIAS,
  vdot, ritmoUmbral, ritmosEntrenamiento, RITMOS,
  nuevaCarrera, carrerasDeSemana, resumenCarreras, avisoVolumen
} from "../src/logica/carrera.js";
import { semanaISO } from "../src/logica/volumen.js";

describe("frecuencia cardiaca máxima", () => {
  it("usa Tanaka, no 220 menos edad", () => {
    expect(fcMaxEstimada(44)).toBe(177);
    expect(fcMaxEstimada(25)).toBe(191);
  });

  it("baja con la edad", () => {
    expect(fcMaxEstimada(30)).toBeGreaterThan(fcMaxEstimada(60));
  });
});

describe("zonas de Karvonen", () => {
  const z = zonasKarvonen(177, 65);

  it("devuelve las cinco zonas en orden ascendente", () => {
    expect(z).toHaveLength(5);
    for (let i = 1; i < z.length; i++) {
      expect(z[i].desde).toBeGreaterThanOrEqual(z[i - 1].desde);
    }
  });

  it("la zona 5 llega a la máxima y la 1 arranca sobre el reposo", () => {
    expect(z[4].hasta).toBe(177);
    expect(z[0].desde).toBeGreaterThan(65);
  });

  it("trabaja sobre la reserva: con el mismo máximo, distinto reposo da distintas zonas", () => {
    const enForma = zonasKarvonen(177, 50);
    const sedentario = zonasKarvonen(177, 75);
    expect(enForma[1].desde).not.toBe(sedentario[1].desde);
    expect(enForma[1].desde).toBeLessThan(sedentario[1].desde);
  });

  it("este es el punto de la función: la Z2 real no es el rango genérico del libro", () => {
    const z2 = zonasKarvonen(177, 65)[1];
    expect(z2.desde).toBe(132);
    expect(z2.hasta).toBe(143);
  });

  it("devuelve vacío si los datos no tienen sentido", () => {
    expect(zonasKarvonen(150, 160)).toEqual([]);
    expect(zonasKarvonen(0, 0)).toEqual([]);
  });

  it("ubica una pulsación en su zona", () => {
    expect(zonaDe(138, 177, 65).n).toBe(2);
    expect(zonaDe(170, 177, 65).n).toBe(5);
    expect(zonaDe(90, 177, 65)).toBeNull();
  });

  it("las zonas cubren de 50% a 100% de la reserva sin huecos", () => {
    for (let i = 1; i < ZONAS.length; i++) {
      expect(ZONAS[i].min).toBe(ZONAS[i - 1].max);
    }
  });
});

describe("ritmos y formatos", () => {
  it("calcula segundos por kilómetro", () => {
    expect(ritmo(5, 1800)).toBe(360);
    expect(ritmo(10, 3600)).toBe(360);
  });

  it("devuelve 0 con datos incompletos", () => {
    expect(ritmo(0, 1800)).toBe(0);
    expect(ritmo(5, 0)).toBe(0);
  });

  it("formatea el ritmo con dos dígitos de segundos", () => {
    expect(formatoRitmo(360)).toBe("6:00");
    expect(formatoRitmo(345)).toBe("5:45");
    expect(formatoRitmo(0)).toBe("—");
  });

  it("nunca produce un 5:60 por redondeo", () => {
    expect(formatoRitmo(359.6)).toBe("6:00");
    expect(formatoRitmo(359.5)).toBe("6:00");
  });

  it("formatea tiempos con y sin horas", () => {
    expect(formatoTiempo(1800)).toBe("30:00");
    expect(formatoTiempo(4325)).toBe("1:12:05");
    expect(formatoTiempo(0)).toBe("—");
  });

  it("lee tiempos escritos de las tres formas", () => {
    expect(leerTiempo("30:00")).toBe(1800);
    expect(leerTiempo("1:12:05")).toBe(4325);
    expect(leerTiempo("48")).toBe(2880);
  });

  it("ignora texto que no es un tiempo", () => {
    expect(leerTiempo("abc")).toBe(0);
    expect(leerTiempo("")).toBe(0);
    expect(leerTiempo("-5:00")).toBe(0);
  });

  it("formatear y leer son inversas", () => {
    [1800, 4325, 2880, 600].forEach((t) => {
      expect(leerTiempo(formatoTiempo(t))).toBe(t);
    });
  });
});

describe("predicción de Riegel", () => {
  it("una distancia mayor da un ritmo más lento", () => {
    const t10 = predecir(5, 1800, 10);
    expect(t10).toBeGreaterThan(3600);
    expect(ritmo(10, t10)).toBeGreaterThan(ritmo(5, 1800));
  });

  it("predecir la misma distancia devuelve el mismo tiempo", () => {
    expect(predecir(5, 1800, 5)).toBeCloseTo(1800, 5);
  });

  it("marca como poco confiable lo que se aleja más de 4 veces", () => {
    expect(confiable(5, 10)).toBe(true);
    expect(confiable(5, 21.0975)).toBe(false);
    expect(confiable(10, 42.195)).toBe(false);
    expect(confiable(21.0975, 10)).toBe(true);
  });

  it("la tabla trae las cuatro distancias con su marca de confianza", () => {
    const t = tablaPredicciones(5, 1800);
    expect(t.map((x) => x.nombre)).toEqual(DISTANCIAS.map((d) => d.nombre));
    expect(t.find((x) => x.nombre === "Maratón").confiable).toBe(false);
    expect(t.find((x) => x.nombre === "10K").confiable).toBe(true);
  });

  it("aguanta datos incompletos sin reventar", () => {
    expect(predecir(0, 1800, 10)).toBe(0);
    expect(predecir(5, 0, 10)).toBe(0);
  });
});

describe("VDOT y ritmos de entrenamiento", () => {
  it("un corredor más rápido tiene mayor VDOT", () => {
    expect(vdot(5, 1500)).toBeGreaterThan(vdot(5, 1800));
  });

  it("devuelve 0 sin datos", () => {
    expect(vdot(0, 1800)).toBe(0);
    expect(vdot(5, 0)).toBe(0);
  });

  it("el umbral es MÁS LENTO que el ritmo de 5K", () => {
    // Este test existe por un error real: la primera versión calculaba el
    // umbral como el ritmo de 1 km, que es más rápido que el de 5K. El umbral
    // es lo que se sostiene una hora, así que tiene que ser más lento.
    expect(ritmoUmbral(5, 1800)).toBeGreaterThan(ritmo(5, 1800));
  });

  it("para un 10K en una hora, el umbral ronda ese mismo ritmo", () => {
    expect(ritmoUmbral(10, 3600)).toBeCloseTo(360, 0);
  });

  it("los ritmos van de más lento a más rápido en el orden correcto", () => {
    const r = ritmosEntrenamiento(5, 1800);
    expect(r.map((x) => x.id)).toEqual(RITMOS.map((x) => x.id));
    for (let i = 1; i < r.length; i++) {
      expect(r[i].segPorKm).toBeLessThan(r[i - 1].segPorKm);
    }
  });

  it("el ritmo fácil es claramente más lento que el de carrera", () => {
    const facil = ritmosEntrenamiento(5, 1800).find((x) => x.id === "facil");
    expect(facil.segPorKm).toBeGreaterThan(ritmo(5, 1800) * 1.2);
  });

  it("sin datos no inventa ritmos", () => {
    expect(ritmosEntrenamiento(0, 0)).toEqual([]);
  });
});

describe("registro de carreras", () => {
  const carreras = [
    nuevaCarrera("2026-10-12", 6, 2400, { tipo: "z2", esfuerzo: 3 }),
    nuevaCarrera("2026-10-14", 5, 1950, { tipo: "z2" }),
    nuevaCarrera("2026-10-20", 8, 3200, { tipo: "tempo" })
  ];

  it("una carrera nueva trae id, tipo y los campos opcionales", () => {
    const c = nuevaCarrera("2026-10-12", 6, 2400, { esfuerzo: 4, ppm: 140 });
    expect(c.id).toBeTruthy();
    expect(c.km).toBe(6);
    expect(c.tipo).toBe("z2");
    expect(c.esfuerzo).toBe(4);
    expect(c.ppm).toBe(140);
  });

  it("filtra por semana ISO", () => {
    const s = carrerasDeSemana(carreras, "2026-W42", semanaISO);
    expect(s).toHaveLength(2);
    expect(s[0].fecha).toBe("2026-10-12");
  });

  it("resume kilómetros, tiempo y ritmo medio", () => {
    const r = resumenCarreras(carrerasDeSemana(carreras, "2026-W42", semanaISO));
    expect(r.sesiones).toBe(2);
    expect(r.km).toBe(11);
    expect(r.segundos).toBe(4350);
    expect(formatoRitmo(r.ritmoMedio)).toBe("6:35");
  });

  it("un resumen vacío no truena", () => {
    expect(resumenCarreras([])).toEqual({ sesiones: 0, km: 0, segundos: 0, ritmoMedio: 0 });
  });
});

describe("aviso de volumen", () => {
  it("avisa al pasar del 10% de subida semanal", () => {
    const a = avisoVolumen(25, 20);
    expect(a.subida).toBe(25);
    expect(a.texto).toMatch(/10%/);
  });

  it("no avisa dentro del 10%", () => {
    expect(avisoVolumen(22, 20)).toBeNull();
    expect(avisoVolumen(20, 20)).toBeNull();
  });

  it("bajar volumen nunca es motivo de aviso", () => {
    expect(avisoVolumen(10, 20)).toBeNull();
  });

  it("sin semana previa no hay con qué comparar", () => {
    expect(avisoVolumen(20, 0)).toBeNull();
  });
});
