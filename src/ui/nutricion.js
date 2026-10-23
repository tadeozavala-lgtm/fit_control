/**
 * Pestaña Nutrición.
 *
 * El orden de la pantalla responde a las preguntas en el orden en que se hacen:
 * cuánto como hoy, de qué, cómo lo reparto, y voy bien o no.
 *
 * El número de calorías NO se presenta como una verdad: viene de fórmulas que
 * fallan ±10%, y la pantalla lo dice. Lo que manda es la báscula, y el bloque
 * de tendencia es el que corrige.
 */

import {
  ACTIVIDAD, OBJETIVOS_NUTRI, tmb, caloriasObjetivo, macros, repartirComidas,
  PLANTILLAS, FUENTES_PROTEINA, porcionPara, mediaMovil, tendencia,
  cambioEsperado, ajustePorTendencia, perdidaDemasiadoRapida, DEFICIT_MAXIMO, pisoCalorico
} from "../logica/nutricion.js";
import { gastoTotalDiario, pesoActual, registrarPeso } from "../logica/gasto.js";

export function pintarNutricion(app, contenedor) {
  const n = app.datos.nutricion;
  const peso = pesoActual(app.datos);
  const edad = app.datos.ajustes.edad;
  const base = tmb(n.sexo, peso, n.altura, edad);

  if (!base) {
    contenedor.appendChild(cartel(app, 0, null));
    contenedor.appendChild(bloqueDatos(app));
    return;
  }

  const gasto = gastoTotalDiario(app.datos, app.hoy(), peso, base, n.actividad);
  const objetivoKcal = caloriasObjetivo(gasto.total, n.objetivo, base);
  // El ajuste manual viene de la báscula y puede empujar por debajo del piso,
  // así que se vuelve a topar después de aplicarlo.
  const kcalFinal = Math.max(
    pisoCalorico(base),
    objetivoKcal.objetivo + (n.ajusteManual || 0)
  );
  const m = macros(kcalFinal, peso, n.objetivo);

  contenedor.appendChild(cartel(app, kcalFinal, m));
  contenedor.appendChild(bloqueObjetivo(app));
  contenedor.appendChild(bloqueGasto(app, gasto, objetivoKcal, kcalFinal, base));
  contenedor.appendChild(bloqueMacros(app, m, peso));
  contenedor.appendChild(bloqueComidas(app, m));
  contenedor.appendChild(bloquePeso(app, peso, kcalFinal, gasto.total));
  contenedor.appendChild(bloqueDatos(app));
}

/* ---------- encabezado ---------- */

function cartel(app, kcal, m) {
  const n = app.datos.nutricion;
  const s = document.createElement("section");
  s.className = "cartel";
  s.innerHTML = `
    <div class="rotulo">${OBJETIVOS_NUTRI[n.objetivo]?.nombre || "Nutrición"}</div>
    <h1>Comer</h1>
    <div class="sub">${kcal ? `${kcal} kcal al día · estimación de partida` : "Completa tus datos abajo"}</div>
    ${m
      ? `<dl class="tape">
          <div><dt>Proteína</dt><dd>${m.proteina}<small>g</small></dd></div>
          <div><dt>Grasa</dt><dd>${m.grasa}<small>g</small></dd></div>
          <div><dt>Carbos</dt><dd>${m.carbo}<small>g</small></dd></div>
        </dl>`
      : ""}`;
  return s;
}

/* ---------- objetivo ---------- */

function bloqueObjetivo(app) {
  const n = app.datos.nutricion;
  const s = document.createElement("section");
  s.className = "bloque";
  s.innerHTML = `
    <h3>Objetivo</h3>
    <div class="objetivos" style="grid-template-columns:repeat(2,1fr)">
      ${Object.entries(OBJETIVOS_NUTRI)
        .map(
          ([k, o]) => `<button data-obj-nutri="${k}" aria-pressed="${n.objetivo === k}">
            ${o.nombre}<small>${o.ajuste === 0 ? "igual al gasto" : `${o.ajuste > 0 ? "+" : ""}${Math.round(o.ajuste * 100)}%`}</small>
          </button>`
        )
        .join("")}
    </div>
    <p class="vol-nota" style="border:none;padding-top:12px">${OBJETIVOS_NUTRI[n.objetivo].nota}</p>`;

  s.querySelectorAll("[data-obj-nutri]").forEach((b) => {
    b.onclick = () => {
      n.objetivo = b.dataset.objNutri;
      app.guardar();
      app.pintar();
    };
  });
  return s;
}

