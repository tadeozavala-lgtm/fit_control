import { describe, it, expect } from "vitest";
import rutinaReal from "../src/datos/rutina.json";
import {
  MODALIDADES, PROTOCOLOS, modalidad, modalidadesPara, protocolo, protocolosPara,
  fcMaxDe, secuenciaDe, choqueConFuerza, ordenarDias, etiquetaDias,
  CARDIO_POR_DEFECTO, configDe, cardioDelDia, diasDeCardio, resumenSemanal, minutosZ2
} from "../src/logica/cardio.js";
import { construirSecuencia, duracion } from "../src/logica/secuencia.js";
import { zonasKarvonen, fcMaxEstimada } from "../src/logica/carrera.js";
import { migrar, ESQUEMA_ACTUAL, vacio } from "../src/logica/almacen.js";

/**
 * El cardio de Tadeo busca salud cardiovascular, no un tiempo en carrera. Eso
 * hace que la modalidad y el día sean intercambiables, y estos tests fijan las
 * dos cosas que NO lo son: las zonas cambian con la modalidad y el aviso de
 * choque con la fuerza tiene que seguir saliendo.
 */

describe("catálogo de modalidades", () => {
  it("todas traen lo que la vista necesita", () => {
    MODALIDADES.forEach((m) => {
      expect(m.id, m.nombre).toBeTruthy();
      expect(m.nombre).toBeTruthy();
      expect(["alto", "bajo", "nulo"], m.nombre).toContain(m.impacto);
      expect(typeof m.ajusteFcMax, m.nombre).toBe("number");
      expect(m.met, m.nombre).toBeGreaterThan(0);
      expect(m.metFuerte, m.nombre).toBeGreaterThanOrEqual(m.met);
      expect(Array.isArray(m.carga), m.nombre).toBe(true);
      expect(m.porQue && m.ojo, m.nombre).toBeTruthy();
      expect(m.z2 || m.hiit, m.nombre).toBe(true);
    });
  });

  it("los ids no se repiten", () => {
    const ids = MODALIDADES.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("hay opciones sin impacto para las dos cosas", () => {
    expect(modalidadesPara("z2").filter((m) => m.impacto === "nulo").length).toBeGreaterThan(1);
    expect(modalidadesPara("hiit").filter((m) => m.impacto === "nulo").length).toBeGreaterThan(0);
  });

  it("correr es la referencia: no corrige nada", () => {
    expect(modalidad("carrera").ajusteFcMax).toBe(0);
  });

  it("ninguna modalidad sube la máxima por encima de la de correr", () => {
    // Si alguna lo hiciera, estaríamos mandando a entrenar más alto de lo que
    // el corazón llega en esa actividad.
    MODALIDADES.forEach((m) => expect(m.ajusteFcMax, m.nombre).toBeLessThanOrEqual(0));
  });
});

describe("la máxima cambia con la modalidad", () => {
  const fcMaxCarrera = fcMaxEstimada(44); // 177

  it("en bici se alcanzan menos pulsaciones que corriendo", () => {
    expect(fcMaxDe("bici", fcMaxCarrera)).toBeLessThan(fcMaxDe("carrera", fcMaxCarrera));
  });

  it("nadando es donde más baja", () => {
    const todas = MODALIDADES.map((m) => fcMaxDe(m.id, fcMaxCarrera));
    expect(fcMaxDe("natacion", fcMaxCarrera)).toBe(Math.min(...todas));
  });

  it("y eso mueve la Zona 2 de verdad, no de adorno", () => {
    // Con las zonas de correr, el techo de Zona 2 queda por encima del real:
    // lo que parece rodaje suave en bici ya es tempo.
    const reposo = 65;
    const corriendo = zonasKarvonen(fcMaxDe("carrera", fcMaxCarrera, reposo), reposo);
    const nadando = zonasKarvonen(fcMaxDe("natacion", fcMaxCarrera, reposo), reposo);
    const z2Corriendo = corriendo.find((z) => z.n === 2);
    const z2Nadando = nadando.find((z) => z.n === 2);
    expect(z2Nadando.hasta).toBeLessThan(z2Corriendo.hasta);
    expect(z2Corriendo.hasta - z2Nadando.hasta).toBeGreaterThanOrEqual(5);
  });

  it("nunca deja la máxima por debajo del reposo", () => {
    expect(fcMaxDe("natacion", 70, 68)).toBeGreaterThan(68);
  });

  it("una modalidad desconocida no corrige nada en vez de romper", () => {
    expect(fcMaxDe("teletransporte", 177)).toBe(177);
  });
});

describe("protocolos de intervalos", () => {
  it("todos arman una secuencia que el cronómetro entiende", () => {
    PROTOCOLOS.forEach((p) => {
      const pasos = construirSecuencia(p.secuencia);
      expect(pasos.length, p.nombre).toBeGreaterThan(2);
      pasos.forEach((x) => expect(x.t, `${p.nombre}: ${x.n}`).toBeGreaterThan(0));
    });
  });

  it("los minutos declarados cuadran con la secuencia real", () => {
    // Si el menú promete 40 min y la sesión dura 55, la elección se hace con
    // información falsa justo cuando el tiempo es lo que se está midiendo.
    PROTOCOLOS.forEach((p) => {
      const reales = duracion(construirSecuencia(p.secuencia)) / 60;
      expect(Math.abs(reales - p.minutos), `${p.nombre}: ${reales} min reales`).toBeLessThanOrEqual(2);
    });
  });

  it("los genéricos valen con cualquier modalidad y los de box no", () => {
    expect(protocolosPara("bici").map((p) => p.id)).toContain("4x4");
    expect(protocolosPara("bici").map((p) => p.id)).not.toContain("emom-box");
    expect(protocolosPara("box").map((p) => p.id)).toContain("emom-box");
  });

  it("toda modalidad de HIIT tiene al menos un protocolo", () => {
    modalidadesPara("hiit").forEach((m) => {
      expect(protocolosPara(m.id).length, m.nombre).toBeGreaterThan(0);
    });
  });

  it("un protocolo genérico se traduce al verbo de la modalidad", () => {
    const enBici = secuenciaDe("4x4", "bici");
    const textos = enBici.rondas.pasos.map((p) => p.n).join(" ");
    expect(textos).toMatch(/pedalea fuerte/);
    expect(textos).toMatch(/pedalea suave/);
  });

  it("los de box se dejan como están: ya dicen qué hacer", () => {
    expect(secuenciaDe("emom-box", "box")).toEqual(protocolo("emom-box").secuencia);
  });

  it("un protocolo que no existe devuelve null en vez de una sesión vacía", () => {
    expect(secuenciaDe("inventado", "bici")).toBeNull();
  });
});

describe("choque con el día de fuerza", () => {
  // Por contenido y no por id: el split puede rearmarse y el aviso tiene que
  // seguir saliendo igual.
  const conGrupo = (g) =>
    rutinaReal.dias.find(
      (d) => d.ejercicios && d.ejercicios.some((e) => e.grupo === g)
    );
  const torso = conGrupo("espalda");
  const pierna = conGrupo("cuadriceps");

  it("remar antes de un día de torso pisa la espalda", () => {
    expect(choqueConFuerza("remo", torso)).toContain("espalda");
  });

  it("la bici no estorba en un día de torso", () => {
    expect(choqueConFuerza("bici", torso)).toEqual([]);
  });

  it("pero sí en uno de pierna", () => {
    expect(choqueConFuerza("bici", pierna)).toContain("cuadriceps");
  });

  it("sin día de fuerza no inventa avisos", () => {
    expect(choqueConFuerza("remo", null)).toEqual([]);
    expect(choqueConFuerza("inventada", torso)).toEqual([]);
  });
});

describe("días de la semana", () => {
  it("ordena, quita repetidos y tira lo que no es un día", () => {
    expect(ordenarDias(["vie", "lun", "lun", "zzz", "mie"])).toEqual(["lun", "mie", "vie"]);
  });

  it("los escribe como la rutina", () => {
    expect(etiquetaDias(["jue", "lun", "mie"])).toBe("Lun · Mié · Jue");
    expect(etiquetaDias([])).toBe("Sin día fijo");
  });
});

describe("configuración guardada", () => {
  it("por defecto es exactamente lo que Tadeo ya hacía", () => {
    const d = CARDIO_POR_DEFECTO();
    expect(d.z2.dias).toEqual(["lun", "mie", "jue"]);
    expect(d.z2.modalidad).toBe("carrera");
    expect(d.hiitA.dias).toEqual(["mar"]);
    expect(d.hiitB.protocolo).toBe("emom-box");
  });

  it("respeta lo que se guardó encima", () => {
    const datos = { cardio: { z2: { dias: ["sab", "dom"], modalidad: "remo" } } };
    const cfg = configDe(datos, "z2");
    expect(cfg.dias).toEqual(["sab", "dom"]);
    expect(cfg.modalidad).toBe("remo");
    expect(cfg.minutos).toBe(30);
  });

  it("una modalidad que ya no existe cae a la de siempre", () => {
    expect(configDe({ cardio: { z2: { modalidad: "patineta" } } }, "z2").modalidad).toBe("carrera");
  });

  it("al cambiar a una modalidad sin ese protocolo, elige uno que sí se pueda", () => {
    // Elegir bici con el EMOM de box guardado dejaría una sesión imposible.
    const cfg = configDe({ cardio: { hiitB: { modalidad: "bici", protocolo: "emom-box" } } }, "hiitB");
    expect(cfg.protocolo).not.toBe("emom-box");
    expect(protocolosPara("bici").map((p) => p.id)).toContain(cfg.protocolo);
  });

  it("sin nada guardado usa los días de siempre", () => {
    expect(configDe({ cardio: { z2: { modalidad: "remo" } } }, "z2").dias).toEqual(["lun", "mie", "jue"]);
  });

  it("pero una lista vacía apaga la sesión: es una decisión, no un hueco", () => {
    expect(configDe({ cardio: { hiitB: { dias: [] } } }, "hiitB").dias).toEqual([]);
  });

  it("un día de cardio que no existe devuelve null", () => {
    expect(configDe({}, "zumba")).toBeNull();
  });
});

describe("qué cardio toca cada día", () => {
  const datos = { cardio: CARDIO_POR_DEFECTO() };

  it("dice lo que hay después de las pesas, sin frases escritas a mano", () => {
    const lunes = cardioDelDia(datos, "lun");
    expect(lunes).toHaveLength(1);
    expect(lunes[0].texto).toMatch(/30 min de carrera continua en Zona 2/);
  });

  it("y se mueve cuando Tadeo mueve el día", () => {
    const movido = { cardio: { ...CARDIO_POR_DEFECTO(), z2: { dias: ["dom"], modalidad: "bici", minutos: 45 } } };
    expect(cardioDelDia(movido, "lun")).toEqual([]);
    expect(cardioDelDia(movido, "dom")[0].texto).toMatch(/45 min de bicicleta estática/);
  });

  it("un día puede llevar dos cosas", () => {
    const doble = { cardio: { ...CARDIO_POR_DEFECTO(), hiitA: { dias: ["lun"], modalidad: "cuerda", protocolo: "cuerda-sombra" } } };
    expect(cardioDelDia(doble, "lun")).toHaveLength(2);
  });

  it("lista todos los días ocupados por cardio", () => {
    expect(diasDeCardio(datos)).toEqual(["lun", "mar", "mie", "jue", "vie"]);
  });
});

describe("minutos semanales", () => {
  it("la Zona 2 se alarga con las semanas del bloque", () => {
    expect(minutosZ2(1)).toBe(30);
    expect(minutosZ2(4)).toBe(35);
    expect(minutosZ2(9)).toBe(40);
  });

  it("lo que hace hoy cumple de sobra la recomendación semanal", () => {
    // 150 min moderados o 75 vigorosos, y un minuto vigoroso cuenta por dos.
    const r = resumenSemanal({ cardio: CARDIO_POR_DEFECTO() }, 1);
    expect(r.sesiones).toBe(5);
    expect(r.cumpleRecomendacion).toBe(true);
  });

  it("y avisa cuando dejaría de cumplirla", () => {
    const poco = {
      cardio: {
        z2: { dias: ["dom"], modalidad: "bici", minutos: 20 },
        hiitA: { dias: [], modalidad: "cuerda", protocolo: "cuerda-sombra" },
        hiitB: { dias: [], modalidad: "box", protocolo: "emom-box" }
      }
    };
    expect(resumenSemanal(poco, 1).cumpleRecomendacion).toBe(false);
  });
});

describe("migración a esquema 11", () => {
  it("un respaldo viejo estrena la configuración de cardio sin perder nada", () => {
    const viejo = {
      esquema: 10,
      sesiones: { "torsoA|2026-10-26|1": { fecha: "2026-10-26", ej: { pu1: [{ p: 60, r: 8, ok: true }] } } },
      carreras: [{ fecha: "2026-10-26", km: 6, segundos: 2100 }]
    };
    const d = migrar(viejo);
    expect(d.esquema).toBe(ESQUEMA_ACTUAL);
    expect(d.cardio.z2.modalidad).toBe("carrera");
    expect(d.sesiones["torsoA|2026-10-26|1"].ej.pu1[0].p).toBe(60);
    expect(d.carreras).toHaveLength(1);
  });

  it("no pisa lo que el usuario ya había elegido", () => {
    const d = migrar({ esquema: 11, cardio: { z2: { dias: ["sab"], modalidad: "remo", minutos: 40 } } });
    expect(d.cardio.z2.modalidad).toBe("remo");
    expect(d.cardio.hiitA.dias).toEqual(["mar"]);
  });

  it("una instalación nueva ya viene con cardio", () => {
    expect(vacio().cardio.z2.dias).toEqual(["lun", "mie", "jue"]);
  });

  it("desde la v1, que no tenía ni número de versión", () => {
    const d = migrar({ sesiones: {} });
    expect(d.esquema).toBe(ESQUEMA_ACTUAL);
    expect(d.cardio.hiitB.protocolo).toBe("emom-box");
  });
});
