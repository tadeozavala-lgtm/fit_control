/**
 * Vista de un día de fuerza.
 *
 * El bug que esto resuelve: la v1 llamaba a pintarVista() completo cada vez que
 * marcabas una serie, así que el DOM se reconstruía entero, perdías el foco y
 * saltaba el scroll. Aquí la marca de una serie solo toca su propia tarjeta y
 * los tres contadores de arriba.
 */

import { mostrar, aKg, conUnidad, etiquetaEquiv, textoSugerido, SALTO } from "../logica/unidades.js";
import {
  mejorSerie, tonelaje, seriesHechas, sugerencia,
  recordPrevio, esRecord, esDescarga, factorSemana, ajustarFilas
} from "../logica/fuerza.js";
import { sesionesDe } from "../logica/almacen.js";
import { abrirTecnica } from "./modal.js";
import { resolver, sustituir } from "../logica/sustituciones.js";
import { abrirAlternativas } from "./sustituciones.js";
import { pintarNotas } from "./notas.js";
import { abrirEditor } from "./editor.js";
import { estaAjustado, resumenCambios } from "../logica/ajustes-rutina.js";

export function pintarDia(app, dia, contenedor) {
  const ses = app.sesionActiva(dia.id);
  const u = app.unidad();

  const cartel = document.createElement("section");
  cartel.className = "cartel";
  cartel.innerHTML = `
    <div class="rotulo">${dia.dia} · Semana ${app.datos.semana}</div>
    <h1>${dia.nombre}</h1>
    <div class="sub">${dia.sub}${dia.remate ? " · " + dia.remate : ""}</div>
    <dl class="tape">
      <div><dt>Series</dt><dd><span id="tapeHechas">0</span><small id="tapeTotales">/0</small></dd></div>
      <div><dt>Tonelaje</dt><dd><span id="tapeTon">0</span><small>${u}</small></dd></div>
      <div><dt>Ejercicios</dt><dd>${dia.ejercicios.length}<small>hoy</small></dd></div>
    </dl>
    ${esDescarga(app.datos.semana)
      ? `<p class="cinta-descarga">Semana de descarga: baja la carga un 10% y quédate en RIR 3. Es lo que te permite seguir subiendo el mes que entra.</p>`
      : ""}
    ${(app.datos.ajustes.diasLiberados || []).includes(dia.id)
      ? `<p class="cinta-liberado">Liberaste este día para correr. Sigue aquí y puedes entrenarlo cuando quieras: si lo haces, sus series cuentan igual para el volumen semanal.</p>`
      : ""}`;
  contenedor.appendChild(cartel);

  const lista = document.createElement("div");
  lista.className = "lista";
  dia.ejercicios.forEach((e, i) => lista.appendChild(tarjeta(app, dia, e, i, ses)));
  contenedor.appendChild(lista);

  const pie = document.createElement("p");
  pie.className = "nota-pie";
  pie.textContent =
    `Los pesos sugeridos son punto de partida. Si terminas la última serie con más de 2 repeticiones en reserva, súbele ${SALTO[u]} ${u} la próxima sesión. Si no llegas al mínimo de repeticiones dos sesiones seguidas, baja un 10%.`;
  contenedor.appendChild(pie);
  pintarNotas(app, dia, contenedor);

  actualizarTape(app, dia);
}

/** Recalcula solo los contadores del encabezado. */
export function actualizarTape(app, dia) {
  const ses = app.sesionActiva(dia.id);
  let hechas = 0;
  let totales = 0;
  let ton = 0;
  dia.ejercicios.forEach((e) => {
    totales += e.series;
    const { clave } = resolver(e, ses, app.catalogo);
    const arr = ses.ej[clave] || [];
    hechas += seriesHechas(arr);
    if (!e.tiempo) ton += tonelaje(arr);
  });
  const n = (id) => document.getElementById(id);
  if (!n("tapeHechas")) return;
  n("tapeHechas").textContent = hechas;
  n("tapeTotales").textContent = "/" + totales;
  n("tapeTon").textContent = Math.round(Number(mostrar(ton, app.unidad())) || 0).toLocaleString("es-MX");
}

