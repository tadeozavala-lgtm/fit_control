import { construirSecuencia, duracion, minutosTrabajo } from "../logica/secuencia.js";
import { decir } from "../logica/avisos.js";

/* ---------- Zona 2 ---------- */

export function pintarCardio(app, dia, contenedor) {
  const cartel = document.createElement("section");
  cartel.className = "cartel";
  cartel.innerHTML = `
    <div class="rotulo">${dia.dia} · Semana ${app.datos.semana}</div>
    <h1>Zona 2</h1><div class="sub">${dia.sub}</div>`;
  contenedor.appendChild(cartel);

  (dia.bloques || []).forEach((b) => {
    const s = document.createElement("section");
    s.className = "bloque";
    s.innerHTML = `<h3>${b.titulo}</h3><p>${b.texto}</p>
      <ul class="pasos">${b.lista.map((x) => `<li>${x}</li>`).join("")}</ul>`;
    contenedor.appendChild(s);
  });

  const s = document.createElement("section");
  s.className = "bloque";
  s.innerHTML = `<h3>Cronómetro</h3><p>Arranca el bloque y deja el teléfono en el bolsillo.</p>`;
  (dia.cronos || []).forEach((c) => {
    const b = document.createElement("button");
    b.className = "arranque gris";
    b.textContent = c.nombre;
    b.onclick = () => app.reloj.arrancar(c.seg, "Zona 2");
    s.appendChild(b);
  });
  contenedor.appendChild(s);
}

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
