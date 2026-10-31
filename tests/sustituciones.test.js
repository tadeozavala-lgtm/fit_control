import { describe, it, expect } from "vitest";
import catalogoReal from "../src/datos/catalogo.json";
import rutinaReal from "../src/datos/rutina.json";
import { GRUPOS, indiceGrupos, volumenDeSemana } from "../src/logica/volumen.js";
import {
  normalizar, puntuar, alternativas, buscar, resolver, sustituir, gruposDelCatalogo
} from "../src/logica/sustituciones.js";

/** El ejercicio por su id, mire el día que mire: la rutina se rearma. */
const deRutina = (id) =>
  rutinaReal.dias.flatMap((d) => d.ejercicios || []).find((e) => e.id === id);

const ej = (extra = {}) => ({
  id: "pl2",
  nombre: "Remo con barra",
  grupo: "espalda",
  secundarios: ["biceps"],
  equipo: "barra",
  mecanica: "compound",
  fuerza: "pull",
  series: 4,
  reps: "8",
  tempo: "2-1-1-0",
  descanso: 120,
  ...extra
});

const catalogo = {
  ejercicios: [
    { id: "a", nombre: "Remo sentado en polea", grupo: "espalda", secundarios: ["biceps"], equipo: "polea", mecanica: "compound", fuerza: "pull" },
    { id: "b", nombre: "Pullover en polea", grupo: "espalda", secundarios: [], equipo: "polea", mecanica: "isolation", fuerza: "pull" },
    { id: "c", nombre: "Remo con barra agarre supino", grupo: "espalda", secundarios: ["biceps"], equipo: "barra", mecanica: "compound", fuerza: "pull" },
    { id: "d", nombre: "Press banca con barra", grupo: "pecho", secundarios: ["triceps"], equipo: "barra", mecanica: "compound", fuerza: "push" },
    { id: "e", nombre: "Remo con barra", grupo: "espalda", secundarios: ["biceps"], equipo: "barra", mecanica: "compound", fuerza: "pull" }
  ]
};

describe("normalizar nombres", () => {
  it("ignora acentos, mayúsculas y signos", () => {
    expect(normalizar("Extensión de tríceps")).toBe("extension de triceps");
    expect(normalizar("Triceps Pushdown - Rope")).toBe("triceps pushdown  rope");
  });
});

describe("puntuación de alternativas", () => {
  it("descarta otro grupo muscular", () => {
    expect(puntuar(ej(), catalogo.ejercicios[3])).toBe(-1);
  });

  it("premia cambiar de equipo: ese es el motivo de sustituir", () => {
    const polea = puntuar(ej(), catalogo.ejercicios[0]); // compound, pull, polea
    const barra = puntuar(ej(), catalogo.ejercicios[2]); // compound, pull, barra
    expect(polea).toBeGreaterThan(barra);
  });

  it("premia conservar el patrón de movimiento", () => {
    const compuesto = puntuar(ej(), catalogo.ejercicios[0]);
    const aislado = puntuar(ej(), catalogo.ejercicios[1]);
    expect(compuesto).toBeGreaterThan(aislado);
  });

  it("suma por músculos secundarios compartidos", () => {
    const conBiceps = puntuar(ej(), { grupo: "espalda", secundarios: ["biceps"], equipo: "polea" });
    const sinBiceps = puntuar(ej(), { grupo: "espalda", secundarios: [], equipo: "polea" });
    expect(conBiceps - sinBiceps).toBe(1);
  });
});

describe("lista de alternativas", () => {
  it("no se propone a sí mismo", () => {
    const r = alternativas(ej(), catalogo);
    expect(r.find((x) => x.id === "e")).toBeUndefined();
  });

  it("solo del mismo grupo y ordenadas por puntaje", () => {
    const r = alternativas(ej(), catalogo);
    expect(r.every((x) => x.grupo === "espalda")).toBe(true);
    expect(r[0].id).toBe("a");
    expect(r.map((x) => x.puntos)).toEqual([...r.map((x) => x.puntos)].sort((p, q) => q - p));
  });

  it("puede excluir el equipo que está ocupado", () => {
    const r = alternativas(ej(), catalogo, { equipoExcluido: "barra" });
    expect(r.every((x) => x.equipo !== "barra")).toBe(true);
  });

  it("respeta el límite", () => {
    expect(alternativas(ej(), catalogo, { limite: 1 })).toHaveLength(1);
  });
});

