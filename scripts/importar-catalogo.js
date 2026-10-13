#!/usr/bin/env node
/**
 * Genera src/datos/catalogo.json a partir de free-exercise-db.
 *
 *   npm run catalogo
 *
 * Fuente: https://github.com/yuhonas/free-exercise-db (The Unlicense, dominio
 * público). Son 876 ejercicios en inglés; aquí se queda una selección curada y
 * traducida, porque el valor está en tener alternativas que de verdad se puedan
 * hacer en un gimnasio comercial, no en meter el dataset entero.
 *
 * El resultado se commitea: la app no depende de la red en tiempo de ejecución.
 * Si un nombre deja de existir en el origen, el script falla en vez de generar
 * un catálogo incompleto en silencio.
 */

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ORIGEN = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json";
const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Músculos del origen -> grupos de la app. null = no nos interesa. */
const MUSCULOS = {
  chest: "pecho",
  lats: "espalda",
  "middle back": "espalda",
  "lower back": "espalda",
  traps: "espalda",
  shoulders: "hombro",
  biceps: "biceps",
  triceps: "triceps",
  quadriceps: "cuadriceps",
  hamstrings: "isquios",
  glutes: "gluteo",
  calves: "gemelo",
  abdominals: "core",
  forearms: null,
  neck: null,
  abductors: null,
  adductors: null
};

const EQUIPO = {
  barbell: "barra",
  dumbbell: "mancuerna",
  cable: "polea",
  machine: "máquina",
  "body only": "peso corporal",
  kettlebells: "kettlebell",
  "e-z curl bar": "barra Z"
};

/**
 * Selección curada: nombre exacto en el origen -> nombre en español.
 * Criterio: que exista en un gimnasio comercial y que sea una alternativa real
 * a algo de la rutina, no una variante exótica.
 */
