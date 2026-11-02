import { describe, it, expect } from "vitest";
import rutinaReal from "../src/datos/rutina.json";
import {
  EDITABLES, CLAVES_EDITABLES, validar, ajustar, restaurar,
  aplicar, rutinaAjustada, estaAjustado, resumenCambios,
  cuantosAjustados, exportarParche
} from "../src/logica/ajustes-rutina.js";
import { migrar, ESQUEMA_ACTUAL, importarJSON, exportarJSON } from "../src/logica/almacen.js";

const ej = { id: "pu1", nombre: "Press banca con barra", series: 4, reps: "8", repMax: 8,
  tempo: "3-1-1-0", rir: 2, descanso: 120, sugerido: "55–60 kg", grupo: "pecho" };

describe("qué se puede editar", () => {
  it("solo los campos de prescripción, no el músculo ni el equipo", () => {
    expect(CLAVES_EDITABLES).toContain("series");
    expect(CLAVES_EDITABLES).toContain("descanso");
    expect(CLAVES_EDITABLES).not.toContain("grupo");
    expect(CLAVES_EDITABLES).not.toContain("equipo");
    expect(CLAVES_EDITABLES).not.toContain("id");
  });

  it("cada editable declara su tipo", () => {
    CLAVES_EDITABLES.forEach((k) => {
      expect(["numero", "texto"]).toContain(EDITABLES[k].tipo);
      expect(EDITABLES[k].etiqueta).toBeTruthy();
    });
  });
});

describe("validación", () => {
  it("acepta números en rango", () => {
    expect(validar("series", 5)).toEqual({ ok: true, valor: 5 });
    expect(validar("descanso", 90).ok).toBe(true);
  });

  it("rechaza números fuera de rango con un mensaje útil", () => {
    expect(validar("series", 0).ok).toBe(false);
    expect(validar("series", 20).error).toMatch(/Entre 1 y 10/);
    expect(validar("descanso", 5).ok).toBe(false);
  });

  it("rechaza texto donde va número", () => {
    expect(validar("series", "muchas").ok).toBe(false);
  });

  it("no deja campos de texto vacíos", () => {
    expect(validar("reps", "   ").ok).toBe(false);
  });

  it("el sugerido tiene que venir en kg o decir peso corporal", () => {
    expect(validar("sugerido", "65 kg").ok).toBe(true);
    expect(validar("sugerido", "peso corporal").ok).toBe(true);
    expect(validar("sugerido", "145 lb").ok).toBe(false);
    expect(validar("sugerido", "pesado").error).toMatch(/kg/);
  });

  it("el tempo respeta su formato", () => {
    expect(validar("tempo", "2-0-1-0").ok).toBe(true);
    expect(validar("tempo", "isométrico").ok).toBe(true);
    expect(validar("tempo", "rápido").ok).toBe(false);
  });

  it("un campo que no es editable se rechaza", () => {
    expect(validar("grupo", "pierna").ok).toBe(false);
  });
});

describe("la capa de ajustes", () => {
  it("guarda un cambio bajo el id del ejercicio", () => {
    const r = ajustar({}, "pu1", "series", 5, 4);
    expect(r.ok).toBe(true);
    expect(r.capa.pu1.series).toBe(5);
  });

  it("volver al valor original borra el ajuste, no lo deja redundante", () => {
    let capa = ajustar({}, "pu1", "series", 5, 4).capa;
    capa = ajustar(capa, "pu1", "series", 4, 4).capa;
    expect(capa.pu1).toBeUndefined();
  });

  it("un valor inválido no toca la capa", () => {
    const capa = ajustar({}, "pu1", "series", 4, 4).capa;
    const r = ajustar(capa, "pu1", "series", 99, 4);
    expect(r.ok).toBe(false);
    expect(r.capa).toBeUndefined();
  });

  it("acumula varios campos del mismo ejercicio", () => {
    let capa = ajustar({}, "pu1", "series", 5, 4).capa;
    capa = ajustar(capa, "pu1", "descanso", 90, 120).capa;
    expect(capa.pu1).toEqual({ series: 5, descanso: 90 });
  });

  it("restaurar quita todo lo del ejercicio y deja a los demás", () => {
    let capa = ajustar({}, "pu1", "series", 5, 4).capa;
    capa = ajustar(capa, "pu2", "series", 4, 3).capa;
    capa = restaurar(capa, "pu1");
    expect(capa.pu1).toBeUndefined();
    expect(capa.pu2.series).toBe(4);
  });
});

