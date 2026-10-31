import { describe, it, expect } from "vitest";
import rutinaReal from "../src/datos/rutina.json";
import {
  GRUPOS, semanaISO, lunesDe, indiceGrupos, volumenDeSemana,
  semanasConDatos, estado, rangoDe, resumen, volumenPlaneado
} from "../src/logica/volumen.js";

const S = (ok = true) => ({ p: 60, r: 8, ok });
const serie = (n, ok = true) => Array.from({ length: n }, () => S(ok));

const rutina = {
  dias: [
    {
      id: "push",
      ejercicios: [
        { id: "pu1", grupo: "pecho", secundarios: ["triceps", "hombro"], series: 4 },
        { id: "pu5", grupo: "hombro", series: 4 }
      ]
    },
    {
      id: "legs",
      ejercicios: [{ id: "lg1", grupo: "cuadriceps", secundarios: ["gluteo"], series: 4 }]
    }
  ]
};

describe("semanas ISO", () => {
  it("agrupa de lunes a domingo", () => {
    expect(semanaISO("2026-10-12")).toBe(semanaISO("2026-10-18")); // lunes y domingo
    expect(semanaISO("2026-10-12")).not.toBe(semanaISO("2026-10-19"));
  });

  it("maneja el cambio de año sin inventar semanas", () => {
    // El 1 de enero de 2027 es viernes: pertenece a la semana 53 de 2026.
    expect(semanaISO("2027-01-01")).toBe("2026-W53");
    expect(semanaISO("2026-01-01")).toBe("2026-W01");
  });

  it("lunesDe es la inversa de semanaISO", () => {
    ["2026-10-12", "2026-03-02", "2026-12-28"].forEach((f) => {
      expect(semanaISO(lunesDe(semanaISO(f)))).toBe(semanaISO(f));
    });
    expect(lunesDe("2026-W42")).toBe("2026-10-12");
  });
});

describe("conteo de series efectivas", () => {
  const datos = {
    sesiones: {
      "push|2026-10-12|1": { fecha: "2026-10-12", ej: { pu1: serie(4), pu5: serie(4) } },
      "legs|2026-10-15|1": { fecha: "2026-10-15", ej: { lg1: serie(4) } },
      "push|2026-10-20|1": { fecha: "2026-10-20", ej: { pu1: serie(3) } }
    }
  };

  it("el grupo primario cuenta entero y el secundario la mitad", () => {
    const v = volumenDeSemana(datos, rutina, "2026-W42");
    expect(v.pecho).toBe(4);
    expect(v.triceps).toBe(2);
    expect(v.hombro).toBe(4 + 2); // 4 directas de elevaciones + 2 indirectas del press
  });

  it("solo cuenta series marcadas como hechas", () => {
    const parcial = {
      sesiones: { "push|2026-10-12|1": { fecha: "2026-10-12", ej: { pu1: [S(true), S(false), S(false)] } } }
    };
    expect(volumenDeSemana(parcial, rutina, "2026-W42").pecho).toBe(1);
  });

  it("separa las semanas", () => {
    expect(volumenDeSemana(datos, rutina, "2026-W43").pecho).toBe(3);
    expect(volumenDeSemana(datos, rutina, "2026-W43").cuadriceps).toBeUndefined();
  });

  it("ignora ejercicios que no están en la rutina", () => {
    const raro = { sesiones: { "x|2026-10-12|1": { fecha: "2026-10-12", ej: { zz9: serie(4) } } } };
    expect(volumenDeSemana(raro, rutina, "2026-W42")).toEqual({});
  });

  it("lista las semanas con datos en orden", () => {
    expect(semanasConDatos(datos)).toEqual(["2026-W42", "2026-W43"]);
  });

  it("no lista semanas sin series completadas", () => {
    const vacio = { sesiones: { "push|2026-10-12|1": { fecha: "2026-10-12", ej: { pu1: serie(3, false) } } } };
    expect(semanasConDatos(vacio)).toEqual([]);
  });
});

