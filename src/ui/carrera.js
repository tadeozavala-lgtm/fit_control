/**
 * Vista de carrera: zonas reales, registro de rodajes y predictor.
 *
 * Reemplaza el rango fijo "130-145 ppm" que la rutina traía escrito a mano. Ese
 * número venía de una tabla genérica; aquí sale de la edad y la FC en reposo de
 * Tadeo, que es lo que de verdad decide dónde está su Zona 2.
 */

import {
  fcMaxEstimada, zonasKarvonen,
  ritmo, formatoRitmo, formatoTiempo, leerTiempo,
  tablaPredicciones, vdot, ritmosEntrenamiento,
  nuevaCarrera, TIPOS, carrerasDeSemana, resumenCarreras, avisoVolumen
} from "../logica/carrera.js";
import { semanaISO } from "../logica/volumen.js";

export function pintarCarrera(app, dia, contenedor) {
  const aj = app.datos.ajustes;
  const fcMax = aj.fcMax || fcMaxEstimada(aj.edad);

  contenedor.appendChild(cartel(app, dia));
  contenedor.appendChild(bloqueZonas(app, fcMax));
  (dia.bloques || []).forEach((b) => contenedor.appendChild(bloqueTexto(b)));
  contenedor.appendChild(bloqueCronos(app, dia));
  contenedor.appendChild(bloqueRegistro(app));
  contenedor.appendChild(bloquePredictor(app));
  contenedor.appendChild(bloqueAjustes(app));
}

function cartel(app, dia) {
  const s = document.createElement("section");
  s.className = "cartel";
  const semana = semanaISO(app.hoy());
  const r = resumenCarreras(carrerasDeSemana(app.datos.carreras, semana, semanaISO));
  s.innerHTML = `
    <div class="rotulo">${dia.dia} · Semana ${app.datos.semana}</div>
    <h1>Zona 2</h1><div class="sub">${dia.sub}</div>
    <dl class="tape">
      <div><dt>Esta semana</dt><dd>${r.km}<small>km</small></dd></div>
      <div><dt>Tiempo</dt><dd style="font-size:22px">${formatoTiempo(r.segundos)}</dd></div>
      <div><dt>Ritmo</dt><dd style="font-size:22px">${formatoRitmo(r.ritmoMedio)}</dd></div>
    </dl>`;
  return s;
}

/* ---------- zonas ---------- */

function bloqueZonas(app, fcMax) {
  const aj = app.datos.ajustes;
  const zonas = zonasKarvonen(fcMax, aj.fcReposo);
  const s = document.createElement("section");
  s.className = "bloque";
  s.innerHTML = `
    <h3>Tus zonas de pulso</h3>
    <p>Calculadas con Karvonen a partir de tu FC en reposo (${aj.fcReposo} ppm) y una
       máxima estimada de ${fcMax} ppm para ${aj.edad} años. Para rodar en Zona 2 debes
       poder hablar frases completas: si jadeas, te saliste.</p>
    <div class="zonas">
      ${zonas
        .map(
          (z) => `<div class="zona ${z.n === 2 ? "tuya" : ""}">
            <span class="n">Z${z.n}</span>
            <span class="txt"><b>${z.nombre}</b><span>${z.para}</span></span>
            <span class="ppm">${z.desde}–${z.hasta}</span>
          </div>`
        )
        .join("")}
    </div>`;
  return s;
}

function bloqueTexto(b) {
  const s = document.createElement("section");
  s.className = "bloque";
  s.innerHTML = `<h3>${b.titulo}</h3><p>${b.texto}</p>
    <ul class="pasos">${b.lista.map((x) => `<li>${x}</li>`).join("")}</ul>`;
  return s;
}

function bloqueCronos(app, dia) {
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
  return s;
}

/* ---------- registro ---------- */