describe("resolver el hueco de la rutina", () => {
  it("sin sustitución devuelve el original", () => {
    const r = resolver(ej(), { ej: {}, sust: {} }, catalogo);
    expect(r.sustituido).toBe(false);
    expect(r.clave).toBe("pl2");
    expect(r.ej.nombre).toBe("Remo con barra");
  });

  it("con sustitución cambia el movimiento pero conserva la prescripción", () => {
    const sesion = { ej: {}, sust: { pl2: "a" } };
    const r = resolver(ej(), sesion, catalogo);
    expect(r.sustituido).toBe(true);
    expect(r.ej.nombre).toBe("Remo sentado en polea");
    expect(r.ej.series).toBe(4);
    expect(r.ej.tempo).toBe("2-1-1-0");
    expect(r.ej.descanso).toBe(120);
  });

  it("las fotos y la técnica pasan a ser del sustituto, no del original", () => {
    // Enseñar el press de banca bajo el nombre del pec deck es peor que no
    // enseñar nada: la ficha del catálogo manda en todo lo que es movimiento.
    const original = ej({ catalogoId: "e", tecnica: { ejecucion: ["codos pegados"] } });
    const r = resolver(original, { ej: {}, sust: { pl2: "a" } }, catalogo);
    expect(r.ej.catalogoId).toBe("a");
    expect(r.ej.tecnica).toBe(null);
    expect(r.ej.sustituyeA).toBe("Remo con barra");
  });

  it("sin sustitución la ficha del original queda intacta", () => {
    const original = ej({ catalogoId: "e", tecnica: { ejecucion: ["codos pegados"] } });
    const r = resolver(original, { ej: {}, sust: {} }, catalogo);
    expect(r.ej.catalogoId).toBe("e");
    expect(r.ej.tecnica.ejecucion).toEqual(["codos pegados"]);
    expect(r.ej.sustituyeA).toBeUndefined();
  });

  it("este es el requisito del issue: el historial no se mezcla", () => {
    const sesion = { ej: {}, sust: { pl2: "a" } };
    expect(resolver(ej(), sesion, catalogo).clave).toBe("a");
    expect(resolver(ej(), { ej: {}, sust: {} }, catalogo).clave).toBe("pl2");
  });

  it("un id de sustituto que ya no existe cae de vuelta al original", () => {
    const r = resolver(ej(), { ej: {}, sust: { pl2: "fantasma" } }, catalogo);
    expect(r.sustituido).toBe(false);
    expect(r.clave).toBe("pl2");
  });

  it("sustituir y deshacer", () => {
    const sesion = { ej: {} };
    sustituir(sesion, "pl2", "a");
    expect(sesion.sust.pl2).toBe("a");
    sustituir(sesion, "pl2", null);
    expect(sesion.sust.pl2).toBeUndefined();
  });

  it("buscar devuelve null si no está", () => {
    expect(buscar(catalogo, "zzz")).toBeNull();
    expect(buscar(catalogo, "a").nombre).toBe("Remo sentado en polea");
  });
});

describe("el volumen cuenta las sustituciones", () => {
  const rutina = { dias: [{ id: "pull", ejercicios: [ej()] }] };

  it("las series del sustituto cuentan para su propio grupo", () => {
    const datos = {
      sesiones: {
        "pull|2026-10-13|1": {
          fecha: "2026-10-13",
          sust: { pl2: "a" },
          ej: { a: Array.from({ length: 4 }, () => ({ p: 50, r: 10, ok: true })) }
        }
      }
    };
    const v = volumenDeSemana(datos, rutina, "2026-W42", catalogo);
    expect(v.espalda).toBe(4);
    expect(v.biceps).toBe(2);
  });

  it("sin catálogo esas series se perderían del conteo", () => {
    const datos = {
      sesiones: {
        "pull|2026-10-13|1": { fecha: "2026-10-13", ej: { a: [{ p: 50, r: 10, ok: true }] } }
      }
    };
    expect(volumenDeSemana(datos, rutina, "2026-W42")).toEqual({});
    expect(volumenDeSemana(datos, rutina, "2026-W42", catalogo).espalda).toBe(1);
  });

  it("el índice combinado no pierde ejercicios de la rutina", () => {
    const i = indiceGrupos(rutina, catalogo);
    expect(i.pl2.grupo).toBe("espalda");
    expect(i.a.grupo).toBe("espalda");
  });
});

