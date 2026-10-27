import { describe, it, expect } from "vitest";
import catalogo from "../src/datos/catalogo.json";
import rutinaPrevia from "../src/datos/rutina.json";
import {
  OBJETIVOS_RUTINA, EQUIPOS, EXPERIENCIA, SPLITS, DIAS_MIN, DIAS_MAX,
  MINUTOS_MINIMOS, MINUTOS_CALENTAMIENTO, TOPE_SEMANAL, DIAS_SUGERIDOS,
  segundosPorRep, minutosEjercicio, minutosSesion,
  puntuarEjercicio, elegirEjercicio, indiceIdsPrevios, idPara,
  recortarATiempo, generarRutina, volumenDeRutina, gruposCortos
} from "../src/logica/generador.js";
import { GRUPOS } from "../src/logica/volumen.js";

const BASE = {
  objetivo: "recomposicion",
  equipo: "completo",
  experiencia: "intermedio",
  catalogo,
  hoy: "2026-10-24"
};
const gen = (extra = {}) => generarRutina({ dias: 4, minutos: 60, ...BASE, ...extra });

describe("catálogo de opciones", () => {
  it("los cuatro objetivos tienen prescripción completa", () => {
    Object.values(OBJETIVOS_RUTINA).forEach((o) => {
      expect(o.reps[0]).toBeLessThan(o.reps[1]);
      expect(o.descanso).toBeGreaterThan(0);
      expect(o.tempo).toMatch(/^\d-\d-\d-\d$/);
      expect(o.rir).toBeGreaterThanOrEqual(0);
    });
  });

  it("a más repeticiones, menos descanso", () => {
    expect(OBJETIVOS_RUTINA.fuerza.descanso).toBeGreaterThan(OBJETIVOS_RUTINA.resistencia.descanso);
    expect(OBJETIVOS_RUTINA.fuerza.reps[1]).toBeLessThan(OBJETIVOS_RUTINA.resistencia.reps[0]);
  });

  it("hay split para cada número de días permitido", () => {
    for (let d = DIAS_MIN; d <= DIAS_MAX; d++) {
      expect(SPLITS[d], `${d} días`).toBeTruthy();
      expect(SPLITS[d].dias).toHaveLength(d);
      expect(DIAS_SUGERIDOS[d]).toHaveLength(d);
    }
  });

  it("cada día de cada split entrena al menos dos grupos válidos", () => {
    Object.values(SPLITS).forEach((sp) => {
      sp.dias.forEach((d) => {
        expect(d.grupos.length).toBeGreaterThanOrEqual(2);
        d.grupos.forEach((g) => expect(Object.keys(GRUPOS)).toContain(g));
      });
    });
  });

  it("el equipo más limitado es un subconjunto del más completo", () => {
    EQUIPOS.corporal.permite.forEach((e) => {
      expect(EQUIPOS.completo.permite).toContain(e);
    });
  });
});

describe("presupuesto de tiempo", () => {
  it("lee los segundos de tensión del tempo", () => {
    expect(segundosPorRep("3-1-1-0")).toBe(5);
    expect(segundosPorRep("2-0-1-0")).toBe(3);
    expect(segundosPorRep("isométrico")).toBe(4);
  });

  it("un ejercicio cuesta trabajo más descansos, sin el descanso final", () => {
    const e = { series: 4, reps: "8-12", tempo: "3-1-1-0", descanso: 90 };
    // 4 series x 8 reps x 5 s = 160 s de trabajo + 3 descansos de 90 + montaje
    const esperado = (4 * 8 * 5 + 3 * 90 + 45) / 60;
    expect(minutosEjercicio(e)).toBeCloseTo(esperado, 2);
  });

  it("más series y más descanso cuestan más tiempo", () => {
    const corto = { series: 3, reps: "10", tempo: "2-0-1-0", descanso: 45 };
    const largo = { series: 5, reps: "10", tempo: "3-1-1-0", descanso: 180 };
    expect(minutosEjercicio(largo)).toBeGreaterThan(minutosEjercicio(corto) * 2);
  });

  it("la sesión incluye el calentamiento", () => {
    expect(minutosSesion([])).toBe(MINUTOS_CALENTAMIENTO);
  });
});

