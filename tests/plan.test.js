import { describe, it, expect } from "vitest";
import {
  OBJETIVOS, DIAS_SEMANA, DIAS_MINIMOS, FASES, TOPE_SUBIDA,
  faseDeSemana, serieKm, respetaRegla10, descargasBajan,
  calidadDeFase, ordenarDias, repartirSemana, repartirKm,
  generar, semanasEntre, semanaActual, semanaDe, diaDeFecha,
  sesionDeHoy, resumenPlan, describir, cumplimiento, conflictos
} from "../src/logica/plan.js";

const MARCA = { km: 5, segundos: 1800 };
const TRES = ["mar", "jue", "sab"];
const COMBINACIONES = [
  ["mar", "jue", "sab"],
  ["lun", "mie", "vie"],
  ["lun", "mie", "vie", "dom"],
  ["mar", "jue", "sab", "dom"],
  ["lun", "mar", "mie", "jue", "vie"],
  ["lun", "mar", "mie", "jue", "vie", "sab"]
];

describe("objetivos", () => {
  it("cubre 5K, 10K y media maratón", () => {
    expect(Object.keys(OBJETIVOS)).toEqual(["5k", "10k", "21k"]);
  });

  it("a más distancia, más semanas y más volumen", () => {
    expect(OBJETIVOS["21k"].semanas).toBeGreaterThan(OBJETIVOS["10k"].semanas);
    expect(OBJETIVOS["10k"].semanas).toBeGreaterThan(OBJETIVOS["5k"].semanas);
    expect(OBJETIVOS["21k"].volumen.pico).toBeGreaterThan(OBJETIVOS["10k"].volumen.pico);
  });

  it("el pico siempre es mayor que el arranque", () => {
    Object.values(OBJETIVOS).forEach((o) => {
      expect(o.volumen.pico).toBeGreaterThan(o.volumen.inicio);
    });
  });
});

describe("fases", () => {
  it("arranca en base y termina en afinamiento", () => {
    expect(faseDeSemana(1, 10, 2)).toBe("base");
    expect(faseDeSemana(10, 10, 2)).toBe("afinamiento");
    expect(faseDeSemana(9, 10, 2)).toBe("afinamiento");
  });

  it("descarga cada cuarta semana", () => {
    expect(faseDeSemana(4, 12, 2)).toBe("descarga");
    expect(faseDeSemana(8, 12, 2)).toBe("descarga");
    expect(faseDeSemana(5, 12, 2)).not.toBe("descarga");
  });

  it("el afinamiento manda sobre la descarga: encadenarlas desentrena", () => {
    // Semana 12 de 12 con 2 de afinamiento: es múltiplo de 4 pero toca afinar.
    expect(faseDeSemana(12, 12, 2)).toBe("afinamiento");
  });

  it("todas las fases que produce están declaradas", () => {
    for (let n = 1; n <= 12; n++) {
      expect(Object.keys(FASES)).toContain(faseDeSemana(n, 12, 2));
    }
  });
});

