/**
 * Pestaña Plan: generar un plan de carrera y seguirlo.
 *
 * Sin plan, muestra el configurador. Con plan, lo primero que se ve es qué
 * toca HOY: es la pregunta que se hace alguien a las seis de la mañana antes
 * de salir a correr, y debe responderse sin tocar nada.
 */

import {
  OBJETIVOS, DIAS_SEMANA, NOMBRE_DIA, DIAS_MINIMOS, FASES,
  generar, semanaActual, semanaDe, sesionDeHoy, diaDeFecha,
  resumenPlan, describir, cumplimiento, conflictos, semanasEntre
} from "../logica/plan.js";
import { formatoRitmo, formatoTiempo, carrerasDeSemana, resumenCarreras } from "../logica/carrera.js";
import { semanaISO } from "../logica/volumen.js";
import {
  diasOcupados, candidatosALiberar, mejorCandidato, puedeLiberar,
  compensaciones, diasRestantes, MINIMO_FUERZA
} from "../logica/dias.js";

/** Los días que ocupa la fuerza, descontando los liberados para correr. */
function diasDeFuerza(app) {
  return diasOcupados(app.rutina, app.datos.ajustes.diasLiberados || []);
}

export function pintarPlan(app, contenedor) {
  const plan = app.datos.plan;
  if (!plan) return pintarConfigurador(app, contenedor);

  contenedor.appendChild(cartelPlan(app, plan));
  contenedor.appendChild(bloqueHoy(app, plan));
  contenedor.appendChild(bloqueSemanas(app, plan));
  contenedor.appendChild(bloqueAcciones(app, plan));
}

/* ---------- configurador ---------- */

function pintarConfigurador(app, contenedor) {
  const fuerza = diasDeFuerza(app);
  const estado = {
    objetivo: "10k",
    dias: ["mar", "jue", "sab"].filter((d) => !fuerza.includes(d)),
    fecha: ""
  };
  // Si la fuerza ocupa esos días, se arranca con los que queden libres.
  if (estado.dias.length < DIAS_MINIMOS) {
    estado.dias = DIAS_SEMANA.filter((d) => !fuerza.includes(d)).slice(0, 3);
  }

  const s = document.createElement("section");
  s.className = "bloque";
  contenedor.appendChild(cartelVacio());
  contenedor.appendChild(s);

  function pintar() {
    const marca = app.datos.ajustes.marca;
    const kmActuales = resumenCarreras(
      carrerasDeSemana(app.datos.carreras, semanaISO(app.hoy()), semanaISO)
    ).km;

    s.innerHTML = `
      <h3>Arma tu plan</h3>
      <p>Elige la distancia y los días que puedes correr. El plan se construye
         sobre tus ritmos, no sobre una tabla, y nunca sube más de 10% de volumen
         por semana.</p>

      <div class="objetivos">
        ${Object.entries(OBJETIVOS)
          .map(
            ([k, o]) => `<button data-obj="${k}" aria-pressed="${estado.objetivo === k}">
              ${o.nombre}<small>${o.semanas} sem</small></button>`
          )
          .join("")}
      </div>

      <h3 style="margin-top:22px">Días que puedes correr</h3>
      <div class="dias-sel">
        ${DIAS_SEMANA.map(
          (d) => `<button data-dia="${d}" class="${fuerza.includes(d) ? "fuerza" : ""}"
            aria-pressed="${estado.dias.includes(d)}"
            aria-label="${NOMBRE_DIA[d]}">${d}</button>`
        ).join("")}
      </div>
      <p class="leyenda-dias">· = día de fuerza · elegidos: ${estado.dias.length}</p>

      <div class="campos" style="margin-top:18px">
        <label class="campo-eti"><span>Fecha de la carrera (opcional)</span>
          <input type="date" id="planFecha" value="${estado.fecha}"></label>
        <label class="campo-eti"><span>Semanas</span>
          <input type="text" id="planSemanas" disabled value="${semanasDisponibles(estado) || OBJETIVOS[estado.objetivo].semanas}"></label>
      </div>

      ${avisoConfig(estado, marca, kmActuales, fuerza)}
      <button class="arranque" id="planGenerar">Generar plan</button>
      ${bloqueLiberar(app, estado, fuerza)}`;

    s.querySelectorAll("[data-obj]").forEach((b) => {
      b.onclick = () => { estado.objetivo = b.dataset.obj; pintar(); };
    });
    s.querySelectorAll("[data-dia]").forEach((b) => {
      b.onclick = () => {
        const d = b.dataset.dia;
        estado.dias = estado.dias.includes(d)
          ? estado.dias.filter((x) => x !== d)
          : [...estado.dias, d];
        pintar();
      };
    });
    s.querySelector("#planFecha").onchange = (ev) => { estado.fecha = ev.target.value; pintar(); };

    s.querySelectorAll("[data-liberar]").forEach((b) => {
      b.onclick = () => {
        const id = b.dataset.liberar;
        const comp = compensaciones(app.rutina, id, app.datos.ajustes.diasLiberados);
        const dia = app.rutina.dias.find((d) => d.id === id);
        const texto = comp.length
          ? `\n\nPara no perder volumen:\n${comp.map((c) => "· " + c.texto).join("\n")}`
          : "";
        if (!confirm(`Liberar ${dia.nombre} (${dia.dia}) para correr.\n\nEl día no se borra: si lo entrenas igual, sus series siguen contando.${texto}\n\n¿Seguro?`)) return;
        app.datos.ajustes.diasLiberados = [...(app.datos.ajustes.diasLiberados || []), id];
        app.guardar();
        // Repinta entero: el configurador recalcula sus días libres por defecto
        // con la fuerza ya reducida, así que el día suelto entra solo.
        app.pintar();
      };
    });

    const devolver = s.querySelector("#liberarDevolver");
    if (devolver) {
      devolver.onclick = () => {
        app.datos.ajustes.diasLiberados = [];
        app.guardar();
        app.pintar();
      };
    }

    s.querySelector("#planGenerar").onclick = () => {
      const r = generar({
        objetivo: estado.objetivo,
        dias: estado.dias,
        semanas: semanasDisponibles(estado) || undefined,
        marca: app.datos.ajustes.marca,
        kmActuales,
        fechaCarrera: estado.fecha || null,
        hoy: app.hoy()
      });
      if (!r.ok) {
        alert(r.error);
        return;
      }
      app.datos.plan = r.plan;
      app.guardar();
      app.pintar();
    };
  }

  function semanasDisponibles(e) {
    if (!e.fecha) return null;
    return Math.max(0, semanasEntre(app.hoy(), e.fecha));
  }

  pintar();
}