/* ---------- de dónde sale el número ---------- */

function bloqueGasto(app, gasto, objetivoKcal, kcalFinal, base) {
  const n = app.datos.nutricion;
  const s = document.createElement("section");
  s.className = "bloque";
  const ajuste = objetivoKcal.ajuste;
  const manual = n.ajusteManual || 0;

  s.innerHTML = `
    <h3>De dónde sale</h3>
    <p>El entrenamiento se suma aparte del gasto de vivir, y se promedia sobre
       los últimos 14 días: comer según lo que entrenaste cada día produce
       saltos de 600 kcal que nadie sostiene.</p>
    <table class="desglose">
      <tr><td>Metabolismo basal</td><td>${base} kcal</td></tr>
      <tr><td>Vida diaria (${ACTIVIDAD[n.actividad].nombre.toLowerCase()})</td><td>+${gasto.base - base} kcal</td></tr>
      <tr><td>Entrenamiento, media de ${gasto.medio.dias} días</td><td>+${gasto.entrenamiento} kcal</td></tr>
      <tr class="suma"><td>Gasto</td><td>${gasto.total} kcal</td></tr>
      <tr class="${ajuste < 0 ? "resta" : ""}"><td>${OBJETIVOS_NUTRI[n.objetivo].nombre}</td><td>${ajuste >= 0 ? "+" : ""}${ajuste} kcal</td></tr>
      ${manual ? `<tr class="${manual < 0 ? "resta" : ""}"><td>Ajuste por tu báscula</td><td>${manual > 0 ? "+" : ""}${manual} kcal</td></tr>` : ""}
      <tr class="suma"><td>Comer</td><td>${kcalFinal} kcal</td></tr>
    </table>
    ${objetivoKcal.limitado === "piso"
      ? `<p class="cinta-descarga">El déficit se topó en tu metabolismo basal. Comer menos de lo que cuesta estar vivo no acelera nada, y con cinco días de entrenamiento encima menos.</p>`
      : ""}
    <p class="vol-nota">
      Hoy llevas ${gasto.hoy.series} series y ${gasto.hoy.km} km:
      <b style="color:var(--tiza)">${gasto.hoy.total} kcal</b> de entrenamiento.
      No cambies la comida por eso; el promedio ya lo tiene en cuenta.
    </p>`;
  return s;
}

/* ---------- macros ---------- */

function bloqueMacros(app, m, peso) {
  const s = document.createElement("section");
  s.className = "bloque";
  if (!m) return s;

  s.innerHTML = `
    <h3>Macronutrientes</h3>
    <p>Primero la proteína, que es la que protege el músculo; luego un mínimo de
       grasa para la parte hormonal; los carbohidratos se llevan el resto, que es
       lo que alimenta el entrenamiento.</p>
    <dl class="macros">
      <div class="p"><dt>Proteína</dt><dd>${m.proteina}<small>g · ${m.porKgProteina}/kg</small></dd></div>
      <div class="g"><dt>Grasa</dt><dd>${m.grasa}<small>g</small></dd></div>
      <div><dt>Carbos</dt><dd>${m.carbo}<small>g</small></dd></div>
    </dl>
    <div class="barra-macro">
      <span class="p" style="width:${m.reparto.proteina}%"></span>
      <span class="g" style="width:${m.reparto.grasa}%"></span>
      <span class="c" style="width:${m.reparto.carbo}%"></span>
    </div>
    <div class="leyenda-macro">
      <span style="color:var(--esquina)">■ proteína ${m.reparto.proteina}%</span>
      <span style="color:var(--record)">■ grasa ${m.reparto.grasa}%</span>
      <span>■ carbos ${m.reparto.carbo}%</span>
    </div>
    ${m.recortado
      ? `<p class="cinta-descarga">Con esas calorías no caben la proteína y la grasa mínimas de golpe, así que se recortaron a proporción. Señal de que el objetivo es demasiado agresivo para tu peso.</p>`
      : ""}
    <p class="vol-nota">${m.proteina} g de proteína son, por ejemplo,
      ${FUENTES_PROTEINA.slice(0, 3)
        .map((f) => `${porcionPara(m.proteina, f)} g de ${f.nombre.toLowerCase()}`)
        .join(", ")}. Repártelos en el día, no los dejes para la cena.</p>`;
  return s;
}

/* ---------- comidas ---------- */

