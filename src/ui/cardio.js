/**
 * Días de intervalos (HIIT). La Zona 2 vive en ui/carrera.js, que además
 * calcula zonas de pulso y lleva el registro de rodajes.
 */

import { construirSecuencia, duracion, minutosTrabajo } from "../logica/secuencia.js";
import { decir } from "../logica/avisos.js";

/* ---------- HIIT por intervalos ---------- */

export function pintarIntervalo(app, dia, contenedor) {
  const pasos = construirSecuencia(dia.secuencia);

  const cartel = document.createElement("section");
  cartel.className = "cartel";
  cartel.innerHTML = `
    <div class="rotulo">${dia.dia} · Semana ${app.datos.semana}</div>
    <h1>${dia.nombre}</h1><div class="sub">${dia.sub}</div>
    <dl class="tape">
      <div><dt>Bloques</dt><dd>${pasos.length}</dd></div>
      <div><dt>Total</dt><dd>${Math.round(duracion(pasos) / 60)}<small>min</small></dd></div>
      <div><dt>Trabajo</dt><dd>${minutosTrabajo(pasos)}<small>min</small></dd></div>
    </dl>`;
  contenedor.appendChild(cartel);

  const s = document.createElement("section");
  s.className = "bloque";
  if (dia.intro) s.innerHTML = `<p>${dia.intro}</p>`;

  const ul = document.createElement("ul");
  ul.className = "pasos";
  ul.id = "listaPasos";
  pasos.forEach((p) => {
    const li = document.createElement("li");
    const dur = p.t >= 60 ? Math.round((p.t / 60) * 10) / 10 + " min" : p.t + " s";
    li.innerHTML = `<span style="color:inherit">${p.n}</span><span>${dur}</span>`;
    ul.appendChild(li);
  });
  s.appendChild(ul);

  const voz = document.createElement("label");
  voz.className = "interruptor";
  voz.innerHTML = `<input type="checkbox" id="vozHiit" ${app.datos.voz ? "checked" : ""}>
    <span>Cantar los bloques en voz alta</span>`;
  voz.querySelector("input").onchange = (ev) => {
    app.datos.voz = ev.target.checked;
    app.guardar();
    if (ev.target.checked) decir("Voz activada", true);
  };
  s.appendChild(voz);

  const arranca = document.createElement("button");
  arranca.className = "arranque";
  arranca.textContent = "Arrancar sesión";
  arranca.onclick = () => app.correrSecuencia(pasos);
  s.appendChild(arranca);

  const alto = document.createElement("button");
  alto.className = "arranque gris";
  alto.textContent = "Detener";
  alto.onclick = () => app.detenerSecuencia();
  s.appendChild(alto);

  contenedor.appendChild(s);
}

export function marcarPaso(i) {
  document.querySelectorAll("#listaPasos li").forEach((li, j) => {
    li.classList.toggle("ahora", j === i);
  });
  const li = document.querySelectorAll("#listaPasos li")[i];
  li?.scrollIntoView({ block: "center", behavior: "smooth" });
}