function avisoConfig(estado, marca, kmActuales, fuerza) {
  const avisos = [];
  if (estado.dias.length < DIAS_MINIMOS) {
    avisos.push(`Marca al menos ${DIAS_MINIMOS} días. Con menos no se construye base sin acumular riesgo.`);
  }
  const choque = estado.dias.filter((d) => fuerza.includes(d));
  if (choque.length) {
    avisos.push(`${choque.map((d) => NOMBRE_DIA[d]).join(", ")} ${choque.length > 1 ? "llevan" : "lleva"} fuerza. Se puede, pero corre después de las pesas.`);
  }
  if (!marca) {
    avisos.push("Sin una marca reciente en la pestaña Z2, el plan sale sin ritmos. Mete un 5K o 10K a esfuerzo real.");
  }
  if (kmActuales > 0) {
    avisos.push(`Arrancas desde los ${kmActuales} km que llevas esta semana, para no pegar un salto el primer día.`);
  }
  if (!avisos.length) return "";
  return `<p class="cinta-descarga">${avisos.join("<br>")}</p>`;
}

function cartelVacio() {
  const s = document.createElement("section");
  s.className = "cartel";
  s.innerHTML = `
    <div class="rotulo">Sin plan activo</div>
    <h1>Plan</h1>
    <div class="sub">Genera un bloque de entrenamiento para 5K, 10K o media maratón</div>`;
  return s;
}

/* ---------- plan activo ---------- */

