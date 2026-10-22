import "./estilos.css";
import rutina from "./datos/rutina.json";
import catalogo from "./datos/catalogo.json";
import { crearAlmacen, claveSesion, partirClave } from "./logica/almacen.js";
import { rutinaAjustada } from "./logica/ajustes-rutina.js";
import { crearReloj } from "./logica/reloj.js";
import { avisar, decir } from "./logica/avisos.js";
import { pintarDia } from "./ui/fuerza.js";
import { pintarIntervalo, marcarPaso } from "./ui/cardio.js";
import { pintarCarrera } from "./ui/carrera.js";
import { pintarProgreso } from "./ui/progreso.js";
import { pintarPlan } from "./ui/plan.js";
import { conectarModal } from "./ui/modal.js";
import { registerSW } from "virtual:pwa-register";

const almacen = crearAlmacen(window);

/** El contexto que reciben todas las vistas. */
const app = {
  // `rutina` es rutina.json con la capa de ajustes de Tadeo encima. Se recalcula
  // al pintar, no se guarda: así un despliegue nuevo del repo se hereda solo.
  get rutina() {
    return rutinaAjustada(rutina, app.datos?.ajustesRutina);
  },
  rutinaBase: rutina,

  /** El ejercicio tal como viene del repo, sin la capa encima. */
  ejercicioBase(id) {
    return rutina.dias
      .filter((d) => d.ejercicios)
      .flatMap((d) => d.ejercicios)
      .find((e) => e.id === id);
  },

  catalogo,
  datos: null,
  diaActivo: "push",
  reloj: null,
  hoy: () => new Date().toISOString().slice(0, 10),
  unidad: () => (app.datos.unidad === "lb" ? "lb" : "kg"),

  /**
   * Sesión de hoy para un día de rutina.
   * La clave lleva un consecutivo, así que entrenar Push dos veces el mismo día
   * ya no sobrescribe la primera sesión (bug de la v1).
   */
  sesionActiva(diaId) {
    const fecha = app.hoy();
    const delDia = Object.keys(app.datos.sesiones)
      .map(partirClave)
      .filter((k) => k.dia === diaId && k.fecha === fecha);
    const n = delDia.length ? Math.max(...delDia.map((k) => k.n)) : 1;
    const clave = claveSesion(diaId, fecha, n);
    if (!app.datos.sesiones[clave]) {
      app.datos.sesiones[clave] = {
        fecha,
        semana: app.datos.semana,
        ej: {},
        sust: {},
        notas: { sueno: null, energia: null, molestia: null, texto: "" }
      };
    }
    if (!app.datos.sesiones[clave].sust) app.datos.sesiones[clave].sust = {};
    return app.datos.sesiones[clave];
  },

  /** Empieza una sesión aparte del mismo día de rutina. */
  nuevaSesion(diaId) {
    const fecha = app.hoy();
    const delDia = Object.keys(app.datos.sesiones)
      .map(partirClave)
      .filter((k) => k.dia === diaId && k.fecha === fecha);
    const n = (delDia.length ? Math.max(...delDia.map((k) => k.n)) : 0) + 1;
    app.datos.sesiones[claveSesion(diaId, fecha, n)] = {
      fecha,
      semana: app.datos.semana,
      ej: {},
      sust: {},
      notas: { sueno: null, energia: null, molestia: null, texto: "" }
    };
    app.guardar();
    app.pintar();
  },

  guardar: debounce(async () => {
    const ok = await almacen.escribir();
    if (ok) destello();
  }, 400),

  reemplazar(datos) {
    app.datos = almacen.reemplazar(datos);
    almacen.escribir();
  },

  pintar,
  correrSecuencia,
  detenerSecuencia
};

/* ---------- reloj ---------- */

app.reloj = crearReloj({
  alPintar({ restante, progreso, etiqueta }) {
    const m = Math.floor(restante / 60);
    const s = restante % 60;
    texto("cuentaTexto", `${m}:${String(s).padStart(2, "0")}`);
    texto("cuentaRotulo", etiqueta);
    document.getElementById("relleno").style.width = progreso + "%";
    const r = document.getElementById("reloj");
    r.classList.add("activo");
    r.classList.toggle("aviso", restante <= 10);
  },
  alAvisar() {
    avisar("aviso");
  },
  alTerminar() {
    avisar("fin");
    const r = document.getElementById("reloj");
    r.classList.remove("activo", "aviso");
    document.getElementById("relleno").style.width = "0%";
    texto("cuentaRotulo", "Descanso");
    texto("cuentaTexto", "--:--");
  }
});

// Al volver de segundo plano: recalcular de inmediato y recuperar el wake lock.
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) app.reloj.reanudar();
});
window.addEventListener("focus", () => app.reloj.reanudar());

/* ---------- secuencias HIIT ---------- */

