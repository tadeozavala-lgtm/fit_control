import { describe, it, expect } from "vitest";
import {
  tmb, ACTIVIDAD, gastoBase, gastoCarrera, gastoFuerza, KCAL_POR_SERIE_POR_10KG,
  OBJETIVOS_NUTRI, DEFICIT_MAXIMO, pisoCalorico, caloriasObjetivo,
  KCAL, macros, PLANTILLAS, repartirComidas,
  FUENTES_PROTEINA, porcionPara,
  mediaMovil, tendencia, cambioEsperado, ajustePorTendencia,
  AJUSTE_MAXIMO_KCAL, perdidaDemasiadoRapida, KCAL_POR_KG_GRASA
} from "../src/logica/nutricion.js";
import { migrar, ESQUEMA_ACTUAL, importarJSON, exportarJSON } from "../src/logica/almacen.js";

const PESO = 110;
const ALTURA = 178;
const EDAD = 44;
const TMB = tmb("hombre", PESO, ALTURA, EDAD);

describe("metabolismo basal", () => {
  it("aplica Mifflin-St Jeor para hombre", () => {
    // 10(110) + 6.25(178) - 5(44) + 5 = 1997.5 -> 1998
    expect(TMB).toBe(1998);
  });

  it("la fórmula de mujer resta 161 en vez de sumar 5", () => {
    expect(tmb("hombre", 70, 170, 30) - tmb("mujer", 70, 170, 30)).toBe(166);
  });

  it("baja con la edad y sube con el peso", () => {
    expect(tmb("hombre", 110, 178, 60)).toBeLessThan(TMB);
    expect(tmb("hombre", 120, 178, 44)).toBeGreaterThan(TMB);
  });

  it("devuelve 0 con datos incompletos en vez de un número inventado", () => {
    expect(tmb("hombre", 0, 178, 44)).toBe(0);
    expect(tmb("hombre", 110, 0, 44)).toBe(0);
    expect(tmb("hombre", 110, 178, 0)).toBe(0);
  });
});

describe("gasto base sin entrenamiento", () => {
  it("todos los factores son bajos porque el ejercicio se suma aparte", () => {
    Object.values(ACTIVIDAD).forEach((a) => {
      expect(a.factor).toBeGreaterThanOrEqual(1.2);
      expect(a.factor).toBeLessThanOrEqual(1.7);
    });
  });

  it("más actividad diaria, más gasto", () => {
    expect(gastoBase(TMB, "muyActiva")).toBeGreaterThan(gastoBase(TMB, "sentado"));
  });

  it("un nivel desconocido cae en el más conservador", () => {
    expect(gastoBase(TMB, "inventado")).toBe(gastoBase(TMB, "sentado"));
  });
});

describe("gasto del entrenamiento medido", () => {
  it("la carrera cuesta aproximadamente el peso corporal por kilómetro", () => {
    const g = gastoCarrera(10, 3600, PESO, TMB);
    expect(g).toBeGreaterThan(900);
    expect(g).toBeLessThan(1100);
  });

  it("descuenta el reposo de ese rato para no contarlo dos veces", () => {
    // El gasto base ya incluye estar vivo durante esa hora.
    const conDescuento = gastoCarrera(10, 3600, PESO, TMB);
    const sinDescuento = 10 * PESO;
    expect(conDescuento).toBeLessThan(sinDescuento);
    expect(sinDescuento - conDescuento).toBeCloseTo(TMB / 24, 0);
  });

  it("más peso corporal cuesta más por kilómetro", () => {
    expect(gastoCarrera(5, 1800, 120, TMB)).toBeGreaterThan(gastoCarrera(5, 1800, 90, TMB));
  });

  it("la fuerza se estima por series, no por tonelaje", () => {
    // Una sentadilla de 100 kg y un curl de 100 kg no cuestan lo mismo aunque
    // el tonelaje diga que sí.
    expect(gastoFuerza(20, PESO)).toBe(Math.round(20 * (PESO / 10) * KCAL_POR_SERIE_POR_10KG));
    expect(gastoFuerza(30, PESO)).toBeGreaterThan(gastoFuerza(20, PESO));
  });

  it("sin datos no inventa gasto", () => {
    expect(gastoCarrera(0, 1800, PESO, TMB)).toBe(0);
    expect(gastoFuerza(0, PESO)).toBe(0);
    expect(gastoFuerza(20, 0)).toBe(0);
  });

  it("nunca devuelve gasto negativo aunque la carrera sea larguísima y lenta", () => {
    expect(gastoCarrera(1, 36000, PESO, TMB)).toBeGreaterThanOrEqual(0);
  });
});