function bloqueRegistro(app) {
  const s = document.createElement("section");
  s.className = "bloque";
  const semana = semanaISO(app.hoy());
  const deEsta = carrerasDeSemana(app.datos.carreras, semana, semanaISO);
  const ultimas = [...(app.datos.carreras || [])].sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 6);

  s.innerHTML = `
    <h3>Registrar carrera</h3>
    <div class="campos tres">
      <label class="campo-eti"><span>Distancia</span>
        <input type="number" inputmode="decimal" step="0.1" min="0" id="carKm" placeholder="6.0"></label>
      <label class="campo-eti"><span>Tiempo</span>
        <input type="text" inputmode="numeric" id="carTiempo" placeholder="36:30"></label>
      <label class="campo-eti"><span>Tipo</span>
        <select id="carTipo">
          ${Object.entries(TIPOS).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}
        </select></label>
    </div>
    <div class="campos">
      <label class="campo-eti"><span>Pulso medio (opcional)</span>
        <input type="number" inputmode="numeric" min="0" id="carPpm" placeholder="138"></label>
      <label class="campo-eti"><span>Esfuerzo 1 a 5</span>
        <input type="number" inputmode="numeric" min="1" max="5" id="carEsf" placeholder="3"></label>
    </div>
    <button class="arranque" id="carGuardar">Guardar carrera</button>
    ${avisoDeVolumen(app, deEsta)}
    ${ultimas.length ? `<div class="carreras">${ultimas.map(filaCarrera).join("")}</div>` : ""}`;

  s.querySelector("#carGuardar").onclick = () => {
    const km = Number(s.querySelector("#carKm").value);
    const segundos = leerTiempo(s.querySelector("#carTiempo").value);
    if (!(km > 0) || !(segundos > 0)) {
      alert("Pon la distancia en kilómetros y el tiempo como 36:30.");
      return;
    }
    const esf = Number(s.querySelector("#carEsf").value) || null;
    const ppm = Number(s.querySelector("#carPpm").value) || null;
    app.datos.carreras.push(
      nuevaCarrera(app.hoy(), km, segundos, {
        tipo: s.querySelector("#carTipo").value,
        esfuerzo: esf,
        ppm
      })
    );
    app.datos.carreras.sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
    app.guardar();
    app.pintar();
  };

  s.querySelectorAll("[data-quitar]").forEach((b) => {
    b.onclick = () => {
      app.datos.carreras = app.datos.carreras.filter((c) => c.id !== b.dataset.quitar);
      app.guardar();
      app.pintar();
    };
  });

  return s;
}

function filaCarrera(c) {
  const [, mes, dia] = c.fecha.split("-");
  const extras = [TIPOS[c.tipo] || c.tipo];
  if (c.ppm) extras.push(`${c.ppm} ppm`);
  if (c.esfuerzo) extras.push(`esfuerzo ${c.esfuerzo}`);
  return `
    <div class="carrera">
      <span class="fecha">${dia}/${mes}</span>
      <span class="datos">
        <b>${c.km} km · ${formatoTiempo(c.segundos)}</b>
        <span>${formatoRitmo(ritmo(c.km, c.segundos))}/km · ${extras.join(" · ")}</span>
      </span>
      <button class="quitar" data-quitar="${c.id}" aria-label="Borrar esta carrera">×</button>
    </div>`;
}

function avisoDeVolumen(app, deEsta) {
  const hoy = new Date(app.hoy() + "T12:00:00Z");
  const pasada = new Date(hoy);
  pasada.setUTCDate(hoy.getUTCDate() - 7);
  const previa = carrerasDeSemana(app.datos.carreras, semanaISO(pasada.toISOString().slice(0, 10)), semanaISO);

  const a = avisoVolumen(resumenCarreras(deEsta).km, resumenCarreras(previa).km);
  if (!a) return "";
  return `<p class="cinta-descarga">${a.texto}</p>`;
}

/* ---------- predictor ---------- */

function bloquePredictor(app) {
  const s = document.createElement("section");
  s.className = "bloque";
  const marca = app.datos.ajustes.marca;

  s.innerHTML = `
    <h3>Ritmos y predicciones</h3>
    <p>Desde una marca reciente se estiman tus tiempos en otras distancias y los
       ritmos a los que deberías entrenar. Usa un esfuerzo de verdad, no un rodaje suave.</p>
    <div class="campos">
      <label class="campo-eti"><span>Distancia</span>
        <input type="number" inputmode="decimal" step="0.1" min="0" id="marcaKm"
               value="${marca ? marca.km : ""}" placeholder="5"></label>
      <label class="campo-eti"><span>Tiempo</span>
        <input type="text" inputmode="numeric" id="marcaTiempo"
               value="${marca ? formatoTiempo(marca.segundos) : ""}" placeholder="30:00"></label>
    </div>
    <button class="arranque gris" id="marcaCalcular">Calcular</button>
    <div id="salidaPred">${marca ? tablas(marca.km, marca.segundos) : ""}</div>`;

  s.querySelector("#marcaCalcular").onclick = () => {
    const km = Number(s.querySelector("#marcaKm").value);
    const segundos = leerTiempo(s.querySelector("#marcaTiempo").value);
    if (!(km > 0) || !(segundos > 0)) {
      alert("Pon la distancia y el tiempo, por ejemplo 5 km y 30:00.");
      return;
    }
    app.datos.ajustes.marca = { km, segundos };
    app.guardar();
    s.querySelector("#salidaPred").innerHTML = tablas(km, segundos);
  };

  return s;
}