const SELECCION = {
  // ----- pecho -----
  "Barbell Bench Press - Medium Grip": "Press banca con barra",
  "Barbell Incline Bench Press - Medium Grip": "Press inclinado con barra",
  "Dumbbell Bench Press": "Press banca con mancuernas",
  "Incline Dumbbell Bench With Palms Facing In": "Press inclinado agarre neutro",
  "Decline Dumbbell Bench Press": "Press declinado con mancuernas",
  "Dumbbell Flyes": "Aperturas con mancuernas",
  "Incline Dumbbell Flyes": "Aperturas inclinadas con mancuernas",
  "Cable Crossover": "Cruce de poleas",
  "Low Cable Crossover": "Cruce de poleas desde abajo",
  "Butterfly": "Pec deck",
  "Machine Bench Press": "Press de pecho en máquina",
  "Leverage Incline Chest Press": "Press inclinado en máquina",
  "Pushups": "Lagartijas",
  "Push-Ups With Feet Elevated": "Lagartijas con pies elevados",

  // ----- espalda -----
  "Wide-Grip Lat Pulldown": "Jalón al pecho agarre ancho",
  "Close-Grip Front Lat Pulldown": "Jalón al pecho agarre cerrado",
  "V-Bar Pulldown": "Jalón con barra V",
  "Underhand Cable Pulldowns": "Jalón agarre supino",
  "Pullups": "Dominadas",
  "Chin-Up": "Dominadas agarre supino",
  "Straight-Arm Pulldown": "Pullover en polea",
  "Rope Straight-Arm Pulldown": "Pullover en polea con cuerda",
  "Bent Over Barbell Row": "Remo con barra",
  "Reverse Grip Bent-Over Rows": "Remo con barra agarre supino",
  "T-Bar Row with Handle": "Remo en T",
  "Lying T-Bar Row": "Remo en T con pecho apoyado",
  "Seated Cable Rows": "Remo sentado en polea",
  "One-Arm Dumbbell Row": "Remo con mancuerna a una mano",
  "Bent Over Two-Dumbbell Row": "Remo con dos mancuernas",
  "Leverage High Row": "Remo alto en máquina",
  "Leverage Iso Row": "Remo en máquina",
  "Smith Machine Bent Over Row": "Remo en máquina Smith",
  "Barbell Deadlift": "Peso muerto convencional",

  // ----- hombro -----
  "Seated Barbell Military Press": "Press militar sentado con barra",
  "Standing Military Press": "Press militar de pie",
  "Seated Dumbbell Press": "Press de hombro sentado con mancuernas",
  "Arnold Dumbbell Press": "Press Arnold",
  "Dumbbell One-Arm Shoulder Press": "Press de hombro a una mano",
  "Seated Cable Shoulder Press": "Press de hombro en polea",
  "Side Lateral Raise": "Elevaciones laterales",
  "Seated Side Lateral Raise": "Elevaciones laterales sentado",
  "Cable Seated Lateral Raise": "Elevación lateral en polea",
  "Standing Low-Pulley Deltoid Raise": "Elevación lateral en polea baja",
  "Face Pull": "Face pull",
  "Cable Rear Delt Fly": "Aperturas posteriores en polea",
  "Dumbbell Lying Rear Lateral Raise": "Elevación posterior con mancuernas",
  "Upright Barbell Row": "Remo al mentón con barra",

  // ----- bíceps -----
  "Barbell Curl": "Curl con barra",
  "Close-Grip EZ Bar Curl": "Curl con barra Z",
  "Preacher Curl": "Curl predicador",
  "Hammer Curls": "Curl martillo",
  "Incline Dumbbell Curl": "Curl inclinado con mancuernas",
  "Seated Dumbbell Curl": "Curl sentado con mancuernas",
  "Concentration Curls": "Curl concentrado",
  "Standing Biceps Cable Curl": "Curl en polea de pie",
  "Cable Hammer Curls - Rope Attachment": "Curl martillo en polea con cuerda",

  // ----- tríceps -----
  "Triceps Pushdown - Rope Attachment": "Extensión en polea con cuerda",
  "Triceps Pushdown - V-Bar Attachment": "Extensión en polea con barra V",
  "Cable Rope Overhead Triceps Extension": "Extensión sobre la cabeza con cuerda",
  "Close-Grip Barbell Bench Press": "Press banca agarre cerrado",
  "Decline EZ Bar Triceps Extension": "Press francés con barra Z",
  "Standing Overhead Barbell Triceps Extension": "Extensión de tríceps de pie",
  "Dumbbell One-Arm Triceps Extension": "Extensión de tríceps a una mano",
  "Bench Dips": "Fondos en banco",
  "Dips - Triceps Version": "Fondos en paralelas",

  // ----- cuádriceps -----
  "Barbell Squat": "Sentadilla con barra",
  "Front Barbell Squat": "Sentadilla frontal",
  "Smith Machine Squat": "Sentadilla en máquina Smith",
  "Goblet Squat": "Sentadilla goblet",
  "Dumbbell Squat": "Sentadilla con mancuernas",
  "Leg Press": "Prensa de pierna",
  "Hack Squat": "Sentadilla hack",
  "Leg Extensions": "Extensión de cuádriceps",
  "Barbell Lunge": "Zancadas con barra",
  "Dumbbell Lunges": "Zancadas con mancuernas",
  "Barbell Walking Lunge": "Zancadas caminando",

  // ----- isquios y glúteo -----
  "Romanian Deadlift": "Peso muerto rumano",
  "Stiff-Legged Barbell Deadlift": "Peso muerto piernas rígidas",
  "Stiff-Legged Dumbbell Deadlift": "Peso muerto rumano con mancuernas",
  "Lying Leg Curls": "Curl femoral acostado",
  "Seated Leg Curl": "Curl femoral sentado",
  "Good Morning": "Buenos días",
  "Barbell Hip Thrust": "Empuje de cadera con barra",

  // ----- gemelo -----
  "Standing Calf Raises": "Elevación de talones de pie",
  "Seated Calf Raise": "Elevación de talones sentado",
  "Calf Press On The Leg Press Machine": "Elevación de talones en prensa",
  "Calf Press": "Elevación de talones en máquina",

  // ----- core -----
  "Plank": "Plancha",
  "Hanging Leg Raise": "Elevación de piernas colgado",
  "Cable Crunch": "Crunch en polea",
  "Ab Crunch Machine": "Crunch en máquina",
  "Cable Reverse Crunch": "Crunch invertido en polea"
};

