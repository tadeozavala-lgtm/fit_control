/**
 * Bloque de notas al pie de cada día de fuerza.
 *
 * Va al final a propósito: se contesta al terminar de entrenar, no al llegar.
 * Tres toques y listo; el texto libre es opcional.
 */

import {
  ESCALAS, CLAVES, MAYOR_ES_MEJOR, anotar, alerta, consejo, sesionesConNotas
} from "../logica/notas.js";

export function pintarNotas(app, dia, contenedor) {
  const ses = app.sesionActiva(dia.id);
  if (!ses.notas) ses.notas = { sueno: null, energia: null, molestia: null, texto: "" };

  const seccion = document.createElement("section");
  seccion.className = "notas";
  seccion.innerHTML = `
    <h3>Cómo llegaste hoy</h3>
    <p class="intro">Opcional · avisa del estancamiento antes que los pesos</p>
    ${avisoFatiga(app)}
    ${CLAVES.map((k) => bloqueSenal(k, ses.notas[k])).join("")}
    <textarea id="notaTexto" rows="2"
      placeholder="Algo que quieras recordar de esta sesión"
      aria-label="Nota libre de la sesión">${ses.notas.texto || ""}</textarea>`;

  seccion.querySelectorAll("[data-senal]").forEach((b) => {
    b.onclick = () => {
      const clave = b.dataset.senal;
      const valor = Number(b.dataset.valor);
      // Volver a tocar el mismo valor lo borra: contestar mal no debe ser trampa.
      anotar(ses, clave, ses.notas[clave] === valor ? null : valor);
      app.guardar();
      refrescarSenal(seccion, clave, ses.notas[clave]);
    };
  });

  const texto = seccion.querySelector("#notaTexto");
  texto.oninput = () => {
    anotar(ses, "texto", texto.value);
    app.guardar();
  };

  contenedor.appendChild(seccion);
}

function bloqueSenal(clave, valor) {
  const e = ESCALAS[clave];
  const inverso = !MAYOR_ES_MEJOR[clave];
  return `
    <div class="senal ${inverso ? "inverso" : ""}" data-bloque="${clave}">
      <div class="preg">${e.pregunta}</div>
      <div class="escala" role="group" aria-label="${e.etiqueta}">
        ${[1, 2, 3, 4, 5]
          .map(
            (n) => `<button data-senal="${clave}" data-valor="${n}"
              aria-pressed="${valor === n}"
              aria-label="${e.etiqueta}: ${e.niveles[n - 1]}">${n}</button>`
          )
          .join("")}
      </div>
      <div class="leyenda">${valor ? e.niveles[valor - 1] : ""}</div>
    </div>`;
}

/** Solo repinta los cinco botones de esa señal y su leyenda. */
function refrescarSenal(seccion, clave, valor) {
  const bloque = seccion.querySelector(`[data-bloque="${clave}"]`);
  bloque.querySelectorAll("button").forEach((b) => {
    b.setAttribute("aria-pressed", String(Number(b.dataset.valor) === valor));
  });
  bloque.querySelector(".leyenda").textContent = valor ? ESCALAS[clave].niveles[valor - 1] : "";
}

function avisoFatiga(app) {
  // Todas las sesiones con notas, no solo las de este día: la fatiga se acumula
  // a través de la semana entera, no por patrón de movimiento.
  const { nivel, motivos } = alerta(sesionesConNotas(app.datos));
  if (nivel === "ninguna") return "";

  return `
    <div class="alerta-fatiga ${nivel}">
      <b>${nivel === "alta" ? "Fatiga acumulada" : "Ojo con la fatiga"}</b>
      <ul>${motivos.map((m) => `<li>${m}</li>`).join("")}</ul>
      ${consejo(nivel)}
    </div>`;
}
