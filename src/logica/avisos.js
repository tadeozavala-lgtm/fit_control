/**
 * Avisos sonoros y visuales.
 *
 * El bug que esto resuelve: en iOS, Web Audio respeta el switch de silencio y
 * Safari no soporta navigator.vibrate. Si traes el teléfono en silencio —que es
 * lo normal en un gimnasio— la campana de la v1 simplemente no existía.
 *
 * Por eso el canal primario es VISUAL (flash a pantalla completa) y el sonido
 * es el extra. La voz, cuando está activada, usa SpeechSynthesis, que sí es
 * útil en el HIIT porque no tienes que mirar la pantalla entre rounds.
 */

let ctx = null;

function contexto() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

/** Campana. `tipo`: "aviso" (un golpe) o "fin" (tres golpes). */
export function campana(tipo = "fin") {
  const c = contexto();
  if (!c) return;
  const golpes = tipo === "fin" ? [0, 0.18, 0.36] : [0];
  golpes.forEach((d) => {
    try {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = "triangle";
      o.frequency.value = tipo === "fin" ? 880 : 520;
      g.gain.setValueAtTime(0.0001, c.currentTime + d);
      g.gain.exponentialRampToValueAtTime(0.32, c.currentTime + d + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + d + 0.32);
      o.connect(g);
      g.connect(c.destination);
      o.start(c.currentTime + d);
      o.stop(c.currentTime + d + 0.35);
    } catch (e) {
      /* ignorar */
    }
  });
}

/** Flash a pantalla completa: el único aviso que funciona con el teléfono en silencio. */
export function destelloPantalla(color = "#D93A2B", ms = 420) {
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  const capa = document.createElement("div");
  capa.className = "destello";
  capa.style.background = color;
  document.body.appendChild(capa);
  requestAnimationFrame(() => capa.classList.add("ver"));
  setTimeout(() => {
    capa.classList.remove("ver");
    setTimeout(() => capa.remove(), 300);
  }, ms);
}

/** Vibración donde exista (Android). En iOS no hace nada y no truena. */
export function vibrar(patron = [120, 60, 120]) {
  try {
    navigator.vibrate?.(patron);
  } catch (e) {
    /* ignorar */
  }
}

/** Voz para el HIIT: cantar el bloque que viene sin tener que ver la pantalla. */
export function decir(texto, activa) {
  if (!activa || !("speechSynthesis" in window)) return;
  try {
    const u = new SpeechSynthesisUtterance(texto);
    u.lang = "es-MX";
    u.rate = 1.1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch (e) {
    /* ignorar */
  }
}

/** Aviso completo: visual + sonoro + háptico. */
export function avisar(tipo, opciones = {}) {
  destelloPantalla(tipo === "fin" ? "#D93A2B" : "#E5A83C", tipo === "fin" ? 520 : 300);
  campana(tipo);
  if (tipo === "fin") vibrar();
  if (opciones.voz) decir(opciones.voz, opciones.vozActiva);
}