describe("progresión de volumen", () => {
  it("la primera semana arranca en el volumen de inicio", () => {
    expect(serieKm(10, "10k")[0].km).toBe(OBJETIVOS["10k"].volumen.inicio);
  });

  it("nunca sube más de 10% entre semanas de carga", () => {
    ["5k", "10k", "21k"].forEach((o) => {
      expect(respetaRegla10(serieKm(OBJETIVOS[o].semanas, o)), o).toBe(true);
    });
  });

  it("este es el bug que tenía la primera versión: nada de saltos del 40% tras la descarga", () => {
    // Una recta de inicio a pico hacía que la semana posterior a una descarga
    // saltara casi 50%, justo cuando el cuerpo está menos preparado.
    const s = serieKm(12, "21k");
    const tras = s.findIndex((x) => x.fase === "descarga") + 1;
    const salto = (s[tras].km - s[tras - 1].km) / s[tras - 1].km;
    expect(salto).toBeLessThan(0.5);
    expect(respetaRegla10(s)).toBe(true);
  });

  it("las descargas siempre bajan respecto a la semana anterior", () => {
    ["5k", "10k", "21k"].forEach((o) => {
      expect(descargasBajan(serieKm(OBJETIVOS[o].semanas, o)), o).toBe(true);
    });
  });

  it("el afinamiento baja el volumen y la última semana es la más suave del final", () => {
    const s = serieKm(10, "10k");
    const afin = s.filter((x) => x.fase === "afinamiento");
    expect(afin).toHaveLength(2);
    expect(afin[1].km).toBeLessThan(afin[0].km);
    expect(afin[0].km).toBeLessThan(Math.max(...s.map((x) => x.km)));
  });

  it("nunca pasa del pico declarado", () => {
    ["5k", "10k", "21k"].forEach((o) => {
      const pico = OBJETIVOS[o].volumen.pico;
      serieKm(OBJETIVOS[o].semanas, o).forEach((s) => {
        expect(s.km).toBeLessThanOrEqual(pico + 0.1);
      });
    });
  });

  it("escala con el volumen actual del corredor", () => {
    const normal = serieKm(10, "10k", 1)[0].km;
    const masBajo = serieKm(10, "10k", 0.7)[0].km;
    expect(masBajo).toBeLessThan(normal);
  });
});

describe("tipos de sesión por fase", () => {
  it("la fase base no mete calidad: primero volumen", () => {
    expect(calidadDeFase("base", "10k")).toEqual([]);
  });

  it("la calidad aparece en construcción y sube en específico", () => {
    expect(calidadDeFase("construccion", "10k").length).toBeGreaterThan(0);
    expect(calidadDeFase("especifico", "5k").length).toBeGreaterThanOrEqual(
      calidadDeFase("construccion", "5k").length
    );
  });

  it("el 5K mete series y la media no: son adaptaciones distintas", () => {
    expect(calidadDeFase("especifico", "5k")).toContain("series");
    expect(calidadDeFase("especifico", "21k")).not.toContain("series");
  });

  it("el afinamiento solo toca ritmo objetivo", () => {
    expect(calidadDeFase("afinamiento", "10k")).toEqual(["ritmoObjetivo"]);
  });
});

describe("reparto de la semana", () => {
  it("ordena los días de lunes a domingo aunque lleguen revueltos", () => {
    expect(ordenarDias(["sab", "lun", "jue"])).toEqual(["lun", "jue", "sab"]);
  });

  it("la tirada larga va al último día libre de la semana", () => {
    const s = repartirSemana(TRES, ["tempo"], 30, 0.35);
    expect(s[s.length - 1].sesion).toBe("largo");
    expect(s[s.length - 1].dia).toBe("sab");
  });

  it("hay una sola tirada larga", () => {
    COMBINACIONES.forEach((dias) => {
      const s = repartirSemana(dias, ["tempo", "series"], 40, 0.35);
      expect(s.filter((x) => x.sesion === "largo")).toHaveLength(1);
    });
  });

  it("usa exactamente los días que se le dan, ni uno más", () => {
    COMBINACIONES.forEach((dias) => {
      const s = repartirSemana(dias, ["tempo"], 30, 0.35);
      expect(s.map((x) => x.dia)).toEqual(ordenarDias(dias));
    });
  });

  it("sin días no inventa nada", () => {
    expect(repartirSemana([], ["tempo"], 30, 0.35)).toEqual([]);
  });

  it("la suma de las sesiones cuadra con el volumen de la semana", () => {
    COMBINACIONES.forEach((dias) => {
      [12, 25.5, 47.3].forEach((km) => {
        const s = repartirSemana(dias, ["tempo", "ritmoObjetivo"], km, 0.35);
        const suma = s.reduce((a, x) => a + x.km, 0);
        expect(Math.abs(suma - km), `${dias.length} días, ${km} km`).toBeLessThan(0.05);
      });
    });
  });

  it("la tirada larga se lleva su fracción del volumen", () => {
    const s = repartirKm([{ dia: "sab", sesion: "largo" }, { dia: "mar", sesion: "facil" }], 20, 0.35);
    expect(s.find((x) => x.sesion === "largo").km).toBeCloseTo(7, 1);
  });

  it("la tirada larga es la sesión más larga de la semana", () => {
    COMBINACIONES.forEach((dias) => {
      const s = repartirSemana(dias, ["tempo"], 35, 0.4);
      const largo = s.find((x) => x.sesion === "largo");
      s.forEach((x) => expect(largo.km).toBeGreaterThanOrEqual(x.km));
    });
  });
});