function cartelPlan(app, plan) {
  const n = semanaActual(plan, app.hoy());
  const r = resumenPlan(plan);
  const s = document.createElement("section");
  s.className = "cartel";
  s.innerHTML = `
    <div class="rotulo">${plan.nombre} · semana ${n} de ${plan.semanas}</div>
    <h1>Plan</h1>
    <div class="sub">${plan.dias.map((d) => NOMBRE_DIA[d]).join(" · ")}${
      plan.fechaCarrera ? ` · carrera el ${plan.fechaCarrera}` : ""
    }</div>
    <dl class="tape">
      <div><dt>Esta semana</dt><dd>${semanaDe(plan, app.hoy())?.km ?? 0}<small>km</small></dd></div>
      <div><dt>Pico</dt><dd>${r.kmPico}<small>km</small></dd></div>
      <div><dt>Objetivo</dt><dd style="font-size:21px">${
        plan.prediccion ? formatoTiempo(plan.prediccion) : "—"
      }</dd></div>
    </dl>`;
  return s;
}

function bloqueHoy(app, plan) {
  const s = document.createElement("section");
  s.className = "bloque";
  const sesion = sesionDeHoy(plan, app.hoy());
  const semana = semanaDe(plan, app.hoy());

  if (!sesion) {
    const proxima = siguienteDia(plan, app.hoy());
    s.innerHTML = `
      <div class="hoy-toca hoy-descanso">
        <span class="eti">Hoy</span>
        <b>Descanso de carrera</b>
        <span>${proxima ? `Lo próximo: ${NOMBRE_DIA[proxima.dia].toLowerCase()}, ${describir(proxima)}` : "Semana terminada"}</span>
      </div>
      ${bloqueCumplimiento(app, semana)}`;
    return s;
  }

  s.innerHTML = `
    <div class="hoy-toca">
      <span class="eti">Hoy · ${FASES[semana.fase].nombre}</span>
      <b>${sesion.nombre}</b>
      <span>${describir(sesion)}${
        sesion.segPorKm ? ` · tiempo estimado ${formatoTiempo(sesion.km * sesion.segPorKm)}` : ""
      }</span>
    </div>
    ${bloqueCumplimiento(app, semana)}`;
  return s;
}

function siguienteDia(plan, hoy) {
  const semana = semanaDe(plan, hoy);
  if (!semana) return null;
  const i = DIAS_SEMANA.indexOf(diaDeFecha(hoy));
  for (let k = 1; k <= 7; k++) {
    const d = DIAS_SEMANA[(i + k) % 7];
    const s = semana.sesiones.find((x) => x.dia === d);
    if (s) return s;
  }
  return null;
}

function bloqueCumplimiento(app, semana) {
  const corridas = carrerasDeSemana(app.datos.carreras, semanaISO(app.hoy()), semanaISO);
  const c = cumplimiento(semana, corridas);
  const corto = c.porcentaje < 80;
  return `
    <p class="vol-nota" style="border:none;padding-top:14px">
      Llevas <b style="color:var(--tiza)">${c.corrido} km</b> de los ${c.planeado} de esta semana (${c.porcentaje}%).
      Las carreras se registran en la pestaña Z2.
    </p>
    <div class="barra-cumpl"><div class="${corto ? "corto" : ""}" style="width:${Math.min(100, c.porcentaje)}%"></div></div>`;
}

function bloqueSemanas(app, plan) {
  const actual = semanaActual(plan, app.hoy());
  const s = document.createElement("section");
  s.className = "bloque";
  s.innerHTML = `
    <h3>El bloque completo</h3>
    <div class="semanas">
      ${plan.lista
        .map(
          (w) => `<div class="sem-fila ${w.n === actual ? "ahora" : ""}">
            <div class="sem-cab">
              <b>S${w.n}</b>
              <span class="fase">${FASES[w.fase].nombre}${w.n === actual ? " · esta semana" : ""}</span>
              <span class="km">${w.km} km</span>
            </div>
            <div class="sem-ses">
              ${w.sesiones
                .map(
                  (x) => `<span>${x.dia} <b class="${
                    x.sesion === "largo" ? "lg" : x.sesion === "facil" ? "" : "q"
                  }">${x.nombre.split(" ")[0]}</b> ${x.km}k${
                    x.segPorKm ? ` @${formatoRitmo(x.segPorKm)}` : ""
                  }</span>`
                )
                .join("")}
            </div>
          </div>`
        )
        .join("")}
    </div>`;
  return s;
}