describe("objetivos y topes de seguridad", () => {
  const gasto = 3200;

  it("perder grasa resta y ganar músculo suma", () => {
    expect(caloriasObjetivo(gasto, "perder", TMB).objetivo).toBeLessThan(gasto);
    expect(caloriasObjetivo(gasto, "ganar", TMB).objetivo).toBeGreaterThan(gasto);
    expect(caloriasObjetivo(gasto, "mantener", TMB).objetivo).toBe(gasto);
  });

  it("ningún objetivo supera el déficit máximo", () => {
    Object.keys(OBJETIVOS_NUTRI).forEach((o) => {
      const c = caloriasObjetivo(gasto, o, TMB);
      expect((gasto - c.objetivo) / gasto).toBeLessThanOrEqual(DEFICIT_MAXIMO + 0.001);
    });
  });

  it("nunca baja del metabolismo basal: comer menos de lo que cuesta vivir no es una estrategia", () => {
    const c = caloriasObjetivo(2000, "perder", TMB);
    expect(c.objetivo).toBeGreaterThanOrEqual(TMB);
    expect(c.limitado).toBe("piso");
  });

  it("el piso tiene además un mínimo absoluto", () => {
    expect(pisoCalorico(900)).toBe(1500);
    expect(pisoCalorico(2400)).toBe(2400);
  });

  it("todos los objetivos piden proteína suficiente para proteger músculo", () => {
    Object.values(OBJETIVOS_NUTRI).forEach((o) => {
      expect(o.proteina).toBeGreaterThanOrEqual(1.6);
      expect(o.grasaMin).toBeGreaterThanOrEqual(0.7);
    });
  });

  it("a más déficit, más proteína", () => {
    expect(OBJETIVOS_NUTRI.perder.proteina).toBeGreaterThan(OBJETIVOS_NUTRI.mantener.proteina);
  });
});

describe("macronutrientes", () => {
  const m = macros(2600, PESO, "perder");

  it("la proteína se fija primero, en gramos por kilo", () => {
    expect(m.proteina).toBe(Math.round(2.2 * PESO));
    expect(m.porKgProteina).toBe(2.2);
  });

  it("los macros suman las calorías pedidas", () => {
    const suma = m.proteina * KCAL.proteina + m.grasa * KCAL.grasa + m.carbo * KCAL.carbo;
    expect(Math.abs(suma - 2600)).toBeLessThan(5);
  });

  it("los porcentajes suman cerca de 100", () => {
    const total = m.reparto.proteina + m.reparto.grasa + m.reparto.carbo;
    expect(Math.abs(total - 100)).toBeLessThanOrEqual(2);
  });

  it("el carbohidrato nunca sale negativo aunque las calorías no alcancen", () => {
    const apretado = macros(1500, 130, "perder");
    expect(apretado.carbo).toBeGreaterThanOrEqual(0);
    expect(apretado.recortado).toBe(true);
    expect(apretado.proteina).toBeGreaterThan(0);
    expect(apretado.grasa).toBeGreaterThan(0);
  });

  it("en el caso normal no recorta nada", () => {
    expect(m.recortado).toBe(false);
  });

  it("sin datos devuelve null en vez de ceros engañosos", () => {
    expect(macros(0, PESO, "perder")).toBeNull();
    expect(macros(2600, 0, "perder")).toBeNull();
  });
});

