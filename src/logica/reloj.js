/**
 * Temporizador de descanso e intervalos.
 *
 * El bug que esto resuelve: la v1 restaba 1 a un contador cada segundo con
 * setInterval. iOS estrangula los timers cuando bloqueas la pantalla o cambias
 * de app, así que un descanso de 120 s podía durar 3 minutos reales.
 *
 * Aquí el estado es una HORA DE TÉRMINO absoluta. El tick solo pinta; si el
 * sistema se lo salta cien veces, al volver la cuenta sigue siendo correcta.
 */

/** Segundos que faltan para `finEn`. Pura, por eso es la que se testea. */
export function restanteEn(finEn, ahora) {
  return Math.max(0, Math.ceil((finEn - ahora) / 1000));
}

/** Porcentaje transcurrido, 0 a 100. */
export function progreso(finEn, totalSeg, ahora) {
  if (!totalSeg) return 0;
  const restante = restanteEn(finEn, ahora);
  return Math.min(100, Math.max(0, 100 - (restante / totalSeg) * 100));
}

/**
 * @param {object} opciones
 * @param {(estado:{restante:number, total:number, progreso:number, etiqueta:string}) => void} opciones.alPintar
 * @param {(restante:number) => void} [opciones.alAvisar]  a los 10 s
 * @param {() => void} [opciones.alTerminar]
 * @param {() => number} [opciones.ahora]  inyectable para los tests
 */
export function crearReloj({ alPintar, alAvisar, alTerminar, ahora = () => Date.now() }) {
  let finEn = 0;
  let total = 0;
  let etiqueta = "Descanso";
  let intervalo = null;
  let avisado = false;
  let lock = null;
  let alTerminarActual = null;

  async function pantallaViva() {
    try {
      if ("wakeLock" in navigator && !lock) {
        lock = await navigator.wakeLock.request("screen");
        lock.addEventListener?.("release", () => { lock = null; });
      }
    } catch (e) {
      /* el navegador no lo soporta o lo negó */
    }
  }

  function soltarPantalla() {
    try {
      if (lock) { lock.release(); lock = null; }
    } catch (e) {
      /* ignorar */
    }
  }

  function pintar() {
    const restante = restanteEn(finEn, ahora());
    alPintar({ restante, total, progreso: progreso(finEn, total, ahora()), etiqueta });
    if (restante <= 10 && restante > 0 && !avisado) {
      avisado = true;
      alAvisar?.(restante);
    }
    if (restante <= 0) {
      const cb = alTerminarActual;
      parar();
      cb?.();
      alTerminar?.();
    }
  }

  function arrancar(segundos, nuevaEtiqueta, cuandoTermine) {
    parar();
    total = segundos;
    etiqueta = nuevaEtiqueta || "Descanso";
    finEn = ahora() + segundos * 1000;
    avisado = false;
    alTerminarActual = cuandoTermine || null;
    pantallaViva();
    pintar();
    // 250 ms: el reloj se ve fluido y el costo es irrelevante.
    intervalo = setInterval(pintar, 250);
  }

  function parar() {
    clearInterval(intervalo);
    intervalo = null;
    finEn = 0;
    total = 0;
    avisado = false;
    alTerminarActual = null;
    soltarPantalla();
  }

  /** +30 s sin perder la referencia absoluta. */
  function sumar(segundos) {
    if (!intervalo) return;
    finEn += segundos * 1000;
    total += segundos;
    avisado = false;
    pintar();
  }

  /** Al volver de segundo plano: recuperar wake lock y recalcular de inmediato. */
  function reanudar() {
    if (!intervalo) return;
    pantallaViva();
    pintar();
  }

  return {
    arrancar,
    parar,
    sumar,
    reanudar,
    get corriendo() { return intervalo !== null; },
    get restante() { return restanteEn(finEn, ahora()); }
  };
}