describe("selección de ejercicios", () => {
  const del = (nombre) => catalogo.ejercicios.find((e) => e.nombre === nombre);

  it("descarta otro grupo, equipo no disponible o ya usado", () => {
    const banca = del("Press banca con barra");
    expect(puntuarEjercicio(banca, "espalda", new Set(), "completo", new Map(), new Map())).toBe(-1);
    expect(puntuarEjercicio(banca, "pecho", new Set(), "corporal", new Map(), new Map())).toBe(-1);
    expect(puntuarEjercicio(banca, "pecho", new Set([banca.id]), "completo", new Map(), new Map())).toBe(-1);
  });

  it("premia los compuestos sobre los aislamientos", () => {
    const comp = puntuarEjercicio(del("Press banca con barra"), "pecho", new Set(), "completo", new Map(), new Map());
    const aisl = puntuarEjercicio(del("Aperturas con mancuernas"), "pecho", new Set(), "completo", new Map(), new Map());
    expect(comp).toBeGreaterThan(aisl);
  });

  it("penaliza repetir el mismo ejercicio en la semana", () => {
    const banca = del("Press banca con barra");
    const limpio = puntuarEjercicio(banca, "pecho", new Set(), "completo", new Map(), new Map());
    const repetido = puntuarEjercicio(banca, "pecho", new Set(), "completo", new Map([[banca.id, 1]]), new Map());
    expect(repetido).toBeLessThan(limpio);
  });

  it("penaliza repetir el mismo patrón en la sesión: cuatro press no son variedad", () => {
    const banca = del("Press banca con barra");
    const limpio = puntuarEjercicio(banca, "pecho", new Set(), "completo", new Map(), new Map(), new Map());
    const conPatron = puntuarEjercicio(
      banca, "pecho", new Set(), "completo", new Map(), new Map(),
      new Map([["empuje-horizontal", 2]])
    );
    expect(conPatron).toBeLessThan(limpio);
  });

  it("rechaza una bisagra más si ya se alcanzó el tope semanal", () => {
    const pm = del("Peso muerto convencional");
    expect(pm.patron).toBe("bisagra");
    const lleno = new Map([["bisagra", TOPE_SEMANAL.bisagra]]);
    expect(puntuarEjercicio(pm, pm.grupo, new Set(), "completo", new Map(), lleno)).toBe(-1);
  });

  it("elige el mejor disponible, o null si no queda ninguno", () => {
    expect(elegirEjercicio(catalogo, "pecho", new Set(), "completo", new Map(), new Map())).toBeTruthy();
    expect(elegirEjercicio(catalogo, "gluteo", new Set(), "corporal", new Map(), new Map())).toBeNull();
  });
});

describe("recorte por tiempo", () => {
  const ej = (nombre, mecanica, series) => ({
    nombre, mecanica, series, reps: "10", tempo: "3-1-1-0", descanso: 90
  });

  it("si cabe no toca nada", () => {
    const lista = [ej("A", "compound", 4)];
    const r = recortarATiempo(lista, 120);
    expect(r.ejercicios).toHaveLength(1);
    expect(r.recortes).toHaveLength(0);
  });

  it("recorta hasta entrar en el tiempo disponible", () => {
    const lista = [
      ej("Sentadilla", "compound", 4), ej("Press", "compound", 4),
      ej("Curl", "isolation", 3), ej("Extensión", "isolation", 3),
      ej("Elevaciones", "isolation", 3)
    ];
    // Sin recortar son 44 min; en 30 no cabe y tiene que ajustar.
    expect(minutosSesion(lista)).toBeGreaterThan(30);
    const r = recortarATiempo(lista, 30);
    expect(minutosSesion(r.ejercicios)).toBeLessThanOrEqual(30);
    expect(r.recortes.length).toBeGreaterThan(0);
  });

  it("si ya cabe justo, no recorta de más", () => {
    const lista = [
      ej("Sentadilla", "compound", 4), ej("Press", "compound", 4),
      ej("Curl", "isolation", 3), ej("Extensión", "isolation", 3),
      ej("Elevaciones", "isolation", 3)
    ];
    const r = recortarATiempo(lista, 45);
    expect(r.ejercicios).toHaveLength(5);
    expect(r.recortes).toHaveLength(0);
  });

  it("sacrifica los aislamientos antes que los compuestos", () => {
    const lista = [
      ej("Sentadilla", "compound", 4), ej("Peso muerto", "compound", 4),
      ej("Curl", "isolation", 3), ej("Elevaciones", "isolation", 3)
    ];
    const r = recortarATiempo(lista, 40);
    const nombres = r.ejercicios.map((x) => x.nombre);
    expect(nombres).toContain("Sentadilla");
    expect(nombres).toContain("Peso muerto");
  });

  it("nunca deja la sesión por debajo de dos ejercicios", () => {
    const lista = [
      ej("A", "compound", 5), ej("B", "compound", 5), ej("C", "compound", 5)
    ];
    expect(recortarATiempo(lista, 10).ejercicios.length).toBeGreaterThanOrEqual(2);
  });
});

