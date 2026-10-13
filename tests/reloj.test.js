import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { restanteEn, progreso, crearReloj } from "../src/logica/reloj.js";

describe("cuenta basada en hora de término", () => {
  it("calcula los segundos que faltan", () => {
    const fin = 1_000_000;
    expect(restanteEn(fin, fin - 120_000)).toBe(120);
    expect(restanteEn(fin, fin - 500)).toBe(1);
    expect(restanteEn(fin, fin)).toBe(0);
  });

  it("nunca devuelve negativos", () => {
    expect(restanteEn(1000, 99999)).toBe(0);
  });

  it("el progreso va de 0 a 100 y se mantiene acotado", () => {
    const fin = 120_000;
    expect(progreso(fin, 120, 0)).toBe(0);
    expect(progreso(fin, 120, 60_000)).toBe(50);
    expect(progreso(fin, 120, 999_999)).toBe(100);
    expect(progreso(fin, 0, 0)).toBe(0);
  });
});

describe("el reloj sobrevive al segundo plano", () => {
  let ahora;

  beforeEach(() => {
    vi.useFakeTimers();
    ahora = 0;
    // Sin wakeLock en Node: pantallaViva() entra al catch, que es justo lo que
    // debe pasar en un navegador que no lo soporte.
  });

  afterEach(() => vi.useRealTimers());

  function reloj(espia = {}) {
    return crearReloj({
      alPintar: espia.alPintar || (() => {}),
      alAvisar: espia.alAvisar,
      alTerminar: espia.alTerminar,
      ahora: () => ahora
    });
  }

  it("este es el bug de la v1: si el sistema se salta los ticks, la cuenta sigue bien", () => {
    const pintados = [];
    const r = reloj({ alPintar: (e) => pintados.push(e.restante) });
    r.arrancar(120, "Descanso");
    expect(pintados.at(-1)).toBe(120);

    // iOS congela la app 118 segundos: ningún tick corre en ese rato.
    ahora += 118_000;
    r.reanudar();
    // Un contador que resta 1 por tick diría 120. La hora de término dice 2.
    expect(pintados.at(-1)).toBe(2);
  });

  it("termina y dispara el callback aunque los ticks lleguen tarde", () => {
    const alTerminar = vi.fn();
    const r = reloj({ alTerminar });
    r.arrancar(60, "Descanso", alTerminar);
    ahora += 90_000;
    vi.advanceTimersByTime(250);
    expect(alTerminar).toHaveBeenCalled();
    expect(r.corriendo).toBe(false);
  });

  it("avisa una sola vez a los 10 segundos", () => {
    const alAvisar = vi.fn();
    const r = reloj({ alAvisar });
    r.arrancar(30, "Descanso");
    ahora += 21_000;
    vi.advanceTimersByTime(250);
    vi.advanceTimersByTime(250);
    vi.advanceTimersByTime(250);
    expect(alAvisar).toHaveBeenCalledTimes(1);
  });

  it("+30s extiende sin perder la referencia absoluta", () => {
    const r = reloj();
    r.arrancar(60, "Descanso");
    ahora += 30_000;
    expect(r.restante).toBe(30);
    r.sumar(30);
    expect(r.restante).toBe(60);
  });

  it("parar deja el reloj quieto", () => {
    const r = reloj();
    r.arrancar(60, "Descanso");
    r.parar();
    expect(r.corriendo).toBe(false);
    expect(r.restante).toBe(0);
  });
});
