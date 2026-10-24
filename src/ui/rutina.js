/**
 * Pestaña Rutina: el cuestionario que arma la rutina de musculación.
 *
 * Todo en una pantalla en vez de en pasos: son cinco preguntas y verlas juntas
 * deja cambiar una y ver el efecto al instante. La vista previa se recalcula en
 * cada toque, así que se puede jugar con el tiempo por sesión y ver qué entra y
 * qué se cae antes de decidir.
 *
 * Nada se aplica hasta pulsar el botón. Mientras tanto la rutina en uso no se
 * toca.
 */

import {
  OBJETIVOS_RUTINA, EQUIPOS, EXPERIENCIA, SPLITS, DIAS_MIN, DIAS_MAX,
  MINUTOS_MINIMOS, generarRutina, volumenDeRutina, gruposCortos
} from "../logica/generador.js";
import { GRUPOS } from "../logica/volumen.js";

export function pintarRutina(app, contenedor) {
  const enUso = app.datos.rutinaGenerada;

  // El cuestionario arranca de la rutina en uso si la hay, para que rehacerla
  // sea retocar lo que ya eligió y no empezar de cero otra vez.
  const estado = {
    dias: enUso?.dias?.length || 4,
    minutos: enUso?.minutos || 60,
    objetivo: enUso?.objetivo || "recomposicion",
    equipo: enUso?.equipo || "completo",
    experiencia: enUso?.experiencia || "intermedio"
  };

  contenedor.appendChild(cartel(app, enUso));
  const cuerpo = document.createElement("section");
  cuerpo.className = "bloque";
  contenedor.appendChild(cuerpo);

  function previa() {
    return generarRutina({
      ...estado,
      catalogo: app.catalogo,
      rutinaPrevia: app.rutina,
      hoy: app.hoy()
    });
  }

  function pintar() {
    const r = previa();

    cuerpo.innerHTML = `
      ${enUso ? bloqueEnUso(enUso) : ""}

      <h3>Arma tu rutina</h3>
      <p>Cinco preguntas. La vista previa se actualiza sola: mueve el tiempo por
         sesión y mira qué entra y qué se cae.</p>

      ${pregunta("Días de fuerza por semana", "Zona 2 y HIIT van aparte, no cuentan aquí.", `
        <div class="opciones cinco">
          ${rango(DIAS_MIN, DIAS_MAX)
            .map(
              (d) => `<button data-dias="${d}" aria-pressed="${estado.dias === d}">
                ${d}<small>${SPLITS[d].nombre.split(" ")[0]}</small></button>`
            )
            .join("")}
        </div>
        <p class="vol-nota" style="border:none;padding-top:8px">${SPLITS[estado.dias].nombre}</p>`)}

      ${pregunta("Minutos por sesión", "Incluye calentamiento. Es un tope, no una meta: la rutina se recorta para entrar.", `
        <div class="deslizador">
          <input type="range" id="minSlider" min="${MINUTOS_MINIMOS}" max="90" step="5" value="${estado.minutos}">
          <span class="valor">${estado.minutos}<small> min</small></span>
        </div>`)}

      ${pregunta("Objetivo", OBJETIVOS_RUTINA[estado.objetivo].descripcion, `
        <div class="opciones dos">
          ${Object.entries(OBJETIVOS_RUTINA)
            .map(
              ([k, o]) => `<button data-obj="${k}" aria-pressed="${estado.objetivo === k}">
                ${o.nombre}<small>${o.reps[0]}-${o.reps[1]} reps · ${o.descanso}s</small></button>`
            )
            .join("")}
        </div>`)}

      ${pregunta("Equipo disponible", "Decide qué ejercicios puede elegir el generador.", `
        <div class="opciones dos">
          ${Object.entries(EQUIPOS)
            .map(
              ([k, e]) => `<button data-eq="${k}" aria-pressed="${estado.equipo === k}">
                ${e.nombre}</button>`
            )
            .join("")}
        </div>`)}

      ${pregunta("Experiencia entrenando", "Cuánto volumen y cuántos ejercicios aguantas por sesión.", `
        <div class="opciones">
          ${Object.entries(EXPERIENCIA)
            .map(
              ([k, e]) => `<button data-exp="${k}" aria-pressed="${estado.experiencia === k}">
                ${e.nombre}<small>hasta ${e.maxEjercicios} ejercicios</small></button>`
            )
            .join("")}
        </div>`)}

      <h3 style="margin-top:26px">Así quedaría</h3>
      ${r.ok ? vistaPrevia(r) : `<p class="cinta-descarga">${r.error}</p>`}

      ${r.ok
        ? `<button class="arranque" id="aplicarRutina">
            ${enUso ? "Reemplazar la rutina en uso" : "Usar esta rutina"}</button>`
        : ""}
      ${enUso ? `<button class="arranque gris" id="volverOriginal">Volver a la rutina original</button>` : ""}`;

    cuerpo.querySelectorAll("[data-dias]").forEach((b) => {
      b.onclick = () => { estado.dias = Number(b.dataset.dias); pintar(); };
    });
    cuerpo.querySelectorAll("[data-obj]").forEach((b) => {
      b.onclick = () => { estado.objetivo = b.dataset.obj; pintar(); };
    });
    cuerpo.querySelectorAll("[data-eq]").forEach((b) => {
      b.onclick = () => { estado.equipo = b.dataset.eq; pintar(); };
    });
    cuerpo.querySelectorAll("[data-exp]").forEach((b) => {
      b.onclick = () => { estado.experiencia = b.dataset.exp; pintar(); };
    });

    const slider = cuerpo.querySelector("#minSlider");
    slider.oninput = () => {
      estado.minutos = Number(slider.value);
      cuerpo.querySelector(".deslizador .valor").innerHTML = `${estado.minutos}<small> min</small>`;
    };
    slider.onchange = () => { estado.minutos = Number(slider.value); pintar(); };

    const aplicar = cuerpo.querySelector("#aplicarRutina");
    if (aplicar) {
      aplicar.onclick = () => {
        const nueva = previa();
        if (!nueva.ok) return;
        const conservados = idsConservados(app, nueva.rutina);
        const aviso = enUso
          ? "Esto reemplaza la rutina de fuerza que estás usando."
          : "Esto reemplaza Push, Pull, Legs y Full Body por la rutina generada.";
        const historial = conservados
          ? `\n\n${conservados} ejercicio(s) conservan su historial y sus récords.`
          : "";
        if (!confirm(`${aviso}${historial}\n\nZona 2 y HIIT no se tocan. Puedes volver a la original cuando quieras.\n\n¿Seguro?`)) return;

        app.datos.rutinaGenerada = nueva.rutina;
        app.diaActivo = nueva.rutina.dias[0].id;
        app.guardar();
        app.pintarTodo();
      };
    }

    const volver = cuerpo.querySelector("#volverOriginal");
    if (volver) {
      volver.onclick = () => {
        if (!confirm("Vuelves a Push / Pull / Legs / Full Body.\n\nTus registros no se tocan. ¿Seguro?")) return;
        app.datos.rutinaGenerada = null;
        app.diaActivo = "push";
        app.guardar();
        app.pintarTodo();
      };
    }
  }

  pintar();
}