describe("reparto en comidas", () => {
  const m = macros(2900, PESO, "recomposicion");

  it("hay plantillas de 3, 4 y 5 comidas", () => {
    expect(Object.keys(PLANTILLAS)).toEqual(["3", "4", "5"]);
  });

  it("cada plantilla reparte el 100% de las calorías y de la proteína", () => {
    Object.values(PLANTILLAS).forEach((p) => {
      expect(p.reduce((a, c) => a + c.kcal, 0)).toBeCloseTo(1, 2);
      expect(p.reduce((a, c) => a + c.prot, 0)).toBeCloseTo(1, 2);
    });
  });

  it("los totales del reparto cuadran exactamente con los del día", () => {
    [3, 4, 5].forEach((n) => {
      const comidas = repartirComidas(m, n);
      expect(comidas).toHaveLength(n);
      ["calorias", "proteina", "grasa", "carbo"].forEach((k) => {
        expect(comidas.reduce((a, c) => a + c[k], 0), `${n} comidas, ${k}`).toBe(m[k]);
      });
    });
  });

  it("ninguna toma de proteína se queda ridícula ni se dispara", () => {
    // Repartirla en tomas parejas estimula más síntesis que concentrarla.
    repartirComidas(m, 4).forEach((c) => {
      expect(c.proteina).toBeGreaterThan(m.proteina * 0.15);
      expect(c.proteina).toBeLessThan(m.proteina * 0.45);
    });
  });

  it("un número de comidas desconocido cae en la plantilla de 4", () => {
    expect(repartirComidas(m, 9)).toHaveLength(4);
  });

  it("sin macros no revienta", () => {
    expect(repartirComidas(null, 4)).toEqual([]);
  });
});

describe("equivalencias de alimentos", () => {
  it("traduce gramos de proteína a gramos de alimento", () => {
    const pollo = FUENTES_PROTEINA.find((f) => f.nombre === "Pechuga de pollo");
    expect(porcionPara(31, pollo)).toBe(100);
    expect(porcionPara(62, pollo)).toBe(200);
  });

  it("todas las fuentes declaran su proteína por 100 g", () => {
    FUENTES_PROTEINA.forEach((f) => {
      expect(f.porCien).toBeGreaterThan(0);
      expect(f.nombre).toBeTruthy();
    });
  });

  it("sin datos devuelve 0", () => {
    expect(porcionPara(0, FUENTES_PROTEINA[0])).toBe(0);
    expect(porcionPara(30, null)).toBe(0);
  });
});

describe("tendencia del peso", () => {
  const serie = (valores, desde = "2026-10-01") =>
    valores.map((kg, i) => {
      const d = new Date(desde + "T12:00:00Z");
      d.setUTCDate(d.getUTCDate() + i);
      return { fecha: d.toISOString().slice(0, 10), kg };
    });

  it("la media móvil suaviza el ruido diario", () => {
    // El peso oscila kilo y medio por agua y sal; sin suavizar es ruido.
    const m = mediaMovil(serie([110, 111.5, 109.5, 110.2, 110.8, 109.8, 110.1]));
    expect(m).toHaveLength(7);
    expect(m[6].media).toBeCloseTo(110.27, 1);
    expect(Math.abs(m[6].media - m[6].peso)).toBeLessThan(1.5);
  });

  it("ordena por fecha aunque lleguen revueltos", () => {
    const m = mediaMovil([
      { fecha: "2026-10-05", kg: 109 },
      { fecha: "2026-10-01", kg: 110 }
    ]);
    expect(m[0].fecha).toBe("2026-10-01");
  });

  it("calcula el cambio por semana", () => {
    const t = tendencia(serie(Array.from({ length: 15 }, (_, i) => 110 - i * 0.1)));
    expect(t.kgPorSemana).toBeLessThan(0);
    expect(t.dias).toBe(14);
  });

  it("no opina con pocos días: dos básculas no son una tendencia", () => {
    expect(tendencia(serie([110, 109.5]))).toBeNull();
    expect(tendencia([])).toBeNull();
  });

  it("predice el cambio esperado desde el déficit", () => {
    // Un déficit de 500 kcal diarias son 3500 a la semana.
    expect(cambioEsperado(2700, 3200)).toBeCloseTo((-500 * 7) / KCAL_POR_KG_GRASA, 2);
    expect(cambioEsperado(3200, 3200)).toBe(0);
  });
});

