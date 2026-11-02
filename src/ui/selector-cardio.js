/**
 * Selector de días y modalidad para una sesión de cardio.
 *
 * Lo mismo sirve para la Zona 2 y para los dos HIIT. Se pinta arriba de cada
 * pestaña de cardio porque la decisión —qué máquina hay libre, qué rodilla
 * molesta hoy— se toma al llegar al gimnasio, no el domingo planeando.
 */

import {
  DIAS_SEMANA, configDe, modalidadesPara, protocolosPara,
  modalidad, protocolo, IMPACTO, choqueConFuerza, etiquetaDias
} from "../logica/cardio.js";
import { GRUPOS } from "../logica/volumen.js";

const NOMBRE_DIA = { lun: "Lunes", mar: "Martes", mie: "Miércoles", jue: "Jueves", vie: "Viernes", sab: "Sábado", dom: "Domingo" };

/**
 * @param {object} app
 * @param {string} diaId  "z2", "hiitA" o "hiitB"
 * @param {"z2"|"hiit"} tipo
 * @param {Function} alCambiar  repinta la pestaña con la configuración nueva
 */
export function selectorCardio(app, diaId, tipo, alCambiar) {
  const cfg = configDe(app.datos, diaId);
  const m = modalidad(cfg.modalidad);

  const s = document.createElement("section");
  s.className = "bloque sel-cardio";
  s.innerHTML = `
    <h3>Cuándo y con qué</h3>
    <div class="dias-chips">
      ${DIAS_SEMANA.map(
        (d) => `<button class="chip ${cfg.dias.includes(d.id) ? "activo" : ""}"
          data-dia="${d.id}" aria-pressed="${cfg.dias.includes(d.id)}">${d.nombre}</button>`
      ).join("")}
    </div>
    <label class="campo-sel">
      <span>Modalidad</span>
      <select data-campo="modalidad">
        ${modalidadesPara(tipo)
          .map(
            (x) => `<option value="${x.id}" ${x.id === cfg.modalidad ? "selected" : ""}>${x.nombre}</option>`
          )
          .join("")}
      </select>
    </label>
    ${tipo === "hiit" ? selectorProtocolo(cfg) : selectorMinutos(cfg)}
    <p class="ficha-mod">
      <b>${IMPACTO[m.impacto]}</b> · ${m.porQue}<br>
      <span class="ojo">${m.ojo}</span>
    </p>
    ${avisoChoque(app, cfg, m)}`;

  s.querySelectorAll("[data-dia]").forEach((b) => {
    b.onclick = () => {
      const dia = b.dataset.dia;
      const actual = configDe(app.datos, diaId).dias;
      const nuevos = actual.includes(dia) ? actual.filter((x) => x !== dia) : [...actual, dia];
      guardar(app, diaId, { dias: nuevos });
      alCambiar();
    };
  });

  s.querySelectorAll("[data-campo]").forEach((sel) => {
    sel.onchange = () => {
      const valor = sel.dataset.campo === "minutos" ? Number(sel.value) : sel.value;
      guardar(app, diaId, { [sel.dataset.campo]: valor });
      alCambiar();
    };
  });

  return s;
}

/**
 * Guarda la configuración entera del día, no solo el campo tocado: así un
 * cambio de modalidad que invalida el protocolo se resuelve al leer
 * (`configDe` lo corrige) y nunca queda una combinación imposible guardada.
 */
function guardar(app, diaId, cambios) {
  app.datos.cardio = {
    ...(app.datos.cardio || {}),
    [diaId]: { ...configDe(app.datos, diaId), ...cambios }
  };
  app.guardar();
}

function selectorProtocolo(cfg) {
  const lista = protocolosPara(cfg.modalidad);
  const p = protocolo(cfg.protocolo);
  return `
    <label class="campo-sel">
      <span>Protocolo</span>
      <select data-campo="protocolo">
        ${lista
          .map(
            (x) => `<option value="${x.id}" ${x.id === cfg.protocolo ? "selected" : ""}>${x.nombre} · ${x.minutos} min</option>`
          )
          .join("")}
      </select>
    </label>
    ${p ? `<p class="ficha-mod">Zona ${p.zona} · ${p.porQue}</p>` : ""}`;
}

function selectorMinutos(cfg) {
  return `
    <label class="campo-sel">
      <span>Minutos por sesión</span>
      <select data-campo="minutos">
        ${[20, 25, 30, 35, 40, 45, 50, 60]
          .map((n) => `<option value="${n}" ${n === cfg.minutos ? "selected" : ""}>${n} min</option>`)
          .join("")}
      </select>
    </label>`;
}

/**
 * Avisa cuando la modalidad carga los mismos músculos que la fuerza de ese día.
 * No prohíbe nada: solo evita descubrirlo con la espalda muerta a mitad del remo.
 */
function avisoChoque(app, cfg, m) {
  const avisos = [];
  cfg.dias.forEach((d) => {
    const diaFuerza = app.rutina.dias.find(
      (x) => x.ejercicios && diaCorto(x.dia) === d
    );
    if (!diaFuerza) return;
    const grupos = choqueConFuerza(cfg.modalidad, diaFuerza);
    if (grupos.length) {
      avisos.push(
        `${NOMBRE_DIA[d]} entrenas <b>${diaFuerza.nombre}</b> y ${m.nombre.toLowerCase()} carga
         ${grupos.map((g) => GRUPOS[g].toLowerCase()).join(" y ")}. Déjalo para después de las pesas.`
      );
    }
  });
  if (!avisos.length) return "";
  return `<p class="aviso-choque">${avisos.join("<br>")}</p>`;
}

function diaCorto(texto) {
  return String(texto)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .slice(0, 3);
}

export { etiquetaDias };
