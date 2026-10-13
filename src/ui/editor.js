/**
 * Editor de prescripción, abierto con el lápiz de cada ejercicio.
 *
 * Solo deja tocar lo que es decisión de entrenamiento: series, reps, tempo,
 * RIR, descanso y peso sugerido. El músculo, el equipo y el patrón NO se editan
 * aquí porque alimentan el volumen semanal y el orden de las sustituciones;
 * cambiarlos a ciegas rompería ambos cálculos. Para eso está rutina.json.
 */

import {
  EDITABLES, CLAVES_EDITABLES, ajustar, restaurar, estaAjustado
} from "../logica/ajustes-rutina.js";

export function abrirEditor(app, original, alGuardar) {
  const velo = document.getElementById("velo");
  const hoja = document.getElementById("hoja");
  const capaInicial = app.datos.ajustesRutina || {};
  const actual = { ...original, ...(capaInicial[original.id] || {}) };

  hoja.innerHTML = `
    <h2 id="modalTitulo">${original.nombre}</h2>
    <div class="receta"><span>ajusta la prescripción de este ejercicio</span></div>

    ${CLAVES_EDITABLES.map((k) => campo(k, actual[k], original[k])).join("")}

    <div class="acciones-edit">
      ${estaAjustado(capaInicial, original.id)
        ? `<button class="deshacer" id="edDeshacer">Volver al original</button>`
        : ""}
      <button class="cerrar">Listo</button>
    </div>
    <p class="fuente">
      Los cambios viven en tu teléfono como una capa encima de la rutina: si se
      despliega una versión nueva, conservas tus ajustes y heredas lo demás.
      El músculo y el equipo no se editan aquí porque alimentan el volumen
      semanal y las sustituciones.
    </p>`;

  hoja.querySelectorAll("[data-campo-edit]").forEach((input) => {
    const clave = input.dataset.campoEdit;
    const fila = input.closest(".edit-campo");
    const error = fila.nextElementSibling;

    input.onchange = () => {
      const r = ajustar(app.datos.ajustesRutina, original.id, clave, input.value, original[clave]);
      if (!r.ok) {
        input.classList.add("malo");
        error.textContent = r.error;
        return;
      }
      input.classList.remove("malo");
      error.textContent = "";
      app.datos.ajustesRutina = r.capa;
      app.guardar();

      const marca = fila.querySelector(".orig");
      marca.classList.toggle("cambiado", r.valor !== original[clave]);
      alGuardar?.();
    };
  });

  const deshacer = hoja.querySelector("#edDeshacer");
  if (deshacer) {
    deshacer.onclick = () => {
      app.datos.ajustesRutina = restaurar(app.datos.ajustesRutina, original.id);
      app.guardar();
      cerrar();
      app.pintar();
    };
  }

  hoja.querySelector(".cerrar").onclick = () => {
    cerrar();
    app.pintar();
  };

  velo.classList.add("abierto");
  hoja.scrollTop = 0;
}

function campo(clave, valor, original) {
  const def = EDITABLES[clave];
  const cambiado = valor !== original;
  return `
    <div class="edit-campo">
      <label for="ed-${clave}">${def.etiqueta}</label>
      <input id="ed-${clave}" data-campo-edit="${clave}"
             type="${def.tipo === "numero" ? "number" : "text"}"
             ${def.tipo === "numero" ? `inputmode="numeric" min="${def.min}" max="${def.max}"` : ""}
             value="${valor ?? ""}">
      <span class="orig ${cambiado ? "cambiado" : ""}">${cambiado ? `era ${original}` : ""}</span>
    </div>
    <div class="edit-error"></div>`;
}

function cerrar() {
  document.getElementById("velo").classList.remove("abierto");
}