describe("ajuste contra la báscula", () => {
  const serieDe = (kgPorSemana, dias = 21) =>
    Array.from({ length: dias }, (_, i) => {
      const d = new Date("2026-10-01T12:00:00Z");
      d.setUTCDate(d.getUTCDate() + i);
      return { fecha: d.toISOString().slice(0, 10), kg: 110 + (kgPorSemana / 7) * i };
    });

  it("si la realidad coincide con lo previsto, no toca nada", () => {
    const esperado = cambioEsperado(2900, 3200);
    const a = ajustePorTendencia(serieDe(esperado), 2900, 3200, "recomposicion");
    expect(a.aplicar).toBe(false);
    expect(a.delta).toBe(0);
  });

  it("si no baja nada, recorta calorías", () => {
    const a = ajustePorTendencia(serieDe(0), 2900, 3200, "perder");
    expect(a.aplicar).toBe(true);
    expect(a.delta).toBeLessThan(0);
  });

  it("si baja demasiado rápido, SUBE calorías: eso es músculo yéndose", () => {
    const a = ajustePorTendencia(serieDe(-1.5), 2900, 3200, "perder");
    expect(a.aplicar).toBe(true);
    expect(a.delta).toBeGreaterThan(0);
    expect(a.motivo).toMatch(/músculo/);
  });

  it("el ajuste está acotado para no dar bandazos", () => {
    const a = ajustePorTendencia(serieDe(-4), 2900, 3200, "perder");
    expect(Math.abs(a.delta)).toBeLessThanOrEqual(AJUSTE_MAXIMO_KCAL);
  });

  it("sin suficientes días no propone nada", () => {
    expect(ajustePorTendencia(serieDe(-0.5, 4), 2900, 3200, "perder")).toBeNull();
  });

  it("detecta una pérdida más rápida del 1% del peso por semana", () => {
    expect(perdidaDemasiadoRapida(-1.5, 110)).toBe(true);
    expect(perdidaDemasiadoRapida(-0.5, 110)).toBe(false);
    expect(perdidaDemasiadoRapida(0.5, 110)).toBe(false);
  });
});

describe("migración v8 a v9", () => {
  it("agrega pesos y configuración de nutrición", () => {
    const v9 = migrar({ esquema: 8, sesiones: {} });
    expect(v9.esquema).toBe(ESQUEMA_ACTUAL);
    expect(v9.pesos).toEqual([]);
    expect(v9.nutricion.objetivo).toBe("recomposicion");
    expect(v9.nutricion.sexo).toBe("hombre");
  });

  it("respeta una configuración ya guardada y completa lo que falte", () => {
    const v9 = migrar({ esquema: 8, sesiones: {}, nutricion: { objetivo: "ganar" } });
    expect(v9.nutricion.objetivo).toBe("ganar");
    expect(v9.nutricion.comidas).toBe(4);
  });

  it("una base v1 llega hasta v9 sin perder nada del camino", () => {
    const v9 = migrar({
      sesiones: { "push|2026-10-01": { fecha: "2026-10-01", ej: { pu1: [{ p: 60, r: 8, ok: true }] } } }
    });
    expect(v9.esquema).toBe(ESQUEMA_ACTUAL);
    expect(v9.sesiones["push|2026-10-01|1"].ej.pu1[0].p).toBe(60);
    expect(v9.sesiones["push|2026-10-01|1"].notas.sueno).toBeNull();
    expect(v9.carreras).toEqual([]);
    expect(v9.plan).toBeNull();
    expect(v9.ajustes.diasLiberados).toEqual([]);
    expect(v9.pesos).toEqual([]);
  });

  it("el respaldo fusiona los pesos sin duplicar fechas", () => {
    const base = migrar({ esquema: 9, sesiones: {}, pesos: [{ fecha: "2026-10-01", kg: 110 }] });
    const otro = migrar({
      esquema: 9,
      sesiones: {},
      pesos: [{ fecha: "2026-10-01", kg: 110 }, { fecha: "2026-10-02", kg: 109.8 }]
    });
    const { datos } = importarJSON(exportarJSON(otro), base);
    expect(datos.pesos).toHaveLength(2);
    expect(datos.pesos[0].fecha).toBe("2026-10-01");
  });

  it("el respaldo trae la configuración de nutrición", () => {
    const otro = migrar({ esquema: 9, sesiones: {}, nutricion: { altura: 182, objetivo: "perder" } });
    const { datos } = importarJSON(exportarJSON(otro), migrar({ esquema: 9, sesiones: {} }));
    expect(datos.nutricion.altura).toBe(182);
    expect(datos.nutricion.objetivo).toBe("perder");
  });
});