function tarjeta(app, dia, original, idx, ses) {
  const u = app.unidad();
  const estado = resolver(original, ses, app.catalogo);
  const e = estado.ej;
  const clave = estado.clave;

  // Las series se pueden editar a mitad de la sesión, así que las filas se
  // reconcilian con la prescripción en cada pintado.
  ses.ej[clave] = ajustarFilas(ses.ej[clave], e.series);
  const series = ses.ej[clave];

  // El historial se busca por la clave activa: el sustituto no hereda ni
  // contamina los récords del ejercicio original.
  const previas = sesionesDe(app.datos, dia.id).filter((s) => s.fecha !== app.hoy());
  const anterior = [...previas].reverse().find((s) => mejorSerie(s.ej[clave]));
  const mejorPrev = anterior ? mejorSerie(anterior.ej[clave]) : null;
  const rec = recordPrevio(previas, clave, app.hoy());

  // Autollenado: arranca con el peso de la sesión anterior ya puesto.
  if (mejorPrev) {
    const base = mejorPrev.peso * factorSemana(app.datos.semana);
    series.forEach((s) => {
      if (s.p === "" && !s.ok) s.p = Math.round(base * 2) / 2;
    });
  }

  const ajustado = estaAjustado(app.datos.ajustesRutina, original.id);

  const el = document.createElement("article");
  el.className =
    "ejercicio" +
    (series.every((s) => s.ok) ? " completo" : "") +
    (estado.sustituido ? " sustituido" : "") +
    (ajustado ? " ajustado" : "");
  el.dataset.ejercicio = clave;

  el.innerHTML = `
    <div class="ej-tope">
      <span class="num">${String(idx + 1).padStart(2, "0")}</span>
      <h2 class="ej-nombre">${e.nombre}</h2>
      <button class="btn-editar" aria-label="Editar la prescripción de ${e.nombre}">✎</button>
      <button class="btn-cambio" aria-label="Cambiar ${e.nombre} por otro ejercicio">⇄</button>
      <button class="btn-tecnica" aria-label="Ver técnica de ${e.nombre}">i</button>
    </div>
    ${estado.sustituido ? `<div class="sello-sust">sustituye a ${original.nombre}</div>` : ""}
    ${ajustado && !estado.sustituido
      ? `<div class="sello-ajuste">${resumenCambios(app.datos.ajustesRutina, original.id, app.ejercicioBase(original.id))}</div>`
      : ""}
    <div class="receta">
      <span><b>${e.series}×${e.reps}</b></span>
      <span>tempo <b>${e.tempo}</b></span>
      <span>RIR <b>${e.rir}</b></span>
      <span>desc <b>${e.descanso}s</b></span>
      <span>sug. <b>${textoSugerido(e.sugerido, u)}</b></span>
    </div>
    <div class="series">${series.map((s, i) => filaSerie(s, i, e, u)).join("")}</div>
    <div class="pie-ej">
      <span class="anterior">${mejorPrev
        ? `Anterior · <b>${conUnidad(mejorPrev.peso, u)} × ${mejorPrev.reps}</b>`
        : "Sin registro previo"}</span>
      <span class="pista"></span>
    </div>`;

  el.querySelector(".btn-tecnica").onclick = () => abrirTecnica(e, u);

  el.querySelector(".btn-editar").onclick = () =>
    abrirEditor(app, app.ejercicioBase(original.id) || original);

  el.querySelector(".btn-cambio").onclick = () =>
    abrirAlternativas(app, original, (sustId) => {
      sustituir(ses, original.id, sustId);
      app.guardar();
      app.pintar();
    });

  el.querySelectorAll("input").forEach((inp) => {
    const i = Number(inp.dataset.i);
    const campo = inp.dataset.campo;

    if (campo === "ok") {
      inp.onchange = () => {
        series[i].ok = inp.checked;
        if (inp.checked && !series[i].r && e.tiempo) series[i].r = e.repMax;
        el.classList.toggle("completo", series.every((s) => s.ok));
        if (inp.checked) {
          const faltan = series.some((s, j) => j > i && !s.ok);
          app.reloj.arrancar(
            e.descanso,
            faltan ? `Descanso · ${e.nombre.split(" ")[0]} S${i + 2}` : "Descanso"
          );
        }
        app.guardar();
        refrescar(el, e, series, rec, u);
        actualizarTape(app, dia);
      };
      return;
    }

    inp.oninput = () => {
      series[i][campo] = campo === "p" ? aKg(inp.value, app.unidad()) : inp.value;
      if (campo === "p") {
        const eti = inp.parentElement.querySelector(".uni");
        if (eti && !e.tiempo) eti.textContent = etiquetaEquiv(series[i].p, app.unidad());
      }
      app.guardar();
      refrescar(el, e, series, rec, app.unidad());
      actualizarTape(app, dia);
    };
  });

  refrescar(el, e, series, rec, u);
  return el;
}

function filaSerie(s, i, e, u) {
  return `
    <div class="serie" data-serie="${i}">
      <span class="serie-n">S${i + 1}</span>
      <label class="campo">
        <input type="number" inputmode="decimal" step="${e.tiempo ? 1 : SALTO[u]}" min="0"
               placeholder="${e.tiempo ? "—" : "peso"}" value="${mostrar(s.p, u)}"
               data-campo="p" data-i="${i}" ${e.tiempo ? "disabled" : ""}
               aria-label="Peso serie ${i + 1}">
        <span class="uni">${e.tiempo ? "" : etiquetaEquiv(s.p, u)}</span>
      </label>
      <label class="campo">
        <input type="number" inputmode="numeric" step="1" min="0"
               placeholder="${e.tiempo ? "seg" : "reps"}" value="${s.r}"
               data-campo="r" data-i="${i}"
               aria-label="${e.tiempo ? "Segundos" : "Repeticiones"} serie ${i + 1}">
        <span class="uni">${e.tiempo ? "s" : "r"}</span>
      </label>
      <label>
        <input type="checkbox" data-campo="ok" data-i="${i}" ${s.ok ? "checked" : ""}
               aria-label="Marcar serie ${i + 1} como hecha">
        <span class="marca-ok"></span>
      </label>
    </div>`;
}

/** Récords en dorado y pista de progresión. Solo toca esta tarjeta. */
function refrescar(el, e, series, rec, unidad) {
  el.querySelectorAll(".serie").forEach((fila, i) => {
    fila.classList.toggle("record", !e.tiempo && esRecord(series[i], rec));
  });
  const pista = el.querySelector(".pista");
  const s = sugerencia(series, e, unidad);
  pista.textContent = s.texto;
  pista.classList.toggle("baja", s.accion === "bajar");
}
