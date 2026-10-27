/**
 * Visor de la mecánica del ejercicio, dentro de la ventana de técnica.
 *
 * Son dos fotos —inicio y fin del movimiento— que se alternan. Es lo que hace
 * un GIF, pero sin un GIF: dos WebP de 17 KB pesan menos que cualquier vídeo,
 * se pueden pausar y, si el usuario pidió menos animación, se quedan quietas.
 */

import { fotosDeEjercicio, FUENTE, MS_POR_CUADRO } from "../logica/imagenes.js";

let temporizador = null;

export function htmlMecanica(ejercicio) {
  const fotos = fotosDeEjercicio(ejercicio);
  if (!fotos.length) return "";

  const cuadros = fotos
    .map(
      (f, i) =>
        `<img class="cuadro${i === 0 ? " ver" : ""}" src="${f}" decoding="async"
          alt="${ejercicio.nombre}: ${etiqueta(i, fotos.length)} del movimiento">`
    )
    .join("");

  const mando =
    fotos.length > 1
      ? `<div class="mando">
          <button class="pausa" type="button">Pausar</button>
          <span class="paso">${etiqueta(0, fotos.length)}</span>
        </div>`
      : "";

  return `<div class="mecanica">
    <div class="marco">${cuadros}</div>
    ${mando}
    <p class="sinfoto" hidden>No pude cargar las fotos. Ábrelas una vez con señal
      y se quedan guardadas para cuando el gimnasio no tenga cobertura.</p>
    <p class="fuente">Fotos: <a href="${FUENTE.url}">${FUENTE.nombre}</a> · ${FUENTE.licencia}</p>
  </div>`;
}

export function conectarMecanica(hoja) {
  detenerMecanica();
  const caja = hoja.querySelector(".mecanica");
  if (!caja) return;

  const cuadros = [...caja.querySelectorAll(".cuadro")];
  const paso = caja.querySelector(".paso");
  const boton = caja.querySelector(".pausa");

  // Si ninguna foto carga no sirve de nada dejar el hueco en blanco: lo más
  // probable es que sea la primera vez que se abre este ejercicio y no haya red.
  let fallidas = 0;
  for (const img of cuadros) {
    img.onerror = () => {
      if (++fallidas < cuadros.length) return;
      caja.querySelector(".marco").hidden = true;
      if (boton) boton.closest(".mando").hidden = true;
      caja.querySelector(".sinfoto").hidden = false;
    };
  }

  if (cuadros.length < 2) return;

  let i = 0;
  const ver = (n) => {
    cuadros[i].classList.remove("ver");
    i = n;
    cuadros[i].classList.add("ver");
    if (paso) paso.textContent = etiqueta(i, cuadros.length);
  };

  const arrancar = () => {
    temporizador = setInterval(() => {
      // La hoja se reutiliza para otras ventanas; si estos nodos ya no están
      // en el documento, el intervalo sobra.
      if (!cuadros[0].isConnected) return detenerMecanica();
      ver((i + 1) % cuadros.length);
    }, MS_POR_CUADRO);
    boton.textContent = "Pausar";
  };

  boton.onclick = () => {
    if (temporizador) {
      detenerMecanica();
      boton.textContent = "Animar";
    } else {
      arrancar();
    }
  };

  if (prefiereQuieto()) boton.textContent = "Animar";
  else arrancar();
}

export function detenerMecanica() {
  if (temporizador) clearInterval(temporizador);
  temporizador = null;
}

function etiqueta(i, total) {
  if (total === 2) return i === 0 ? "inicio" : "fin";
  return `${i + 1} de ${total}`;
}

function prefiereQuieto() {
  return globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}
