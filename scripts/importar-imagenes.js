#!/usr/bin/env node
/**
 * Descarga y optimiza las fotos de técnica de cada ejercicio.
 *
 *   npm run imagenes
 *
 * Fuente: https://github.com/yuhonas/free-exercise-db (The Unlicense, dominio
 * público). Cada ejercicio trae dos fotos, inicio y fin del movimiento. La app
 * las alterna para enseñar la mecánica, que es lo más parecido a un GIF sin
 * depender de vídeo ni de terceros.
 *
 * Decisiones de peso, que son el meollo:
 *
 * - Se redimensionan a 520 px y se pasan a WebP. A tamaño original son 12 MB
 *   para los 92 ejercicios; así quedan en unos 3 MB.
 * - NO van al precaché del service worker. La app instalada pesa ~100 KB y
 *   meterle 3 MB de fotos la volvería lenta de instalar para algo que solo se
 *   mira de vez en cuando. Se cachean la primera vez que se abren, y a partir
 *   de ahí están offline.
 * - Se commitean al repo en vez de pedirlas a GitHub en caliente: una app que
 *   se usa en el sótano de un gimnasio no puede depender de la red para nada
 *   que ya tenga resuelto.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import sharp from "sharp";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const SALIDA = join(raiz, "public/ejercicios");
const ORIGEN_JSON = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json";
const ORIGEN_IMG = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/";

const ANCHO = 520;
const CALIDAD = 74;

const catalogo = JSON.parse(readFileSync(join(raiz, "src/datos/catalogo.json"), "utf8"));

console.log("Bajando el índice de free-exercise-db…");
const res = await fetch(ORIGEN_JSON);
if (!res.ok) {
  console.error(`✗ no pude bajar el origen (HTTP ${res.status})`);
  process.exit(1);
}
const origen = await res.json();
const porId = new Map(origen.map((e) => [e.id, e]));

if (existsSync(SALIDA)) rmSync(SALIDA, { recursive: true });
mkdirSync(SALIDA, { recursive: true });

const manifiesto = {};
const faltantes = [];
let bytes = 0;

for (const ej of catalogo.ejercicios) {
  const fuente = porId.get(ej.id);
  const imagenes = fuente?.images || [];
  if (!imagenes.length) {
    faltantes.push(ej.nombre);
    continue;
  }

  const guardadas = [];
  const vistas = [];
  for (let i = 0; i < Math.min(2, imagenes.length); i++) {
    const r = await fetch(ORIGEN_IMG + imagenes[i]);
    if (!r.ok) continue;
    const buf = Buffer.from(await r.arrayBuffer());
    const salida = await sharp(buf).resize(ANCHO).webp({ quality: CALIDAD }).toBuffer();
    // Unos pocos ejercicios del origen traen la misma foto dos veces. Animar
    // dos cuadros idénticos promete un movimiento que no se ve: mejor una sola
    // foto fija y que la vista esconda el control de pausa.
    if (vistas.some((v) => v.equals(salida))) continue;
    vistas.push(salida);
    const nombre = `${ej.id}-${i}.webp`;
    writeFileSync(join(SALIDA, nombre), salida);
    guardadas.push(nombre);
    bytes += salida.length;
  }

  if (guardadas.length) manifiesto[ej.id] = guardadas;
  else faltantes.push(ej.nombre);
  process.stdout.write(".");
}

writeFileSync(
  join(raiz, "src/datos/imagenes.json"),
  JSON.stringify(
    {
      esquema: 1,
      generado: new Date().toISOString().slice(0, 10),
      ancho: ANCHO,
      fuente: {
        nombre: "free-exercise-db",
        url: "https://github.com/yuhonas/free-exercise-db",
        licencia: "The Unlicense (dominio público)"
      },
      por: manifiesto
    },
    null,
    2
  ) + "\n"
);

console.log(`\n✓ ${Object.keys(manifiesto).length} ejercicios con fotos · ${Math.round(bytes / 1024 / 1024 * 10) / 10} MB`);
if (faltantes.length) {
  console.log(`  sin fotos (${faltantes.length}): ${faltantes.join(", ")}`);
}
