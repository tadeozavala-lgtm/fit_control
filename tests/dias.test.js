import { describe, it, expect } from "vitest";
import rutinaReal from "../src/datos/rutina.json";
import {
  diaDeRutina, diasOcupados, rutinaSin, costoDeLiberar,
  candidatosALiberar, mejorCandidato, diasRestantes,
  puedeLiberar, MINIMO_FUERZA, compensaciones
} from "../src/logica/dias.js";
import { volumenPlaneado, estado } from "../src/logica/volumen.js";
import { migrar, ESQUEMA_ACTUAL, importarJSON, exportarJSON } from "../src/logica/almacen.js";

describe("días que ocupa la fuerza", () => {
  it("traduce el día escrito de la rutina", () => {
    expect(diaDeRutina({ dia: "Lunes" })).toEqual(["lun"]);
    expect(diaDeRutina({ dia: "Lun · Mié · Jue" })).toEqual(["lun", "mie", "jue"]);
    expect(diaDeRutina({ dia: "" })).toEqual([]);
  });

  it("la rutina real ocupa cuatro días con pesas", () => {
    expect(diasOcupados(rutinaReal).sort()).toEqual(["jue", "lun", "mar", "sab"]);
  });

  it("un día liberado deja de ocupar", () => {
    expect(diasOcupados(rutinaReal, ["full"])).not.toContain("sab");
    expect(diasOcupados(rutinaReal, ["full"])).toHaveLength(3);
  });

  it("liberar no borra el día de la rutina", () => {
    // Si Tadeo lo entrena igual, sus series tienen que seguir contando.
    expect(rutinaReal.dias.find((d) => d.id === "full")).toBeTruthy();
    expect(rutinaSin(rutinaReal, ["full"]).dias.find((d) => d.id === "full")).toBeUndefined();
  });
});

describe("costo de soltar un día", () => {
  it("cuenta las series que se pierden y qué grupos caen bajo rango", () => {
    const c = costoDeLiberar(rutinaReal, "pull");
    expect(c.nombre).toBe("Pull");
    expect(c.seriesPerdidas).toBeGreaterThan(0);
    expect(c.caenBajo).toContain("Espalda");
    expect(c.porGrupo.find((g) => g.grupo === "espalda").despues).toBeLessThan(
      c.porGrupo.find((g) => g.grupo === "espalda").antes
    );
  });

  it("el déficit mide cuánto se hunden los grupos, no cuántas series se van", () => {
    // Legs pierde más series que Pull pero lo que importa es el hundimiento.
    const pull = costoDeLiberar(rutinaReal, "pull");
    const full = costoDeLiberar(rutinaReal, "full");
    expect(full.seriesPerdidas).toBeLessThan(pull.seriesPerdidas);
    expect(full.deficit).toBeLessThan(pull.deficit);
  });

  it("un día que reparte su trabajo cuesta menos que uno que lo concentra", () => {
    const full = costoDeLiberar(rutinaReal, "full");
    const push = costoDeLiberar(rutinaReal, "push");
    expect(full.porGrupo.length).toBeGreaterThan(push.porGrupo.length);
    expect(full.deficit).toBeLessThan(push.deficit);
  });

  it("los grupos salen ordenados por lo que pierden", () => {
    const c = costoDeLiberar(rutinaReal, "legs");
    const perdidas = c.porGrupo.map((g) => g.antes - g.despues);
    expect(perdidas).toEqual([...perdidas].sort((a, b) => b - a));
  });

  it("un día que no existe o no es de fuerza devuelve null", () => {
    expect(costoDeLiberar(rutinaReal, "z2")).toBeNull();
    expect(costoDeLiberar(rutinaReal, "zzz")).toBeNull();
  });

  it("soltar un segundo día duele más que el primero", () => {
    // Las series que aporta Legs son las mismas se haya soltado Full o no, pero
    // el daño es mayor: los grupos llegan sin colchón sobre su mínimo. Por eso
    // el costo se mide siempre sobre lo que queda, no sobre la rutina entera.
    const solo = costoDeLiberar(rutinaReal, "legs");
    const tras = costoDeLiberar(rutinaReal, "legs", ["full"]);
    expect(tras.seriesPerdidas).toBe(solo.seriesPerdidas);
    expect(tras.deficit).toBeGreaterThan(solo.deficit);
  });
});