/**
 * Patrón de movimiento, deducido del nombre en inglés del origen.
 *
 * Importa más de lo que parece: un remo y un jalón trabajan la misma espalda,
 * pero si el banco de remo está ocupado, otro movimiento horizontal es mejor
 * sustituto que uno vertical. Sin esto, el ranking proponía dominadas para
 * reemplazar un remo con barra.
 */
const PATRONES = [
  [/\brows?\b|row with|t-bar/i, "traccion-horizontal"],
  [/pulldown|pull-?up|pullup|chin-?up|pullover|straight-arm/i, "traccion-vertical"],
  [/bench press|push-?ups?|pushups|chest press|flyes?|flye|crossover|butterfly/i, "empuje-horizontal"],
  [/military|shoulder press|overhead press|arnold|seated dumbbell press|upright/i, "empuje-vertical"],
  [/squat|leg press|hack|lunge/i, "rodilla"],
  [/deadlift|good morning|hip thrust/i, "bisagra"]
];

function patronDe(nombreEn) {
  for (const [re, patron] of PATRONES) {
    if (re.test(nombreEn)) return patron;
  }
  return null;
}

function grupoDe(musculos) {
  for (const m of musculos || []) {
    const g = MUSCULOS[m];
    if (g) return g;
  }
  return null;
}

function secundariosDe(ejercicio, primario) {
  const vistos = new Set();
  (ejercicio.secondaryMuscles || []).forEach((m) => {
    const g = MUSCULOS[m];
    if (g && g !== primario) vistos.add(g);
  });
  // Un músculo primario del origen que no quedó como nuestro primario también cuenta.
  (ejercicio.primaryMuscles || []).forEach((m) => {
    const g = MUSCULOS[m];
    if (g && g !== primario) vistos.add(g);
  });
  return [...vistos];
}

const res = await fetch(ORIGEN);
if (!res.ok) {
  console.error(`✗ no pude bajar el origen (HTTP ${res.status})`);
  process.exit(1);
}
const origen = await res.json();
const porNombre = new Map(origen.map((e) => [e.name, e]));

const catalogo = [];
const faltantes = [];

for (const [nombreEn, nombreEs] of Object.entries(SELECCION)) {
  const e = porNombre.get(nombreEn);
  if (!e) {
    faltantes.push(nombreEn);
    continue;
  }
  const grupo = grupoDe(e.primaryMuscles);
  if (!grupo) {
    faltantes.push(`${nombreEn} (sin grupo mapeable)`);
    continue;
  }
  catalogo.push({
    id: e.id,
    nombre: nombreEs,
    nombreOrigen: e.name,
    grupo,
    secundarios: secundariosDe(e, grupo),
    equipo: EQUIPO[e.equipment] || e.equipment,
    mecanica: e.mechanic || null,
    fuerza: e.force || null,
    patron: patronDe(e.name)
  });
}

if (faltantes.length) {
  console.error(`✗ ${faltantes.length} ejercicio(s) ya no están en el origen o no mapean:`);
  faltantes.forEach((f) => console.error(`  ✗ ${f}`));
  console.error("\nRevisa el nombre exacto en free-exercise-db antes de volver a generar.");
  process.exit(1);
}

catalogo.sort((a, b) => a.grupo.localeCompare(b.grupo) || a.nombre.localeCompare(b.nombre));

const salida = {
  esquema: 1,
  generado: new Date().toISOString().slice(0, 10),
  fuente: {
    nombre: "free-exercise-db",
    url: "https://github.com/yuhonas/free-exercise-db",
    licencia: "The Unlicense (dominio público)"
  },
  ejercicios: catalogo
};

writeFileSync(join(raiz, "src/datos/catalogo.json"), JSON.stringify(salida, null, 2) + "\n");

const porGrupo = {};
catalogo.forEach((e) => {
  porGrupo[e.grupo] = (porGrupo[e.grupo] || 0) + 1;
});
console.log(`✓ catalogo.json generado — ${catalogo.length} ejercicios de ${origen.length} del origen`);
Object.entries(porGrupo)
  .sort((a, b) => b[1] - a[1])
  .forEach(([g, n]) => console.log(`   ${g.padEnd(12)} ${n}`));