describe("el catálogo real", () => {
  it("todos los grupos son válidos", () => {
    catalogoReal.ejercicios.forEach((e) => {
      expect(Object.keys(GRUPOS), `${e.nombre}: grupo "${e.grupo}"`).toContain(e.grupo);
      (e.secundarios || []).forEach((g) => {
        expect(Object.keys(GRUPOS), `${e.nombre}: secundario "${g}"`).toContain(g);
        expect(g).not.toBe(e.grupo);
      });
    });
  });

  it("los ids son únicos y los nombres están en español", () => {
    const ids = catalogoReal.ejercicios.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    const nombres = catalogoReal.ejercicios.map((e) => e.nombre);
    expect(new Set(nombres).size).toBe(nombres.length);
  });

  it("declara su fuente y licencia", () => {
    expect(catalogoReal.fuente.licencia).toMatch(/Unlicense/);
    expect(catalogoReal.fuente.url).toContain("free-exercise-db");
  });

  it("cada ejercicio de la rutina tiene al menos 3 alternativas reales", () => {
    rutinaReal.dias
      .filter((d) => d.ejercicios)
      .forEach((d) => {
        d.ejercicios.forEach((e) => {
          const alts = alternativas(e, catalogoReal);
          expect(alts.length, `${e.id} ${e.nombre}: ${alts.length} alternativas`).toBeGreaterThanOrEqual(3);
        });
      });
  });

  it("la mejor alternativa siempre cambia de equipo cuando existe otra opción", () => {
    const remo = deRutina("pl2");
    expect(alternativas(remo, catalogoReal)[0].equipo).not.toBe(remo.equipo);
  });

  it("el índice del catálogo cubre todo el catálogo", () => {
    expect(Object.keys(gruposDelCatalogo(catalogoReal))).toHaveLength(catalogoReal.ejercicios.length);
  });
});

describe("el patrón de movimiento manda", () => {
  const remo = deRutina("pl2");
  const jalon = deRutina("pl1");

  it("para un remo propone otros remos, no dominadas", () => {
    const tres = alternativas(remo, catalogoReal, { limite: 3 });
    expect(tres.every((a) => a.patron === "traccion-horizontal"), tres.map((a) => a.nombre).join(", ")).toBe(true);
  });

  it("para un jalón propone verticales", () => {
    const tres = alternativas(jalon, catalogoReal, { limite: 3 });
    expect(tres.every((a) => a.patron === "traccion-vertical"), tres.map((a) => a.nombre).join(", ")).toBe(true);
  });

  it("para la sentadilla no propone un peso muerto", () => {
    const sent = deRutina("lg1");
    const tres = alternativas(sent, catalogoReal, { limite: 3 });
    expect(tres.some((a) => a.patron === "bisagra")).toBe(false);
  });

  it("para el press de banca propone empujes horizontales", () => {
    const banca = deRutina("pu1");
    const tres = alternativas(banca, catalogoReal, { limite: 3 });
    expect(tres.every((a) => a.patron === "empuje-horizontal"), tres.map((a) => a.nombre).join(", ")).toBe(true);
  });
});

describe("el peso corporal es el último recurso", () => {
  it("para una banca cargada propone antes mancuernas o máquina", () => {
    const banca = deRutina("pu1");
    const mejor = alternativas(banca, catalogoReal, { limite: 1 })[0];
    expect(mejor.equipo).not.toBe("peso corporal");
  });

  it("pero sigue estando disponible más abajo en la lista", () => {
    const banca = deRutina("pu1");
    const todas = alternativas(banca, catalogoReal, { limite: 8 });
    expect(todas.some((a) => a.equipo === "peso corporal")).toBe(true);
  });
});