describe("estado contra el rango de referencia", () => {
  it("clasifica bajo, dentro y alto", () => {
    expect(estado("pecho", 6)).toBe("bajo");
    expect(estado("pecho", 14)).toBe("dentro");
    expect(estado("pecho", 24)).toBe("alto");
  });

  it("los límites cuentan como dentro", () => {
    expect(estado("pecho", 10)).toBe("dentro");
    expect(estado("pecho", 20)).toBe("dentro");
  });

  it("core y gemelo tienen un piso más bajo", () => {
    expect(rangoDe("core").min).toBe(6);
    expect(estado("core", 7)).toBe("dentro");
    expect(estado("pecho", 7)).toBe("bajo");
  });
});

describe("resumen para la vista", () => {
  const datos = {
    sesiones: { "push|2026-10-12|1": { fecha: "2026-10-12", ej: { pu1: serie(4), pu5: serie(4) } } }
  };

  it("incluye todos los grupos de la rutina, aunque esta semana estén en cero", () => {
    const r = resumen(datos, rutina, "2026-W42");
    const grupos = r.map((x) => x.grupo).sort();
    expect(grupos).toEqual(["cuadriceps", "gluteo", "hombro", "pecho", "triceps"]);
    expect(r.find((x) => x.grupo === "cuadriceps").series).toBe(0);
  });

  it("pone primero los grupos que van bajos, que son los accionables", () => {
    expect(resumen(datos, rutina, "2026-W42")[0].estado).toBe("bajo");
  });

  it("trae nombre legible y rango listo para pintar", () => {
    const pecho = resumen(datos, rutina, "2026-W42").find((x) => x.grupo === "pecho");
    expect(pecho.nombre).toBe("Pecho");
    expect(pecho.rango).toEqual({ min: 10, max: 20 });
  });
});

describe("la rutina real de Tadeo", () => {
  it("cada ejercicio tiene grupo muscular asignado", () => {
    rutinaReal.dias
      .filter((d) => d.ejercicios)
      .forEach((d) => {
        d.ejercicios.forEach((e) => {
          expect(e.grupo, `${d.id}/${e.id} sin grupo`).toBeTruthy();
          expect(Object.keys(GRUPOS), `${e.id}: grupo desconocido "${e.grupo}"`).toContain(e.grupo);
          (e.secundarios || []).forEach((g) => {
            expect(Object.keys(GRUPOS), `${e.id}: secundario desconocido "${g}"`).toContain(g);
            expect(g, `${e.id}: ${g} es primario y secundario a la vez`).not.toBe(e.grupo);
          });
        });
      });
  });

  it("el índice cubre los 28 ejercicios", () => {
    expect(Object.keys(indiceGrupos(rutinaReal))).toHaveLength(28);
  });

  it("completando el plan, ningún grupo queda en cero", () => {
    const plan = volumenPlaneado(rutinaReal);
    Object.keys(GRUPOS).forEach((g) => {
      expect(plan[g], `${g} sin volumen planeado`).toBeGreaterThan(0);
    });
  });

  it("el plan queda dentro de rango en todos los grupos salvo el gemelo", () => {
    // El gemelo lleva 4 series directas a propósito: con 3 días de carrera a la
    // semana ya recibe estímulo de sobra. Es la única excepción aceptada.
    const plan = volumenPlaneado(rutinaReal);
    Object.entries(plan).forEach(([grupo, series]) => {
      if (grupo === "gemelo") return;
      expect(estado(grupo, series), `${grupo} con ${series} series`).toBe("dentro");
    });
  });

  it("isquios no se queda atrás del cuádriceps: desbalance = rodilla en riesgo al correr", () => {
    const plan = volumenPlaneado(rutinaReal);
    expect(plan.isquios).toBeGreaterThanOrEqual(10);
    expect(plan.cuadriceps / plan.isquios).toBeLessThan(2);
  });
});