describe("a quién recomendar soltar", () => {
  it("ordena de menos a más costoso", () => {
    const lista = candidatosALiberar(rutinaReal);
    expect(lista).toHaveLength(4);
    for (let i = 1; i < lista.length; i++) {
      expect(lista[i].deficit).toBeGreaterThanOrEqual(lista[i - 1].deficit);
    }
  });

  it("recomienda Full Body: es el circuito metabólico, el más redundante con el cardio", () => {
    expect(mejorCandidato(rutinaReal).id).toBe("full");
  });

  it("nunca recomienda soltar los días que aguantan el esqueleto del split", () => {
    const lista = candidatosALiberar(rutinaReal);
    const peores = lista.slice(-2).map((c) => c.id);
    expect(peores).toContain("legs");
  });

  it("deja de recomendar cuando la fuerza bajaría de tres días", () => {
    expect(puedeLiberar(rutinaReal)).toBe(true);
    expect(puedeLiberar(rutinaReal, ["full"])).toBe(false);
    expect(mejorCandidato(rutinaReal, ["full"])).toBeNull();
  });

  it("tres días es el piso declarado", () => {
    expect(MINIMO_FUERZA).toBe(3);
    expect(diasRestantes(rutinaReal, ["full"])).toBe(MINIMO_FUERZA);
  });
});

describe("compensar lo que se pierde", () => {
  it("dice cuántas series faltan y en qué día recolocarlas", () => {
    const c = compensaciones(rutinaReal, "full");
    expect(c.length).toBeGreaterThan(0);
    c.forEach((x) => {
      expect(x.faltan).toBeGreaterThan(0);
      expect(x.texto).toMatch(/serie/);
    });
    expect(c.find((x) => x.grupo === "isquios").dia).toBe("Legs");
  });

  it("si ningún día restante entrena ese grupo, lo dice en vez de inventar", () => {
    const soloPush = { ...rutinaReal, dias: rutinaReal.dias.filter((d) => ["push", "legs"].includes(d.id)) };
    const c = compensaciones(soloPush, "legs");
    c.forEach((x) => {
      if (!x.dia) expect(x.texto).toMatch(/ningún día/);
    });
  });

  it("sin grupos caídos no propone nada", () => {
    const sinDanio = { ...rutinaReal, dias: rutinaReal.dias.filter((d) => d.id !== "full") };
    // Quitar un día ya quitado no vuelve a hundir nada.
    expect(compensaciones(sinDanio, "zzz")).toEqual([]);
  });

  it("aplicar las compensaciones devuelve los grupos a su rango", () => {
    // Comprobación de que el número propuesto es suficiente, no simbólico.
    const despues = volumenPlaneado(rutinaSin(rutinaReal, ["full"]));
    compensaciones(rutinaReal, "full").forEach((c) => {
      const conCompensacion = (despues[c.grupo] || 0) + c.faltan;
      expect(estado(c.grupo, conCompensacion), c.grupo).not.toBe("bajo");
    });
  });
});

describe("migración v7 a v8", () => {
  it("agrega la lista de días liberados vacía", () => {
    const v8 = migrar({ esquema: 7, sesiones: {} });
    expect(v8.esquema).toBe(ESQUEMA_ACTUAL);
    expect(v8.ajustes.diasLiberados).toEqual([]);
  });

  it("respeta unos días ya liberados", () => {
    const v8 = migrar({ esquema: 7, sesiones: {}, ajustes: { fcReposo: 58, diasLiberados: ["full"] } });
    expect(v8.ajustes.diasLiberados).toEqual(["full"]);
    expect(v8.ajustes.fcReposo).toBe(58);
  });

  it("una base v1 llega hasta v8 con todo lo del camino intacto", () => {
    const v8 = migrar({
      sesiones: { "push|2026-10-01": { fecha: "2026-10-01", ej: { pu1: [{ p: 60, r: 8, ok: true }] } } }
    });
    expect(v8.esquema).toBe(ESQUEMA_ACTUAL);
    expect(v8.sesiones["push|2026-10-01|1"].ej.pu1[0].p).toBe(60);
    expect(v8.sesiones["push|2026-10-01|1"].notas.sueno).toBeNull();
    expect(v8.carreras).toEqual([]);
    expect(v8.plan).toBeNull();
    expect(v8.ajustes.diasLiberados).toEqual([]);
  });

  it("el respaldo se lleva los días liberados", () => {
    const otro = migrar({ esquema: 8, sesiones: {}, ajustes: { diasLiberados: ["full"] } });
    const { datos } = importarJSON(exportarJSON(otro), migrar({ esquema: 8, sesiones: {} }));
    expect(datos.ajustes.diasLiberados).toEqual(["full"]);
  });
});