describe("reciclar ids para no perder el historial", () => {
  const indice = indiceIdsPrevios(rutinaPrevia);

  it("un ejercicio que ya existía conserva su id", () => {
    const banca = catalogo.ejercicios.find((e) => e.nombre === "Press banca con barra");
    expect(idPara(banca, indice)).toBe("pu1");
  });

  it("cuando dos ejercicios comparten ficha de catálogo, decide el nombre", () => {
    // "Press banca ligero" (fb2) y "Press banca con barra" (pu1) apuntan a la
    // misma entrada del catálogo para enseñar las mismas fotos, pero cada uno
    // tiene su propio historial. El id no puede salir sorteado.
    expect(indice.porCatalogo.get("Barbell_Bench_Press_-_Medium_Grip")).toBe(null);
    const banca = catalogo.ejercicios.find((e) => e.id === "Barbell_Bench_Press_-_Medium_Grip");
    expect(idPara(banca, indice)).toBe("pu1");
  });

  it("uno nuevo estrena el id del catálogo", () => {
    const nuevo = catalogo.ejercicios.find((e) => e.nombre === "Pec deck");
    expect(idPara(nuevo, indice)).toBe(nuevo.id);
  });

  it("también hereda el peso sugerido conocido", () => {
    expect(indice.sugeridos.get("pu1")).toMatch(/kg/);
  });

  it("este es el punto: regenerar no puede costar meses de registro", () => {
    const r = gen({ rutinaPrevia });
    const ids = r.rutina.dias.flatMap((d) => d.ejercicios.map((e) => e.id));
    const reciclados = ids.filter((i) => /^(pu|pl|lg|fb)\d/.test(i));
    expect(reciclados.length).toBeGreaterThan(3);
  });

  it("sin rutina previa funciona igual, con ids del catálogo", () => {
    const r = generarRutina({ dias: 3, minutos: 50, ...BASE });
    expect(r.ok).toBe(true);
    r.rutina.dias.forEach((d) =>
      d.ejercicios.forEach((e) => expect(e.id).toBeTruthy())
    );
  });
});

describe("generar la rutina", () => {
  it("produce un día por sesión pedida, con su nombre y día sugerido", () => {
    const r = gen();
    expect(r.ok).toBe(true);
    expect(r.rutina.dias).toHaveLength(4);
    r.rutina.dias.forEach((d, i) => {
      expect(d.nombre).toBeTruthy();
      expect(d.dia).toBe(DIAS_SUGERIDOS[4][i]);
      expect(d.ejercicios.length).toBeGreaterThanOrEqual(2);
    });
  });

  it("respeta el tiempo por sesión, que es el punto del cuestionario", () => {
    [35, 45, 60, 75].forEach((min) => {
      const r = gen({ minutos: min });
      r.rutina.dias.forEach((d) => {
        expect(d.minutosEstimados, `${min} min: ${d.nombre}`).toBeLessThanOrEqual(min);
      });
    });
  });

  it("con más tiempo mete más trabajo", () => {
    const corto = gen({ minutos: 35 });
    const largo = gen({ minutos: 75 });
    const series = (r) =>
      r.rutina.dias.reduce((a, d) => a + d.ejercicios.reduce((x, e) => x + e.series, 0), 0);
    expect(series(largo)).toBeGreaterThan(series(corto));
  });

  it("los compuestos abren la sesión", () => {
    gen().rutina.dias.forEach((d) => {
      const primerAislamiento = d.ejercicios.findIndex((e) => e.mecanica !== "compound");
      const ultimoCompuesto = d.ejercicios.map((e) => e.mecanica).lastIndexOf("compound");
      if (primerAislamiento >= 0) expect(primerAislamiento).toBeGreaterThan(ultimoCompuesto - 1);
    });
  });

  it("no repite la bisagra más de lo que marca el tope", () => {
    const r = gen({ dias: 6, minutos: 60 });
    const bisagras = r.rutina.dias.flatMap((d) => d.ejercicios.filter((e) => e.patron === "bisagra"));
    expect(bisagras.length).toBeLessThanOrEqual(TOPE_SEMANAL.bisagra);
  });

  it("la prescripción sale del objetivo elegido", () => {
    const fuerza = gen({ objetivo: "fuerza" }).rutina.dias[0].ejercicios[0];
    const resistencia = gen({ objetivo: "resistencia" }).rutina.dias[0].ejercicios[0];
    expect(fuerza.descanso).toBeGreaterThan(resistencia.descanso);
    expect(fuerza.repMax).toBeLessThan(resistencia.repMax);
  });

  it("solo usa equipo disponible", () => {
    const r = generarRutina({ dias: 3, minutos: 50, ...BASE, equipo: "mancuernas" });
    expect(r.ok).toBe(true);
    r.rutina.dias.forEach((d) =>
      d.ejercicios.forEach((e) =>
        expect(EQUIPOS.mancuernas.permite, e.nombre).toContain(e.equipo)
      )
    );
  });

  it("la experiencia limita cuántos ejercicios caben", () => {
    const novato = gen({ experiencia: "principiante", minutos: 90 });
    const veterano = gen({ experiencia: "avanzado", minutos: 90 });
    const maximo = (r) => Math.max(...r.rutina.dias.map((d) => d.ejercicios.length));
    expect(maximo(novato)).toBeLessThanOrEqual(EXPERIENCIA.principiante.maxEjercicios);
    expect(maximo(veterano)).toBeGreaterThan(maximo(novato));
  });

  it("todo ejercicio generado trae lo que necesitan los demás cálculos", () => {
    gen().rutina.dias.forEach((d) =>
      d.ejercicios.forEach((e) => {
        expect(Object.keys(GRUPOS), e.nombre).toContain(e.grupo);
        expect(e.equipo, e.nombre).toBeTruthy();
        expect(e.series, e.nombre).toBeGreaterThan(0);
        expect(e.repMax, e.nombre).toBeGreaterThan(0);
        expect(e.descanso, e.nombre).toBeGreaterThan(0);
        expect(e.tempo, e.nombre).toMatch(/^\d-\d-\d-\d$/);
      })
    );
  });

  it("rechaza configuraciones imposibles con un motivo útil", () => {
    expect(generarRutina({ dias: 9, minutos: 60, ...BASE }).error).toMatch(/días/);
    expect(generarRutina({ dias: 4, minutos: 10, ...BASE }).error).toMatch(new RegExp(`${MINUTOS_MINIMOS}`));
    expect(generarRutina({ dias: 4, minutos: 60, ...BASE, objetivo: "x" }).ok).toBe(false);
    expect(generarRutina({ dias: 4, minutos: 60, ...BASE, equipo: "x" }).ok).toBe(false);
  });

  it("avisa cuando el equipo no da para el split pedido", () => {
    const r = generarRutina({ dias: 6, minutos: 60, ...BASE, equipo: "corporal" });
    if (!r.ok) expect(r.error).toMatch(/equipo|ejercicios/i);
  });
});