describe("generar el plan", () => {
  it("devuelve un plan completo con sus semanas", () => {
    const r = generar({ objetivo: "10k", dias: TRES, marca: MARCA, hoy: "2026-10-22" });
    expect(r.ok).toBe(true);
    expect(r.plan.lista).toHaveLength(OBJETIVOS["10k"].semanas);
    expect(r.plan.lista[0].sesiones).toHaveLength(3);
  });

  it("exige un mínimo de días: con menos no se construye base", () => {
    const r = generar({ objetivo: "10k", dias: ["mar", "jue"], marca: MARCA });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(new RegExp(`${DIAS_MINIMOS} días`));
  });

  it("rechaza un objetivo que no existe", () => {
    expect(generar({ objetivo: "42k", dias: TRES }).ok).toBe(false);
  });

  it("rechaza un plazo tan corto que sería puro afinamiento", () => {
    const r = generar({ objetivo: "21k", dias: TRES, semanas: 3 });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/semanas/);
  });

  it("acepta un plazo personalizado cuando hay fecha de carrera", () => {
    const r = generar({ objetivo: "10k", dias: TRES, semanas: 7, marca: MARCA });
    expect(r.ok).toBe(true);
    expect(r.plan.lista).toHaveLength(7);
    expect(r.plan.lista[6].fase).toBe("afinamiento");
  });

  it("pone los ritmos calculados con la marca del corredor, no de una tabla", () => {
    const r = generar({ objetivo: "10k", dias: TRES, marca: MARCA });
    const s = r.plan.lista[0].sesiones[0];
    expect(s.segPorKm).toBeGreaterThan(0);
    // El rodaje fácil tiene que ser más lento que el ritmo de 5K.
    expect(s.segPorKm).toBeGreaterThan(1800 / 5);
  });

  it("sin marca genera el plan igual, pero sin ritmos", () => {
    const r = generar({ objetivo: "10k", dias: TRES });
    expect(r.ok).toBe(true);
    expect(r.plan.lista[0].sesiones[0].segPorKm).toBeNull();
  });

  it("no arranca pegando un salto sobre lo que ya corre", () => {
    const bajo = generar({ objetivo: "10k", dias: TRES, kmActuales: 10 });
    const alto = generar({ objetivo: "10k", dias: TRES, kmActuales: 28 });
    expect(bajo.plan.lista[0].km).toBeLessThan(alto.plan.lista[0].km);
    expect(bajo.plan.lista[0].km).toBeLessThan(OBJETIVOS["10k"].volumen.inicio);
  });

  it("predice el tiempo de la carrera objetivo cuando hay marca", () => {
    const r = generar({ objetivo: "21k", dias: TRES, marca: MARCA });
    expect(r.plan.prediccion).toBeGreaterThan(1800);
  });

  it("cualquier combinación válida produce un plan sano", () => {
    ["5k", "10k", "21k"].forEach((o) => {
      COMBINACIONES.forEach((dias) => {
        const r = generar({ objetivo: o, dias, marca: MARCA });
        expect(r.ok, `${o} con ${dias.length} días`).toBe(true);
        expect(respetaRegla10(r.plan.lista), `${o} ${dias}`).toBe(true);
        expect(descargasBajan(r.plan.lista), `${o} ${dias}`).toBe(true);
        r.plan.lista.forEach((s) => {
          expect(s.sesiones).toHaveLength(dias.length);
          expect(s.km).toBeGreaterThan(0);
        });
      });
    });
  });
});

