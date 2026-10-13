import { conUnidad, mostrar, kgALb } from "../logica/unidades.js";
import { mejorSerie, tonelaje } from "../logica/fuerza.js";
import { sesionesDe, exportarCSV, exportarJSON, importarJSON } from "../logica/almacen.js";

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

  let hubo = false;
  app.rutina.dias
    .filter((d) => d.ejercicios)
    .forEach((dia) => {
      dia.ejercicios.forEach((e) => {
        const h = sesionesDe(app.datos, dia.id).filter(
          (s) => s.ej[e.id] && mejorSerie(s.ej[e.id])
        );
        if (!h.length) return;
        hubo = true;
        const serie = h.map((s) => mejorSerie(s.ej[e.id]).e1rm);
        const ult = mejorSerie(h[h.length - 1].ej[e.id]);
        const max = Math.max(...serie);
        const min = Math.min(...serie);
        const delta = serie.length > 1 ? ((serie[serie.length - 1] - serie[0]) / serie[0]) * 100 : 0;

        const c = document.createElement("div");
        c.className = "tarjeta-prog";
        c.innerHTML = `
          <div class="fila"><h4>${e.nombre}</h4>
            <span class="cifra">${delta > 0 ? "+" : ""}${delta.toFixed(0)}%</span></div>
          <div class="detalle">${h.length} sesiones · mejor serie ${ult ? conUnidad(ult.peso, u) + " × " + ult.reps : "—"} · e1RM ${conUnidad(max, u, 0)}</div>
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