function bloqueComidas(app, m) {
  const n = app.datos.nutricion;
  const s = document.createElement("section");
  s.className = "bloque";
  if (!m) return s;

  const comidas = repartirComidas(m, n.comidas);

  s.innerHTML = `
    <h3>Cómo repartirlo</h3>
    <div class="objetivos">
      ${Object.keys(PLANTILLAS)
        .map(
          (k) => `<button data-comidas="${k}" aria-pressed="${String(n.comidas) === k}">
            ${k}<small>comidas</small></button>`
        )
        .join("")}
    </div>
    <div class="comidas">
      ${comidas
        .map(
          (c) => `<div class="comida">
            <div class="cab"><b>${c.nombre}</b><span>${c.calorias} kcal</span></div>
            <div class="mac">
              <span>P <em>${c.proteina} g</em></span>
              <span>G <em>${c.grasa} g</em></span>
              <span>C <em>${c.carbo} g</em></span>
            </div>
            <div class="ejemplo">${ejemploPorcion(c.proteina)}</div>
          </div>`
        )
        .join("")}
    </div>
    <p class="vol-nota">Las porciones son equivalencias en crudo, para que el
      número de gramos se vea en el plato. No es un menú: cambia la fuente por
      la que tengas, manteniendo los gramos de proteína.</p>`;

  s.querySelectorAll("[data-comidas]").forEach((b) => {
    b.onclick = () => {
      n.comidas = Number(b.dataset.comidas);
      app.guardar();
      app.pintar();
    };
  });
  return s;
}

function ejemploPorcion(gProteina) {
  if (!(gProteina > 0)) return "";
  return FUENTES_PROTEINA.slice(0, 2)
    .map((f) => `${porcionPara(gProteina, f)} g de ${f.nombre.toLowerCase()}`)
    .join(" · ");
}

/* ---------- peso y tendencia ---------- */

function bloquePeso(app, peso, kcal, gasto) {
  const n = app.datos.nutricion;
  const s = document.createElement("section");
  s.className = "bloque";
  const serie = mediaMovil(app.datos.pesos).slice(-10).reverse();
  const t = tendencia(app.datos.pesos);
  const esperado = cambioEsperado(kcal, gasto);
  const sugerencia = ajustePorTendencia(app.datos.pesos, kcal, gasto, n.objetivo);

  s.innerHTML = `
    <h3>Tu peso manda</h3>
    <p>Todas las fórmulas de arriba se equivocan hasta un 10% entre personas.
       La báscula no. Pésate en ayunas, varias veces por semana, y deja que la
       media decida.</p>

    <div class="campos">
      <label class="campo-eti"><span>Peso de hoy (kg)</span>
        <input type="number" inputmode="decimal" step="0.1" min="30" max="400"
               id="pesoHoy" placeholder="${peso || "110"}"></label>
      <label class="campo-eti"><span>&nbsp;</span>
        <button class="arranque" style="margin:0;padding:11px" id="pesoGuardar">Registrar</button></label>
    </div>

    ${cajaTendencia(t, esperado, sugerencia, peso, n)}

    ${serie.length
      ? `<div class="pesos">
          ${serie
            .map((x) => {
              const [, mes, dia] = x.fecha.split("-");
              return `<div class="peso-fila">
                <span class="f">${dia}/${mes}</span>
                <span class="kg">${x.peso} kg</span>
                <span class="media">media ${x.media}</span>
              </div>`;
            })
            .join("")}
        </div>`
      : `<p class="vol-nota">Sin registros todavía. Con unos diez días la app ya
          puede comparar tu tendencia real contra la que el plan espera.</p>`}`;

  s.querySelector("#pesoGuardar").onclick = () => {
    const input = s.querySelector("#pesoHoy");
    const kg = Number(input.value);
    if (!(kg > 0)) {
      alert("Pon tu peso en kilogramos.");
      return;
    }
    app.datos.pesos = registrarPeso(app.datos, app.hoy(), kg);
    app.guardar();
    app.pintar();
  };

  const aplicar = s.querySelector("#aplicarAjuste");
  if (aplicar) {
    aplicar.onclick = () => {
      n.ajusteManual = (n.ajusteManual || 0) + sugerencia.delta;
      app.guardar();
      app.pintar();
    };
  }
  const quitar = s.querySelector("#quitarAjuste");
  if (quitar) {
    quitar.onclick = () => {
      n.ajusteManual = 0;
      app.guardar();
      app.pintar();
    };
  }
  return s;
}