function bloqueAcciones(app, plan) {
  const s = document.createElement("section");
  s.className = "bloque";
  const avisos = conflictos(plan, diasDeFuerza(app));

  s.innerHTML = `
    ${avisos.length ? `<p class="cinta-descarga">${avisos.join("<br>")}</p>` : ""}
    <p class="vol-nota" style="border:none;padding-top:0">
      El plan se guardó ya desarrollado en semanas: regenerarlo lo reemplaza por
      completo y empieza de cero desde hoy. Si solo quieres mover un día, corre
      la sesión cuando puedas y regístrala igual.
    </p>
    <button class="arranque gris" id="planRegenerar">Generar otro plan</button>
    <button class="arranque gris peligro-btn" id="planBorrar">Descartar este plan</button>`;

  s.querySelector("#planRegenerar").onclick = () => {
    if (!confirm("Esto reemplaza el plan actual y vuelve a empezar desde hoy. ¿Seguro?")) return;
    app.datos.plan = null;
    app.guardar();
    app.pintar();
  };
  s.querySelector("#planBorrar").onclick = () => {
    if (!confirm("Se descarta el plan. Tus carreras registradas no se tocan. ¿Seguro?")) return;
    app.datos.plan = null;
    app.guardar();
    app.pintar();
  };
  return s;
}


/* ---------- liberar un día de fuerza ---------- */

/**
 * Oferta de soltar un día de pesas para correr.
 *
 * Se muestra siempre que haya margen, no solo cuando faltan días: el plan de
 * 21K sube bastante el volumen y puede convenir aunque hoy quepan tres días.
 * La recomendación sale del cálculo de volumen semanal, no de una opinión.
 */
function bloqueLiberar(app, estado, fuerza) {
  const liberados = app.datos.ajustes.diasLiberados || [];

  if (liberados.length) {
    const sueltos = liberados
      .map((id) => app.rutina.dias.find((d) => d.id === id))
      .filter(Boolean);
    return `
      <div class="liberar">
        <h4>Días de fuerza liberados</h4>
        <p class="cinta-liberado">
          ${sueltos.map((d) => `<b style="display:inline">${d.nombre}</b> (${d.dia})`).join(", ")}
          ${sueltos.length > 1 ? "están libres" : "está libre"} para correr.
          La fuerza queda en ${diasRestantes(app.rutina, liberados)} días.
          El día no se borró: si lo entrenas igual, sus series siguen contando para el volumen.
        </p>
        <button class="arranque gris" id="liberarDevolver">Devolver a fuerza</button>
      </div>`;
  }

  if (!puedeLiberar(app.rutina, liberados)) return "";

  const candidatos = candidatosALiberar(app.rutina, liberados);
  const mejor = mejorCandidato(app.rutina, liberados);
  const libres = DIAS_SEMANA.filter((d) => !fuerza.includes(d)).length;

  return `
    <div class="liberar">
      <h4>¿Necesitas otro día?</h4>
      <p style="font-size:13.5px;color:#CFDDE4;margin:0">
        Tienes ${libres} ${libres === 1 ? "día libre" : "días libres"} de pesas.
        Puedes bajar la fuerza a ${MINIMO_FUERZA} días y usar el que sueltes para correr;
        por debajo de ${MINIMO_FUERZA} ya no se mantiene músculo en déficit.
        Esto es lo que cuesta cada opción, en series semanales:
      </p>
      ${candidatos
        .map(
          (c) => `<button class="candidato ${c.id === mejor.id ? "mejor" : ""}" data-liberar="${c.id}">
            <span class="fila1">
              <b>${c.nombre}</b>
              <span class="dia">${c.dia}${c.id === mejor.id ? " · el que menos cuesta" : ""}</span>
              <span class="costo">−${c.seriesPerdidas} series</span>
            </span>
            <span class="detalle">
              ${c.porGrupo
                .slice(0, 4)
                .map((g) => `${g.nombre} ${g.antes}→${g.despues}`)
                .join(" · ")}
              ${c.caenBajo.length ? `<br>caen bajo rango: <em>${c.caenBajo.join(", ")}</em>` : "<br>ningún grupo cae bajo rango"}
            </span>
          </button>`
        )
        .join("")}
      ${mejor && compensaciones(app.rutina, mejor.id, liberados).length
        ? `<div class="compensar"><b>Si sueltas ${mejor.nombre}, recoloca esto</b>
            <ul>${compensaciones(app.rutina, mejor.id, liberados)
              .map((c) => `<li>${c.texto}</li>`)
              .join("")}</ul></div>`
        : ""}
    </div>`;
}