function tablas(km, segundos) {
  const pred = tablaPredicciones(km, segundos);
  const ritmos = ritmosEntrenamiento(km, segundos);
  const hayDudosa = pred.some((p) => !p.confiable);

  return `
    <table class="pred">
      <tr><th>Distancia</th><th>Tiempo</th><th>Ritmo</th></tr>
      ${pred
        .map(
          (p) => `<tr class="${p.confiable ? "" : "dudosa"}">
            <td>${p.nombre}</td><td>${formatoTiempo(p.segundos)}</td>
            <td>${formatoRitmo(p.ritmo)}</td></tr>`
        )
        .join("")}
    </table>
    ${hayDudosa
      ? `<p class="vol-nota">Las marcadas con · quedan a más de cuatro veces tu distancia de
         referencia: Riegel se vuelve optimista ahí. Para afinarlas, mete una marca más larga.</p>`
      : ""}
    <h3 style="margin-top:22px">A qué ritmo entrenar</h3>
    <table class="pred">
      <tr><th>Tipo</th><th>Ritmo</th><th>Para</th></tr>
      ${ritmos
        .map(
          (r) => `<tr><td>${r.nombre}</td><td>${formatoRitmo(r.segPorKm)}</td>
            <td style="color:var(--humo);font-size:11px">${r.para}</td></tr>`
        )
        .join("")}
    </table>
    <p class="vol-nota">VDOT estimado ${vdot(km, segundos)}. El número solo sirve para
       derivar estos ritmos; compáralo contigo mismo, no con nadie más.</p>`;
}

/* ---------- ajustes ---------- */

function bloqueAjustes(app) {
  const s = document.createElement("section");
  s.className = "bloque";
  const aj = app.datos.ajustes;

  s.innerHTML = `
    <h3>Tus datos</h3>
    <p>De aquí salen las zonas. Para medir tu FC en reposo, tómate el pulso un
       minuto al despertar, antes de levantarte, tres días seguidos, y promedia.</p>
    <div class="campos tres">
      <label class="campo-eti"><span>Edad</span>
        <input type="number" inputmode="numeric" min="10" max="99" id="ajEdad" value="${aj.edad}"></label>
      <label class="campo-eti"><span>FC reposo</span>
        <input type="number" inputmode="numeric" min="30" max="120" id="ajReposo" value="${aj.fcReposo}"></label>
      <label class="campo-eti"><span>FC máx real</span>
        <input type="number" inputmode="numeric" min="100" max="230" id="ajMax"
               value="${aj.fcMax || ""}" placeholder="${fcMaxEstimada(aj.edad)}"></label>
    </div>
    <p class="vol-nota">Deja la máxima vacía para usar la estimada (${fcMaxEstimada(aj.edad)} ppm).
       Si alguna vez te hacen una prueba de esfuerzo, pon ahí el número real: con 110 kg
       de peso corporal vale la pena hacerla antes de meterle HIIT intenso.</p>`;

  const guardar = (campo, input, min, max) => {
    input.onchange = () => {
      const v = Number(input.value);
      if (campo === "fcMax" && !input.value.trim()) {
        aj.fcMax = null;
      } else if (v >= min && v <= max) {
        aj[campo] = v;
      } else {
        input.value = aj[campo] ?? "";
        return;
      }
      app.guardar();
      app.pintar();
    };
  };
  guardar("edad", s.querySelector("#ajEdad"), 10, 99);
  guardar("fcReposo", s.querySelector("#ajReposo"), 30, 120);
  guardar("fcMax", s.querySelector("#ajMax"), 100, 230);

  return s;
}