let secuencia = null;
let pasoActual = 0;

function correrSecuencia(pasos) {
  secuencia = pasos;
  pasoActual = 0;
  siguientePaso();
}

function siguientePaso() {
  if (!secuencia || pasoActual >= secuencia.length) {
    detenerSecuencia();
    return;
  }
  const p = secuencia[pasoActual];
  marcarPaso(pasoActual);
  decir(p.n.replace(/·/g, ","), app.datos.voz);
  const etiqueta = p.n.length > 26 ? p.n.slice(0, 26) + "…" : p.n;
  app.reloj.arrancar(p.t, etiqueta, () => {
    pasoActual++;
    siguientePaso();
  });
}

function detenerSecuencia() {
  secuencia = null;
  pasoActual = 0;
  app.reloj.parar();
  marcarPaso(-1);
  document.getElementById("reloj").classList.remove("activo", "aviso");
  texto("cuentaTexto", "--:--");
  texto("cuentaRotulo", "Descanso");
  document.getElementById("relleno").style.width = "0%";
}

/* ---------- vistas ---------- */

function pintarPestanas() {
  const nav = document.getElementById("pestanas");
  nav.innerHTML = "";
  [
    ...app.rutina.dias,
    { id: "plan", nombre: "Plan", tipo: "plan" },
    { id: "prog", nombre: "Progreso", tipo: "progreso" }
  ].forEach((d) => {
    const b = document.createElement("button");
    b.className = "pestana";
    b.textContent = d.nombre;
    b.setAttribute("role", "tab");
    b.setAttribute("aria-selected", String(d.id === app.diaActivo));
    b.onclick = () => {
      app.diaActivo = d.id;
      detenerSecuencia();
      pintarPestanas();
      pintar();
      window.scrollTo({ top: 0 });
    };
    nav.appendChild(b);
  });
}

function pintar() {
  const v = document.getElementById("vista");
  v.innerHTML = "";
  if (app.diaActivo === "plan") return pintarPlan(app, v);
  if (app.diaActivo === "prog") return pintarProgreso(app, v);
  const dia = app.rutina.dias.find((d) => d.id === app.diaActivo);
  if (!dia) return;
  if (dia.tipo === "cardio") return pintarCarrera(app, dia, v);
  if (dia.tipo === "intervalo") return pintarIntervalo(app, dia, v);
  pintarDia(app, dia, v);
}

/* ---------- controles del encabezado ---------- */

function pintarBotonUnidad() {
  const b = document.getElementById("btnUnidad");
  b.textContent = app.unidad().toUpperCase();
  b.classList.toggle("lb", app.unidad() === "lb");
}

function conectarControles() {
  document.getElementById("semMenos").onclick = () => cambiarSemana(-1);
  document.getElementById("semMas").onclick = () => cambiarSemana(1);
  document.getElementById("btnUnidad").onclick = () => {
    app.datos.unidad = app.unidad() === "kg" ? "lb" : "kg";
    pintarBotonUnidad();
    app.guardar();
    pintar();
  };
  document.getElementById("btnMas30").onclick = () => app.reloj.sumar(30);
  document.getElementById("btnSaltar").onclick = () => {
    if (!app.reloj.corriendo) return;
    if (secuencia) {
      app.reloj.parar();
      pasoActual++;
      siguientePaso();
    } else {
      app.reloj.parar();
      document.getElementById("reloj").classList.remove("activo", "aviso");
      texto("cuentaTexto", "--:--");
      document.getElementById("relleno").style.width = "0%";
    }
  };
}

function cambiarSemana(delta) {
  app.datos.semana = Math.max(1, app.datos.semana + delta);
  texto("semNum", app.datos.semana);
  app.guardar();
  pintar();
}

/* ---------- utilidades ---------- */

function texto(id, valor) {
  const n = document.getElementById(id);
  if (n) n.textContent = valor;
}

function destello() {
  const a = document.getElementById("avisoGuardado");
  a.classList.add("ver");
  setTimeout(() => a.classList.remove("ver"), 900);
}

function debounce(fn, ms) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

/* ---------- service worker ---------- */

const actualizarSW = registerSW({
  onNeedRefresh() {
    const barra = document.getElementById("actualizar");
    barra.classList.add("ver");
    document.getElementById("btnActualizar").onclick = () => actualizarSW(true);
  }
});

/* ---------- arranque ---------- */

(async function arrancar() {
  app.datos = await almacen.leer();
  texto("semNum", app.datos.semana);
  pintarBotonUnidad();
  conectarModal();
  conectarControles();

  const porDia = { 1: "push", 2: "pull", 3: "z2", 4: "legs", 5: "hiitB", 6: "full", 0: "prog" };
  app.diaActivo = porDia[new Date().getDay()] || "push";

  pintarPestanas();
  pintar();
})();