describe("ubicarse en el plan", () => {
  const plan = generar({ objetivo: "10k", dias: TRES, marca: MARCA, hoy: "2026-10-05" }).plan;

  it("cuenta semanas entre fechas", () => {
    expect(semanasEntre("2026-10-05", "2026-10-12")).toBe(1);
    expect(semanasEntre("2026-10-05", "2026-10-11")).toBe(0);
  });

  it("sabe en qué semana del plan va", () => {
    expect(semanaActual(plan, "2026-10-05")).toBe(1);
    expect(semanaActual(plan, "2026-10-19")).toBe(3);
  });

  it("no se pasa de la última semana aunque la fecha siga corriendo", () => {
    expect(semanaActual(plan, "2027-05-01")).toBe(plan.semanas);
  });

  it("traduce una fecha a día de la semana", () => {
    expect(diaDeFecha("2026-10-05")).toBe("lun");
    expect(diaDeFecha("2026-10-11")).toBe("dom");
    expect(DIAS_SEMANA).toContain(diaDeFecha("2026-10-22"));
  });

  it("da la sesión que toca hoy, o nada si hoy no se corre", () => {
    expect(sesionDeHoy(plan, "2026-10-06").sesion).toBeTruthy(); // martes
    expect(sesionDeHoy(plan, "2026-10-05")).toBeNull(); // lunes, no está en los días
  });

  it("la semana de hoy es la que corresponde", () => {
    expect(semanaDe(plan, "2026-10-12").n).toBe(2);
  });
});

describe("resumen y textos", () => {
  const plan = generar({ objetivo: "21k", dias: TRES, marca: MARCA }).plan;

  it("resume totales del plan", () => {
    const r = resumenPlan(plan);
    expect(r.semanas).toBe(12);
    expect(r.porSemana).toBe(3);
    expect(r.sesiones).toBe(36);
    expect(r.kmTotal).toBeGreaterThan(r.kmPico);
  });

  it("describe una sesión con sus kilómetros y ritmo", () => {
    expect(describir({ km: 8, segPorKm: 420 })).toBe("8 km a 7:00/km");
    expect(describir({ km: 8, segPorKm: null })).toBe("8 km");
  });
});

describe("cumplimiento contra lo corrido", () => {
  const semana = { km: 30 };

  it("compara lo planeado con lo registrado", () => {
    const c = cumplimiento(semana, [{ km: 10 }, { km: 8 }]);
    expect(c.corrido).toBe(18);
    expect(c.porcentaje).toBe(60);
  });

  it("sin carreras el cumplimiento es cero, no un error", () => {
    expect(cumplimiento(semana, []).porcentaje).toBe(0);
  });

  it("sin semana planeada no divide entre cero", () => {
    expect(cumplimiento(null, [{ km: 5 }]).porcentaje).toBe(0);
  });
});

describe("conflictos con los días de fuerza", () => {
  const plan = generar({ objetivo: "10k", dias: ["mar", "jue", "sab"], marca: MARCA }).plan;

  it("avisa cuando un día tiene fuerza y carrera", () => {
    const c = conflictos(plan, ["lun", "mar", "jue"]);
    expect(c.join(" ")).toMatch(/Martes y Jueves/);
    expect(c.join(" ")).toMatch(/después de las pesas/);
  });

  it("avisa si la tirada larga cae justo tras el día de pierna", () => {
    const c = conflictos(plan, ["vie"]);
    expect(c.join(" ")).toMatch(/tirada larga/);
  });

  it("sin choques no inventa avisos", () => {
    expect(conflictos(plan, ["lun", "mie"])).toEqual([]);
  });

  it("aguanta que no haya plan o no haya días de fuerza", () => {
    expect(conflictos(null, ["lun"])).toEqual([]);
    expect(conflictos(plan, null)).toEqual([]);
  });
});