/* ---------- piezas ---------- */

function rango(desde, hasta) {
  return Array.from({ length: hasta - desde + 1 }, (_, i) => desde + i);
}

function pregunta(titulo, ayuda, cuerpo) {
  return `<div class="pregunta">
    <h4>${titulo}</h4>
    <p class="ayuda">${ayuda}</p>
    ${cuerpo}
  </div>`;
}

function cartel(app, enUso) {
  const s = document.createElement("section");
  s.className = "cartel";
  s.innerHTML = `
    <div class="rotulo">${enUso ? enUso.split : "Push / Pull / Legs / Full Body"}</div>
    <h1>Rutina</h1>
    <div class="sub">${
      enUso
        ? `${enUso.dias.length} días · ${enUso.minutos} min · ${OBJETIVOS_RUTINA[enUso.objetivo].nombre.toLowerCase()}`
        : "La rutina original del repositorio"
    }</div>`;
  return s;
}

function bloqueEnUso(enUso) {
  return `
    <div class="en-uso">
      <b>Rutina generada en uso</b>
      ${enUso.split}, creada el ${enUso.creada}. Las pestañas de fuerza vienen de aquí.
      Zona 2 y HIIT siguen siendo las de siempre.
    </div>`;
}

function vistaPrevia(r) {
  const vol = volumenDeRutina(r.rutina);
  const cortos = gruposCortos(r.rutina);

  return `
    <div class="marco-previa">
      ${r.rutina.dias
        .map(
          (d) => `<div class="previa-dia">
            <div class="previa-cab">
              <b>${d.nombre}</b>
              <span class="dia">${d.dia}</span>
              <span class="min">${d.minutosEstimados} min</span>
            </div>
            ${d.ejercicios
              .map(
                (e) => `<div class="previa-ej ${e.mecanica === "compound" ? "comp" : ""}">
                  <span class="ser">${e.series}×${e.reps}</span>
                  <span class="nom">${e.nombre}</span>
                  <span class="gr">${GRUPOS[e.grupo]}</span>
                </div>`
              )
              .join("")}
          </div>`
        )
        .join("")}
    </div>

    <h3 style="margin-top:22px">Volumen semanal que produce</h3>
    ${Object.entries(vol)
      .sort((a, b) => b[1] - a[1])
      .map(([g, n]) => {
        const corto = cortos.find((c) => c.grupo === g);
        return `<div class="vol-fila ${corto ? "bajo" : "dentro"}">
          <div class="vol-cab"><b>${GRUPOS[g]}</b>
            <span><em>${n}</em> series</span></div>
          <div class="vol-pista"><div class="vol-barra" style="width:${Math.min(100, (n / 24) * 100)}%"></div></div>
        </div>`;
      })
      .join("")}

    ${cortos.length
      ? `<p class="cinta-descarga">Se quedan cortos: ${cortos
          .map((c) => `${c.nombre.toLowerCase()} (${c.series} de ${c.rango.min})`)
          .join(", ")}. Con pocos días a la semana es inevitable: hay que elegir qué priorizar.</p>`
      : `<p class="vol-nota">Todos los grupos dentro de su rango semanal.</p>`}

    ${r.avisos?.length
      ? `<p class="vol-nota">${r.avisos.join("<br>")}</p>`
      : ""}`;
}

/** Cuántos ejercicios de la rutina nueva conservan un id ya conocido. */
function idsConservados(app, nueva) {
  const previos = new Set(
    app.rutina.dias
      .filter((d) => d.ejercicios)
      .flatMap((d) => d.ejercicios.map((e) => e.id))
  );
  return nueva.dias
    .flatMap((d) => d.ejercicios)
    .filter((e) => previos.has(e.id)).length;
}
