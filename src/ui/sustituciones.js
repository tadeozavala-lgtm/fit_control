/**
 * Hoja de alternativas: se abre con el botón ⇄ de cada ejercicio.
 *
 * Pensada para resolverse en dos toques con una mano, de pie frente a una
 * máquina ocupada. Nada de scroll infinito ni filtros.
 */

import { alternativas, resolver } from "../logica/sustituciones.js";
import { fotosDe } from "../logica/imagenes.js";

export function abrirAlternativas(app, ejercicio, alElegir) {
  const velo = document.getElementById("velo");
  const hoja = document.getElementById("hoja");

  const sesion = app.sesionActiva(app.diaActivo);
  const estado = resolver(ejercicio, sesion, app.catalogo);
  const lista = alternativas(ejercicio, app.catalogo, { limite: 8 });

  hoja.innerHTML = `
    <h2 id="modalTitulo">Cambiar ejercicio</h2>
    <div class="receta">
      <span>en vez de <b>${ejercicio.nombre}</b></span>
      <span><b>${ejercicio.series}×${ejercicio.reps}</b></span>
      <span>desc <b>${ejercicio.descanso}s</b></span>
    </div>
    <h3>Mismo músculo, otro equipo</h3>
    <div id="listaAlt">
      ${estado.sustituido ? filaOriginal(ejercicio) : ""}
      ${lista.map((a) => fila(a, estado.sustituido && estado.clave === a.id)).join("")}
    </div>
    <p class="fuente">
      Las series del sustituto cuentan para ${nombreGrupo(ejercicio.grupo)} igual que el original,
      pero su historial se guarda aparte. La prescripción no cambia: mismas series, reps, tempo y descanso.<br>
      Catálogo de <a href="https://github.com/yuhonas/free-exercise-db" target="_blank" rel="noopener">free-exercise-db</a>, dominio público.
    </p>
    <button class="cerrar">Cerrar</button>`;

  hoja.querySelectorAll("[data-alt]").forEach((b) => {
    b.onclick = () => {
      const id = b.dataset.alt === "original" ? null : b.dataset.alt;
      alElegir(id);
      cerrar();
    };
  });
  hoja.querySelector(".cerrar").onclick = cerrar;

  velo.classList.add("abierto");
  hoja.scrollTop = 0;
}

function fila(a, activa) {
  const partes = [a.equipo];
  if (a.mecanica) partes.push(a.mecanica === "compound" ? "compuesto" : "aislamiento");
  if (a.secundarios?.length) partes.push("+ " + a.secundarios.map(nombreGrupo).join(", ").toLowerCase());
  return `
    <button class="alt ${activa ? "activa" : ""}" data-alt="${a.id}">
      ${miniatura(a)}
      <span class="alt-txt"><b>${a.nombre}</b><span>${partes.join(" · ")}</span></span>
      <span class="alt-ir">${activa ? "en uso" : "usar"}</span>
    </button>`;
}

/**
 * Una foto chica por alternativa.
 *
 * Media docena de nombres traducidos no dicen gran cosa frente a una máquina
 * ocupada; la foto se reconoce de un vistazo. Pesa poco (es la misma que ya se
 * cachea) y `loading="lazy"` evita bajarlas todas si no se hace scroll.
 */
function miniatura(a) {
  const [foto] = fotosDe(a.id);
  if (!foto) return "";
  return `<img class="alt-foto" src="${foto}" alt="" loading="lazy" decoding="async">`;
}

function filaOriginal(e) {
  return `
    <button class="alt" data-alt="original">
      <span class="alt-txt"><b>${e.nombre}</b><span>volver al original · ${e.equipo}</span></span>
      <span class="alt-ir">volver</span>
    </button>`;
}

const NOMBRES = {
  pecho: "Pecho", espalda: "Espalda", hombro: "Hombro", biceps: "Bíceps",
  triceps: "Tríceps", cuadriceps: "Cuádriceps", isquios: "Isquios",
  gluteo: "Glúteo", gemelo: "Gemelo", core: "Core"
};
function nombreGrupo(g) {
  return NOMBRES[g] || g;
}

function cerrar() {
  document.getElementById("velo").classList.remove("abierto");
}
