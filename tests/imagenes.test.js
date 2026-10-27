import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import rutina from "../src/datos/rutina.json";
import catalogo from "../src/datos/catalogo.json";
import manifiesto from "../src/datos/imagenes.json";
import { fotosDe, fotosDeEjercicio, tieneFotos, CARPETA } from "../src/logica/imagenes.js";
import { resolver, alternativas } from "../src/logica/sustituciones.js";

/**
 * Las fotos de técnica son datos generados (`npm run imagenes`) y la ventana de
 * técnica las pide por id. Un id mal escrito no rompe nada en consola: deja un
 * hueco en blanco que solo se descubre en el gimnasio. Por eso se prueban aquí.
 */

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const CARPETA_FS = join(raiz, "public/ejercicios");

const ejerciciosDeFuerza = rutina.dias
  .filter((d) => d.tipo === "fuerza")
  .flatMap((d) => d.ejercicios || []);

describe("manifiesto de imágenes", () => {
  it("cada archivo del manifiesto existe en public/ejercicios", () => {
    const enDisco = new Set(readdirSync(CARPETA_FS));
    const declarados = Object.values(manifiesto.por).flat();
    expect(declarados.filter((f) => !enDisco.has(f))).toEqual([]);
  });

  it("no hay fotos en disco que el manifiesto no declare", () => {
    const declarados = new Set(Object.values(manifiesto.por).flat());
    const sobran = readdirSync(CARPETA_FS).filter((f) => !declarados.has(f));
    expect(sobran).toEqual([]);
  });

  it("solo declara ids que existen en el catálogo", () => {
    const delCatalogo = new Set(catalogo.ejercicios.map((e) => e.id));
    const intrusos = Object.keys(manifiesto.por).filter((id) => !delCatalogo.has(id));
    expect(intrusos).toEqual([]);
  });

  it("deja constancia de la licencia de origen", () => {
    expect(manifiesto.fuente.licencia).toMatch(/Unlicense|dominio público/i);
    expect(manifiesto.fuente.url).toMatch(/^https:\/\//);
  });
});

describe("cobertura", () => {
  it("todo ejercicio de fuerza de la rutina tiene fotos", () => {
    const sin = ejerciciosDeFuerza.filter((e) => !tieneFotos(e)).map((e) => e.nombre);
    expect(sin).toEqual([]);
  });

  it("enseña inicio y fin, no una sola foto", () => {
    for (const e of ejerciciosDeFuerza) {
      expect(fotosDeEjercicio(e).length, e.nombre).toBe(2);
    }
  });

  it("todo el catálogo tiene fotos, para que la rutina generada también", () => {
    const sin = catalogo.ejercicios.filter((e) => !fotosDe(e.id).length).map((e) => e.nombre);
    expect(sin).toEqual([]);
  });

  it("nunca declara la misma foto dos veces para un ejercicio", () => {
    // Animar dos cuadros idénticos promete un movimiento que no se ve. El
    // importador las descarta; con una sola foto la vista esconde el control.
    for (const [id, fotos] of Object.entries(manifiesto.por)) {
      const huellas = fotos.map((f) =>
        createHash("sha256").update(readFileSync(join(CARPETA_FS, f))).digest("hex")
      );
      expect(new Set(huellas).size, id).toBe(fotos.length);
    }
  });
});

describe("resolución de rutas", () => {
  it("devuelve rutas relativas, que es como se publica la app", () => {
    const [foto] = fotosDe(catalogo.ejercicios[0].id);
    expect(foto.startsWith(CARPETA)).toBe(true);
    expect(foto.startsWith("/")).toBe(false);
  });

  it("cae al id del ejercicio cuando no trae catalogoId", () => {
    // El generador recicla ids (regla 14) pero los ejercicios nuevos salen del
    // catálogo con su propio id: deben encontrar sus fotos igual.
    const id = catalogo.ejercicios[0].id;
    expect(fotosDeEjercicio({ id }).length).toBe(2);
  });

  it("prefiere catalogoId sobre el id cuando están los dos", () => {
    const [a, b] = catalogo.ejercicios;
    expect(fotosDeEjercicio({ id: a.id, catalogoId: b.id })).toEqual(fotosDe(b.id));
  });

  it("un ejercicio sustituido enseña las fotos del sustituto", () => {
    const original = rutina.dias[0].ejercicios[0];
    const sustituto = catalogo.ejercicios.find((c) => c.grupo === original.grupo && c.id !== original.catalogoId);
    const { ej } = resolver(original, { ej: {}, sust: { [original.id]: sustituto.id } }, catalogo);
    expect(fotosDeEjercicio(ej)).toEqual(fotosDe(sustituto.id));
    expect(fotosDeEjercicio(ej)).not.toEqual(fotosDe(original.catalogoId));
  });

  it("toda alternativa que se puede ofrecer tiene foto que enseñar", () => {
    // La hoja de cambio pone una miniatura por fila; si alguna no tuviera
    // foto, la lista se vería despareja justo cuando hay que elegir rápido.
    for (const e of rutina.dias.filter((d) => d.tipo === "fuerza").flatMap((d) => d.ejercicios)) {
      for (const alt of alternativas(e, catalogo, { limite: 8 })) {
        expect(fotosDe(alt.id).length, alt.nombre).toBeGreaterThan(0);
      }
    }
  });

  it("no revienta con un ejercicio desconocido ni sin ejercicio", () => {
    expect(fotosDe("No_Existe")).toEqual([]);
    expect(fotosDe(undefined)).toEqual([]);
    expect(fotosDeEjercicio(null)).toEqual([]);
    expect(tieneFotos({ id: "inventado" })).toBe(false);
  });
});

describe("peso de la instalación", () => {
  /**
   * Las fotos pesan ~3 MB contra los ~100 KB de la app. Si entran al precaché,
   * instalarla pasa de instantánea a lenta para algo que se mira de vez en
   * cuando. Este test existe para que ese costo no se cuele sin querer.
   */
  const config = readFileSync(join(raiz, "vite.config.js"), "utf8");

  it("no precachea las fotos", () => {
    const glob = config.match(/globPatterns:\s*\[(.*?)\]/s)[1];
    expect(glob).not.toMatch(/webp/);
  });

  it("pero sí las cachea al abrirlas", () => {
    expect(config).toMatch(/runtimeCaching/);
    expect(config).toMatch(/ejercicios\//);
  });
});