describe("aplicar la capa", () => {
  it("sobrescribe solo lo ajustado", () => {
    const r = aplicar(ej, { pu1: { series: 5, descanso: 90 } });
    expect(r.series).toBe(5);
    expect(r.descanso).toBe(90);
    expect(r.reps).toBe("8");
    expect(r.grupo).toBe("pecho");
  });

  it("sin ajustes devuelve el mismo objeto, sin copiar de más", () => {
    expect(aplicar(ej, {})).toBe(ej);
    expect(aplicar(ej, null)).toBe(ej);
  });

  it("nunca muta el ejercicio original", () => {
    aplicar(ej, { pu1: { series: 9 } });
    expect(ej.series).toBe(4);
  });

  it("este es el punto de la capa: un ejercicio nuevo del repo se hereda igual", () => {
    // Si mañana se despliega la rutina con un ejercicio añadido, aparece solo.
    // Una copia completa de la rutina guardada en el teléfono lo perdería.
    const conNuevo = {
      dias: [{ id: "push", ejercicios: [ej, { id: "pu9", nombre: "Nuevo", series: 3 }] }]
    };
    const r = rutinaAjustada(conNuevo, { pu1: { series: 5 } });
    expect(r.dias[0].ejercicios).toHaveLength(2);
    expect(r.dias[0].ejercicios[0].series).toBe(5);
    expect(r.dias[0].ejercicios[1].nombre).toBe("Nuevo");
  });

  it("los días sin ejercicios pasan intactos", () => {
    const r = rutinaAjustada({ dias: [{ id: "z2", tipo: "cardio" }] }, { pu1: { series: 5 } });
    expect(r.dias[0].tipo).toBe("cardio");
  });

  it("la rutina real aguanta la capa sin perder días ni ejercicios", () => {
    const r = rutinaAjustada(rutinaReal, { pu1: { series: 5 }, lg1: { descanso: 180 } });
    expect(r.dias).toHaveLength(rutinaReal.dias.length);
    const torsoA = r.dias.find((d) => d.id === "torsoA");
    expect(torsoA.ejercicios.find((e) => e.id === "pu1").series).toBe(5);
    const torsoB = r.dias.find((d) => d.id === "torsoB");
    expect(torsoB.ejercicios.find((e) => e.id === "pu2").series).toBe(3);
  });
});

describe("señales para la interfaz", () => {
  const capa = { pu1: { series: 5, descanso: 90 } };

  it("dice qué ejercicios están ajustados", () => {
    expect(estaAjustado(capa, "pu1")).toBe(true);
    expect(estaAjustado(capa, "pu2")).toBe(false);
    expect(cuantosAjustados(capa)).toBe(1);
    expect(cuantosAjustados({})).toBe(0);
  });

  it("resume el cambio mostrando de dónde a dónde", () => {
    const t = resumenCambios(capa, "pu1", ej);
    expect(t).toMatch(/Series 4 → 5/);
    expect(t).toMatch(/Descanso \(s\) 120 → 90/);
  });

  it("sin ajustes el resumen va vacío", () => {
    expect(resumenCambios({}, "pu1", ej)).toBe("");
  });
});

describe("exportar para commitear", () => {
  it("imprime el id, el campo y el valor anterior", () => {
    const t = exportarParche({ pu1: { series: 5 } }, rutinaReal);
    expect(t).toMatch(/pu1/);
    expect(t).toMatch(/"series": 5/);
    expect(t).toMatch(/antes: 4/);
  });

  it("marca un ejercicio que ya no está en la rutina", () => {
    expect(exportarParche({ zzz: { series: 5 } }, rutinaReal)).toMatch(/ya no está/);
  });
});

describe("migración v5 a v6", () => {
  it("agrega la capa vacía", () => {
    const v6 = migrar({ esquema: 5, sesiones: {} });
    expect(v6.esquema).toBe(ESQUEMA_ACTUAL);
    expect(v6.ajustesRutina).toEqual({});
  });

  it("una base v1 llega hasta v6 sin perder nada por el camino", () => {
    const v6 = migrar({
      sesiones: { "push|2026-10-01": { fecha: "2026-10-01", ej: { pu1: [{ p: 60, r: 8, ok: true }] } } }
    });
    expect(v6.esquema).toBe(ESQUEMA_ACTUAL);
    expect(v6.sesiones["push|2026-10-01|1"].ej.pu1[0].p).toBe(60);
    expect(v6.sesiones["push|2026-10-01|1"].notas.sueno).toBeNull();
    expect(v6.carreras).toEqual([]);
    expect(v6.ajustesRutina).toEqual({});
  });

  it("el respaldo se lleva los ajustes de rutina", () => {
    const otro = migrar({ esquema: 6, sesiones: {}, ajustesRutina: { pu1: { series: 5 } } });
    const { datos } = importarJSON(exportarJSON(otro), migrar({ esquema: 6, sesiones: {} }));
    expect(datos.ajustesRutina.pu1.series).toBe(5);
  });
});
