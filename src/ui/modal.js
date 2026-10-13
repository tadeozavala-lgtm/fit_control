import { rangoSugerido, kgALb } from "../logica/unidades.js";

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
    <h3>Ejecución</h3>
    <ul>${(t.ejecucion || []).map((x) => `<li>${x}</li>`).join("")}</ul>
    <h3>Errores que cuestan caro</h3>
    <ul>${(t.errores || []).map((x) => `<li>${x}</li>`).join("")}</ul>
    ${t.aviso ? `<div class="aviso">${t.aviso}</div>` : ""}
    ${tablaEquivalencias(e)}
    <h3>Cómo leer el tempo</h3>
    <ul>
      <li><b>${e.tempo}</b> — el primer número son los segundos de bajada, el segundo la pausa abajo, el tercero la subida y el cuarto la pausa arriba.</li>
      <li>Inhala bajando, exhala subiendo. Nunca contengas el aire.</li>
    </ul>
    <button class="cerrar">Cerrar</button>`;

  hoja.querySelector(".cerrar").onclick = cerrar;
  velo.classList.add("abierto");
  hoja.scrollTop = 0;
}

export function cerrar() {
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
