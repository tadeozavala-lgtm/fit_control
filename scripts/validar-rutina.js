#!/usr/bin/env node
/**
 * Validador de rutina.json.
 *
 * Pensado para correrlo tras editar la rutina desde el celular: avisa del error
 * con el id del ejercicio antes de que el cambio llegue al gimnasio.
 *
 *   npm run validar
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const ruta = join(raiz, "src/datos/rutina.json");

const GRUPOS = [
  "pecho", "espalda", "hombro", "biceps", "triceps",
  "cuadriceps", "isquios", "gluteo", "gemelo", "core"
];

const fallas = [];
const avisos = [];

let rutina;
try {
  rutina = JSON.parse(readFileSync(ruta, "utf8"));
} catch (e) {
  console.error(`✗ rutina.json no es JSON válido:\n  ${e.message}`);
  console.error("  Casi siempre es una coma de más antes de un } o un ].");
  process.exit(1);
}

if (!Array.isArray(rutina.dias) || !rutina.dias.length) {
  fallas.push("rutina.json no tiene días");
}

const idsEjercicio = new Set();
const idsDia = new Set();

for (const d of rutina.dias || []) {
  if (!d.id) fallas.push("Hay un día sin id");
  if (idsDia.has(d.id)) fallas.push(`Día duplicado: ${d.id}`);
  idsDia.add(d.id);
  if (!d.nombre) fallas.push(`${d.id}: falta nombre`);

  if (d.tipo === "intervalo" && !d.secuencia) {
    fallas.push(`${d.id}: día de intervalos sin secuencia`);
  }

  for (const e of d.ejercicios || []) {
    const ref = `${d.id}/${e.id || "sin-id"}`;
    if (!e.id) fallas.push(`${ref}: falta id`);
    if (idsEjercicio.has(e.id)) fallas.push(`${ref}: id de ejercicio repetido`);
    idsEjercicio.add(e.id);

    if (!e.nombre) fallas.push(`${ref}: falta nombre`);
    if (!(e.series > 0)) fallas.push(`${ref}: series debe ser mayor a 0`);
    if (!(e.repMax > 0)) fallas.push(`${ref}: repMax debe ser mayor a 0`);
    if (!e.tempo) fallas.push(`${ref}: falta tempo`);
    if (!(e.descanso > 0)) fallas.push(`${ref}: descanso debe ser mayor a 0`);
    if (e.descanso > 300) avisos.push(`${ref}: descanso de ${e.descanso}s, ¿seguro?`);
    if (e.descanso && e.descanso < 30) avisos.push(`${ref}: descanso de ${e.descanso}s es muy corto`);

    const tieneKg = /[\d.]+\s*(?:[–-]\s*[\d.]+)?\s*kg/.test(String(e.sugerido));
    const corporal = /corporal/i.test(String(e.sugerido));
    if (!tieneKg && !corporal) {
      fallas.push(`${ref}: "sugerido" debe venir en kg o decir "peso corporal" (tiene "${e.sugerido}")`);
    }
    if (!e.grupo) {
      fallas.push(`${ref}: falta "grupo" (sin él no cuenta para el volumen semanal)`);
    } else if (!GRUPOS.includes(e.grupo)) {
      fallas.push(`${ref}: grupo "${e.grupo}" no existe. Válidos: ${GRUPOS.join(", ")}`);
    }
    for (const g of e.secundarios || []) {
      if (!GRUPOS.includes(g)) fallas.push(`${ref}: secundario "${g}" no existe`);
      if (g === e.grupo) fallas.push(`${ref}: "${g}" está como primario y secundario`);
    }

    if (e.rir == null) avisos.push(`${ref}: sin RIR`);
    if (!e.tecnica) avisos.push(`${ref}: sin guía de técnica`);
  }
}

avisos.forEach((a) => console.log(`  aviso  ${a}`));

if (fallas.length) {
  console.error(`\n✗ ${fallas.length} problema(s) en rutina.json:`);
  fallas.forEach((f) => console.error(`  ✗ ${f}`));
  process.exit(1);
}

const totalEj = (rutina.dias || []).reduce((a, d) => a + (d.ejercicios || []).length, 0);
console.log(`\n✓ rutina.json válida — ${rutina.dias.length} días, ${totalEj} ejercicios`);
