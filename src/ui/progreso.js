import { conUnidad, mostrar, kgALb } from "../logica/unidades.js";
import { mejorSerie, tonelaje } from "../logica/fuerza.js";
import { sesionesDe, exportarCSV, exportarJSON, importarJSON } from "../logica/almacen.js";
import { resumen, semanaISO, lunesDe, semanasConDatos } from "../logica/volumen.js";

export function pintarProgreso(app, contenedor) {
  const u = app.unidad();
  const sesiones = Object.values(app.datos.sesiones).filter((s) =>
    Object.values(s.ej || {}).some((a) => (a || []).some((x) => x && x.ok))
  );
  let tonTotal = 0;
  sesiones.forEach((s) => Object.values(s.ej).forEach((a) => { tonTotal += tonelaje(a); }));

  const cartel = document.createElement("section");
  cartel.className = "cartel";
  cartel.innerHTML = `
    <div class="rotulo">Acumulado</div><h1>Progreso</h1>
    <dl class="tape">
      <div><dt>Sesiones</dt><dd>${sesiones.length}</dd></div>
      <div><dt>Volumen</dt><dd>${Math.round((Number(mostrar(tonTotal, u)) || 0) / 1000)}<small>${u === "lb" ? "k lb" : "ton"}</small></dd></div>
      <div><dt>Semana</dt><dd>${app.datos.semana}</dd></div>
    </dl>`;
  contenedor.appendChild(cartel);

  contenedor.appendChild(bloqueVolumen(app));

  let hubo = false;
  app.rutina.dias
    .filter((d) => d.ejercicios)
    .forEach((dia) => {
      const sesiones = sesionesDe(app.datos, dia.id);

      // Los sustitutos que se hayan usado en este día llevan su propio
      // historial y merecen su propia tarjeta, igual que los de la rutina.
      const claves = [];
      dia.ejercicios.forEach((e) => claves.push({ clave: e.id, nombre: e.nombre }));
      sesiones.forEach((s) => {
        Object.values(s.sust || {}).forEach((id) => {
          if (claves.some((c) => c.clave === id)) return;
          const sust = (app.catalogo.ejercicios || []).find((x) => x.id === id);
          if (sust) claves.push({ clave: id, nombre: sust.nombre, sustituto: true });
        });
      });

      claves.forEach(({ clave, nombre, sustituto }) => {
        const h = sesiones.filter((s) => s.ej[clave] && mejorSerie(s.ej[clave]));
        if (!h.length) return;
        hubo = true;
        const serie = h.map((s) => mejorSerie(s.ej[clave]).e1rm);
        const ult = mejorSerie(h[h.length - 1].ej[clave]);
        const max = Math.max(...serie);
        const min = Math.min(...serie);
        const delta = serie.length > 1 ? ((serie[serie.length - 1] - serie[0]) / serie[0]) * 100 : 0;

        const c = document.createElement("div");
        c.className = "tarjeta-prog";
        c.innerHTML = `
          <div class="fila"><h4>${nombre}</h4>
            <span class="cifra">${delta > 0 ? "+" : ""}${delta.toFixed(0)}%</span></div>
          <div class="detalle">${sustituto ? "sustituto · " : ""}${h.length} sesiones · mejor serie ${ult ? conUnidad(ult.peso, u) + " × " + ult.reps : "—"} · e1RM ${conUnidad(max, u, 0)}</div>
          ${chispa(serie, min, max)}`;
        contenedor.appendChild(c);
      });
    });

  if (!hubo) {
    const p = document.createElement("p");
    p.className = "vacio";
    p.textContent =
      "Todavía no hay series registradas. Marca tus series en cualquier día de fuerza y aquí aparecerá la curva de cada ejercicio.";
    contenedor.appendChild(p);
  }

  contenedor.appendChild(herramientas(app));
}

/* ---------- volumen semanal por grupo muscular ---------- */

function bloqueVolumen(app) {
  const seccion = document.createElement("section");
  seccion.className = "vol";

  const conDatos = semanasConDatos(app.datos);
  const actual = semanaISO(app.hoy());
  // La semana en curso siempre se puede ver, aunque todavía no tenga series.
  const semanas = conDatos.includes(actual) ? conDatos : [...conDatos, actual];
  let i = semanas.length - 1;

  function pintar() {
    const clave = semanas[i];
    const filas = resumen(app.datos, app.rutina, clave, app.catalogo);
    const bajos = filas.filter((f) => f.estado === "bajo" && f.series > 0).length;
    const enCero = filas.filter((f) => f.series === 0).length;

    seccion.innerHTML = `
      <div class="vol-tope">
        <h3>Volumen semanal</h3>
        <div class="vol-nav">
          <button data-ir="-1" aria-label="Semana anterior" ${i === 0 ? "disabled" : ""}>←</button>
          <button data-ir="1" aria-label="Semana siguiente" ${i === semanas.length - 1 ? "disabled" : ""}>→</button>
        </div>
      </div>
      <div class="vol-fecha">${etiquetaSemana(clave, actual)} · series efectivas</div>
      ${filas.map(fila).join("")}
      <p class="vol-nota">${nota(filas, bajos, enCero)}</p>`;

    seccion.querySelectorAll("[data-ir]").forEach((b) => {
      b.onclick = () => {
        i = Math.min(semanas.length - 1, Math.max(0, i + Number(b.dataset.ir)));
        pintar();
      };
    });
  }

  pintar();
  return seccion;
}