describe("el volumen que produce", () => {
  it("cuenta primarios enteros y secundarios a mitad, como volumen.js", () => {
    const rutina = {
      dias: [{ ejercicios: [{ grupo: "pecho", secundarios: ["triceps"], series: 4 }] }]
    };
    const v = volumenDeRutina(rutina);
    expect(v.pecho).toBe(4);
    expect(v.triceps).toBe(2);
  });

  it("con 4 días y una hora ningún grupo se queda corto", () => {
    expect(gruposCortos(gen().rutina)).toHaveLength(0);
  });

  it("con 2 días es imposible cubrirlo todo, y la app lo dice en vez de fingir", () => {
    const cortos = gruposCortos(generarRutina({ dias: 2, minutos: 45, ...BASE }).rutina);
    expect(cortos.length).toBeGreaterThan(0);
    cortos.forEach((c) => {
      expect(c.series).toBeLessThan(c.rango.min);
      expect(c.nombre).toBeTruthy();
    });
  });

  it("más días producen más volumen total", () => {
    const total = (d) =>
      Object.values(volumenDeRutina(generarRutina({ dias: d, minutos: 60, ...BASE }).rutina))
        .reduce((a, b) => a + b, 0);
    expect(total(5)).toBeGreaterThan(total(3));
  });
});

describe("un día tiene que entrenar lo que su nombre dice", () => {
  it("rechaza un Legs que con ese equipo solo podría hacer core", () => {
    // Con solo peso corporal el catálogo no tiene nada de cuádriceps, así que
    // el día de pierna salía compuesto de dos ejercicios de core: pasaba el
    // conteo de ejercicios y no era un día de pierna.
    const r = generarRutina({ dias: 3, minutos: 50, ...BASE, equipo: "corporal" });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/Legs/);
  });

  it("cuando sí genera, cada día entrena su grupo principal", () => {
    [2, 3, 4, 5, 6].forEach((dias) => {
      const r = generarRutina({ dias, minutos: 60, ...BASE });
      expect(r.ok, `${dias} días`).toBe(true);
      r.rutina.dias.forEach((d, i) => {
        const principal = SPLITS[dias].dias[i].grupos[0];
        const entrena = d.ejercicios.some(
          (e) => e.grupo === principal || (e.secundarios || []).includes(principal)
        );
        expect(entrena, `${dias}d · ${d.nombre} debería entrenar ${principal}`).toBe(true);
      });
    });
  });
});