function cajaTendencia(t, esperado, sugerencia, peso, n) {
  if (!t) return "";

  const rapido = perdidaDemasiadoRapida(t.kgPorSemana, peso);
  const clase = rapido ? "alerta" : sugerencia?.aplicar ? "ajusta" : "";
  const titulo = rapido
    ? "Estás bajando demasiado rápido"
    : sugerencia?.aplicar
      ? "Conviene ajustar"
      : "Vas en línea";

  return `
    <div class="tendencia-caja ${clase}">
      <b>${titulo}</b>
      ${rapido
        ? `Más del 1% de tu peso por semana es territorio donde se pierde músculo, no solo grasa. Sube calorías aunque el espejo diga lo contrario.`
        : sugerencia?.motivo || ""}
      <div class="cifras">
        real ${t.kgPorSemana > 0 ? "+" : ""}${t.kgPorSemana} kg/sem ·
        previsto ${esperado > 0 ? "+" : ""}${esperado} kg/sem ·
        ${t.dias} días · ${t.desde} → ${t.hasta} kg
      </div>
      ${sugerencia?.aplicar
        ? `<button class="arranque gris" id="aplicarAjuste" style="margin-top:10px">
            Aplicar ${sugerencia.delta > 0 ? "+" : ""}${sugerencia.delta} kcal</button>`
        : ""}
      ${n.ajusteManual
        ? `<button class="arranque gris" id="quitarAjuste" style="margin-top:8px">
            Quitar el ajuste actual (${n.ajusteManual > 0 ? "+" : ""}${n.ajusteManual} kcal)</button>`
        : ""}
    </div>`;
}

/* ---------- datos ---------- */

function bloqueDatos(app) {
  const n = app.datos.nutricion;
  const s = document.createElement("section");
  s.className = "bloque";

  s.innerHTML = `
    <h3>Tus datos</h3>
    <div class="campos tres">
      <label class="campo-eti"><span>Sexo</span>
        <select id="nutSexo">
          <option value="hombre" ${n.sexo === "hombre" ? "selected" : ""}>Hombre</option>
          <option value="mujer" ${n.sexo === "mujer" ? "selected" : ""}>Mujer</option>
        </select></label>
      <label class="campo-eti"><span>Altura (cm)</span>
        <input type="number" inputmode="numeric" min="120" max="230" id="nutAltura" value="${n.altura}"></label>
      <label class="campo-eti"><span>Edad</span>
        <input type="number" inputmode="numeric" min="14" max="99" id="nutEdad" value="${app.datos.ajustes.edad}"></label>
    </div>
    <label class="campo-eti" style="margin-top:12px;display:block"><span>Actividad fuera del entrenamiento</span>
      <select id="nutActividad">
        ${Object.entries(ACTIVIDAD)
          .map(
            ([k, a]) => `<option value="${k}" ${n.actividad === k ? "selected" : ""}>${a.nombre} — ${a.para}</option>`
          )
          .join("")}
      </select></label>
    <p class="vol-nota">Elige según tu día sin contar el gimnasio ni correr: eso
      ya se suma aparte con lo que registras.</p>

    <p class="nota-salud">
      Los números de esta pantalla son estimaciones de fórmulas poblacionales
      (Mifflin-St Jeor) con un error típico del 10%, y el gasto del
      entrenamiento es una aproximación, no una medición. Sirven como punto de
      partida; lo que decide es la tendencia de tu peso.
      El déficit está topado en el ${Math.round(DEFICIT_MAXIMO * 100)}% y nunca baja de tu
      metabolismo basal. Para un plan ajustado de verdad —y más con un objetivo
      de recomposición sostenido— un nutriólogo y una analítica valen más que
      cualquier calculadora.
    </p>`;

  const guardar = (id, campo, min, max, enAjustes) => {
    const el = s.querySelector(id);
    el.onchange = () => {
      const v = campo === "sexo" || campo === "actividad" ? el.value : Number(el.value);
      if (typeof v === "number" && (!(v >= min) || !(v <= max))) {
        el.value = enAjustes ? app.datos.ajustes[campo] : n[campo];
        return;
      }
      if (enAjustes) app.datos.ajustes[campo] = v;
      else n[campo] = v;
      app.guardar();
      app.pintar();
    };
  };
  guardar("#nutSexo", "sexo");
  guardar("#nutAltura", "altura", 120, 230);
  guardar("#nutEdad", "edad", 14, 99, true);
  guardar("#nutActividad", "actividad");

  return s;
}