function fila(f) {
  // La escala llega un poco más allá del tope para que "pasarse" se vea.
  const escala = f.rango.max * 1.35;
  const pct = (v) => Math.min(100, (v / escala) * 100);
  return `
    <div class="vol-fila ${f.estado}">
      <div class="vol-cab">
        <b>${f.nombre}</b>
        <span><em>${f.series}</em> / ${f.rango.min}–${f.rango.max}</span>
      </div>
      <div class="vol-pista">
        <div class="vol-banda" style="left:${pct(f.rango.min)}%;width:${pct(f.rango.max) - pct(f.rango.min)}%"></div>
        <div class="vol-barra" style="width:${pct(f.series)}%"></div>
      </div>
    </div>`;
}

function etiquetaSemana(clave, actual) {
  if (clave === actual) return "Esta semana";
  const lunes = new Date(lunesDe(clave) + "T12:00:00Z");
  return "Semana del " + lunes.toLocaleDateString("es-MX", {
    day: "numeric", month: "short", timeZone: "UTC"
  });
}

function nota(filas, bajos, enCero) {
  if (enCero === filas.length) {
    return "Marca tus series y aquí verás cuánto volumen directo recibe cada grupo. Una serie cuenta 1 para el músculo principal del ejercicio y 0.5 para los que ayudan.";
  }
  const altos = filas.filter((f) => f.estado === "alto");
  const partes = [];
  if (bajos || enCero) {
    const nombres = filas
      .filter((f) => f.estado === "bajo")
      .slice(0, 3)
      .map((f) => f.nombre.toLowerCase());
    partes.push(`Van cortos: ${nombres.join(", ")}.`);
  }
  if (altos.length) {
    partes.push(`Pasados de volumen: ${altos.map((f) => f.nombre.toLowerCase()).join(", ")}.`);
  }
  if (!partes.length) partes.push("Todos los grupos dentro de rango.");
  partes.push(
    "El rango es referencia, no regla: en déficit la mitad baja es terreno razonable, y lo que de verdad importa es que ningún grupo se quede en cero varias semanas seguidas."
  );
  return partes.join(" ");
}

function herramientas(app) {
  const h = document.createElement("div");
  h.className = "herramientas";

  h.appendChild(boton("Respaldar (JSON)", () => {
    const txt = exportarJSON(app.datos);
    descargar(txt, `fit-control-${app.hoy()}.json`, "application/json");
  }));

  h.appendChild(boton("Restaurar respaldo", () => {
    const input = document.getElementById("archivoRespaldo");
    input.value = "";
    input.onchange = async () => {
      const f = input.files[0];
      if (!f) return;
      try {
        const { datos, agregadas, actualizadas } = importarJSON(await f.text(), app.datos);
        app.reemplazar(datos);
        alert(`Respaldo restaurado: ${agregadas} sesiones nuevas, ${actualizadas} actualizadas.`);
        app.pintar();
      } catch (err) {
        alert("No pude leer ese archivo. ¿Es un respaldo JSON de esta app?");
      }
    };
    input.click();
  }));

  h.appendChild(boton("Copiar datos (CSV)", () => {
    const csv = exportarCSV(app.datos, app.rutina, kgALb);
    navigator.clipboard
      ?.writeText(csv)
      .then(() => alert("CSV copiado. Pégalo en Excel o Google Sheets."))
      .catch(() => prompt("Copia este texto:", csv));
  }));

  const borrar = boton("Borrar todo el historial", () => {
    if (!confirm("Se borra todo el registro de sesiones. ¿Seguro?")) return;
    app.reemplazar({ sesiones: {}, semana: app.datos.semana, unidad: app.datos.unidad });
    app.pintar();
  });
  borrar.classList.add("peligro");
  h.appendChild(borrar);

  return h;
}

function boton(texto, alTocar) {
  const b = document.createElement("button");
  b.textContent = texto;
  b.onclick = alTocar;
  return b;
}

function descargar(contenido, nombre, tipo) {
  const blob = new Blob([contenido], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function chispa(serie, min, max) {
  if (serie.length < 2) return "";
  const w = 100;
  const h = 34;
  const rango = max - min || 1;
  const pts = serie
    .map((y, i) => `${(i / (serie.length - 1)) * w},${h - 4 - ((y - min) / rango) * (h - 8)}`)
    .join(" ");
  return `<svg class="chispa" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
    <polyline points="${pts}" fill="none" stroke="#E5A83C" stroke-width="1.6" vector-effect="non-scaling-stroke"/>
  </svg>`;
}
