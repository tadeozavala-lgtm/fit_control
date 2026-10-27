import { rangoSugerido, kgALb } from "../logica/unidades.js";
import { htmlMecanica, conectarMecanica, detenerMecanica } from "./mecanica.js";

export function abrirTecnica(e, unidad) {
  const velo = document.getElementById("velo");
  const hoja = document.getElementById("hoja");
  const t = e.tecnica || {};

  hoja.innerHTML = `
    <h2 id="modalTitulo">${e.nombre}</h2>
    <div class="receta">
      <span><b>${e.series}×${e.reps}</b></span><span>tempo <b>${e.tempo}</b></span>
      <span>RIR <b>${e.rir}</b></span><span>desc <b>${e.descanso}s</b></span>
    </div>
    ${htmlMecanica(e)}
    ${textoTecnica(e, t)}
    ${tablaEquivalencias(e)}
    <h3>Cómo leer el tempo</h3>
    <ul>
      <li><b>${e.tempo}</b> — el primer número son los segundos de bajada, el segundo la pausa abajo, el tercero la subida y el cuarto la pausa arriba.</li>
      <li>Inhala bajando, exhala subiendo. Nunca contengas el aire.</li>
    </ul>
    <button class="cerrar">Cerrar</button>`;

  hoja.querySelector(".cerrar").onclick = cerrar;
  conectarMecanica(hoja);
  velo.classList.add("abierto");
  hoja.scrollTop = 0;
}

export function cerrar() {
  detenerMecanica();
  document.getElementById("velo").classList.remove("abierto");
}

export function conectarModal() {
  const velo = document.getElementById("velo");
  velo.onclick = (ev) => {
    if (ev.target === velo) cerrar();
  };
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") cerrar();
  });
}

/**
 * La técnica escrita, si la hay.
 *
 * Un sustituto del catálogo no la trae, y copiarle la del original sería dar
 * indicaciones de otro movimiento: mejor decirlo y dejar que mande la foto.
 */
function textoTecnica(e, t) {
  if (!t.ejecucion?.length && !t.errores?.length) {
    return e.sustituyeA
      ? `<p class="sinficha">Sustituye a <b>${e.sustituyeA}</b>, así que la guía escrita
          de ese ejercicio no aplica aquí: ve las fotos y respeta el tempo y el RIR.</p>`
      : "";
  }
  return `
    <h3>Ejecución</h3>
    <ul>${(t.ejecucion || []).map((x) => `<li>${x}</li>`).join("")}</ul>
    <h3>Errores que cuestan caro</h3>
    <ul>${(t.errores || []).map((x) => `<li>${x}</li>`).join("")}</ul>
    ${t.aviso ? `<div class="aviso">${t.aviso}</div>` : ""}`;
}

function tablaEquivalencias(e) {
  const r = rangoSugerido(e.sugerido);
  if (!r) return "";
  const [a, b] = r;
  const salto = b - a >= 10 ? 5 : 2.5;
  const pasos = [];
  for (let k = a; k <= b + 0.01; k += salto) pasos.push(Math.round(k * 10) / 10);
  if (pasos[pasos.length - 1] !== b) pasos.push(b);
  const filas = pasos.map((k) => `<tr><td>${k} kg</td><td>${kgALb(k)} lb</td></tr>`).join("");
  return `<h3>Equivalencias del rango</h3>
    <table class="tabla-eq">${filas}
      <tr><td>Disco 20 / 15 / 10 / 5 / 2.5 kg</td><td>45 / 35 / 25 / 10 / 5 lb</td></tr>
      <tr><td>Barra olímpica 20 kg</td><td>45 lb</td></tr>
    </table>`;
}
