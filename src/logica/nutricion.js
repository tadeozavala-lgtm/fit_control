/**
 * Calorías y macronutrientes.
 *
 * Tres decisiones que explican el archivo entero:
 *
 * 1. El gasto NO se calcula con un "factor de actividad" que ya incluya el
 *    entrenamiento. Se usa un factor de vida diaria (trabajo, caminar) y encima
 *    se suma lo que Tadeo entrenó DE VERDAD, leído de sus registros. Multiplicar
 *    por un factor "muy activo" y además sumar el ejercicio cuenta dos veces lo
 *    mismo, y es el error más común en estas calculadoras.
 *
 * 2. Toda fórmula de metabolismo falla ±10% entre personas. Por eso el número
 *    calculado es solo el punto de partida: lo que manda es la tendencia del
 *    peso real, y ajustePorTendencia() corrige contra ella.
 *
 * 3. Hay topes duros. El déficit no pasa del 20% ni baja de un piso absoluto,
 *    y la proteína nunca cae por debajo de lo que protege el músculo. Un número
 *    más agresivo no acelera nada que valga la pena a los 44 años.
 *
 * Esto no sustituye a un nutriólogo ni a un chequeo médico.
 */

export const KCAL_POR_KG_GRASA = 7700;

/* ---------- metabolismo ---------- */

/**
 * Tasa metabólica basal por Mifflin-St Jeor, que es la que menos se desvía en
 * población con sobrepeso. Harris-Benedict sobreestima ahí.
 *
 * @param {"hombre"|"mujer"} sexo
 * @param {number} peso kg
 * @param {number} altura cm
 * @param {number} edad años
 */
export function tmb(sexo, peso, altura, edad) {
  const p = Number(peso);
  const a = Number(altura);
  const e = Number(edad);
  if (!(p > 0) || !(a > 0) || !(e > 0)) return 0;
  const base = 10 * p + 6.25 * a - 5 * e;
  return Math.round(base + (sexo === "mujer" ? -161 : 5));
}

/**
 * Factores de vida diaria SIN entrenamiento.
 *
 * Son más bajos que los de las tablas corrientes justamente porque aquí el
 * ejercicio se suma aparte, medido.
 */
export const ACTIVIDAD = {
  sentado: { nombre: "Trabajo sentado", factor: 1.25, para: "Escritorio, poco movimiento fuera del gym" },
  ligera: { nombre: "Algo de movimiento", factor: 1.375, para: "Caminas a ratos, recados, escaleras" },
  activa: { nombre: "De pie o caminando", factor: 1.5, para: "Trabajo que no es de silla" },
  muyActiva: { nombre: "Trabajo físico", factor: 1.65, para: "Carga, construcción, reparto" }
};

/** Gasto de vivir, sin contar entrenamiento. */
export function gastoBase(tmbValor, nivelActividad) {
  const f = ACTIVIDAD[nivelActividad]?.factor ?? ACTIVIDAD.sentado.factor;
  return Math.round(tmbValor * f);
}

/* ---------- gasto del entrenamiento, medido ---------- */

/**
 * Carrera: aproximadamente 1 kcal por kg de peso corporal y kilómetro.
 *
 * Es una regla gruesa pero estable: a 110 kg, un kilómetro cuesta unas 110
 * kcal brutas. Se descuenta el gasto en reposo de ese rato, porque de otro modo
 * se contaría dos veces lo que ya trae el gasto base.
 */
export function gastoCarrera(km, segundos, peso, tmbValor) {
  const k = Number(km);
  if (!(k > 0) || !(peso > 0)) return 0;
  const bruto = k * peso;
  const horas = Number(segundos) > 0 ? segundos / 3600 : 0;
  const reposo = tmbValor > 0 ? (tmbValor / 24) * horas : 0;
  return Math.max(0, Math.round(bruto - reposo));
}

/**
 * Fuerza: se estima por series efectivas, no por tonelaje.
 *
 * El tonelaje engaña: una sentadilla de 100 kg y un curl de 100 kg mueven lo
 * mismo en el papel y no cuestan igual. Una serie de trabajo con sus descansos
 * ronda las 6 a 8 kcal por cada 10 kg de peso corporal.
 */
export const KCAL_POR_SERIE_POR_10KG = 0.7;

export function gastoFuerza(series, peso) {
  const s = Number(series);
  if (!(s > 0) || !(peso > 0)) return 0;
  return Math.round(s * (peso / 10) * KCAL_POR_SERIE_POR_10KG);
}

/* ---------- objetivos ---------- */

/**
 * Los objetivos y cuánto desvían del mantenimiento.
 *
 * `proteina` va en gramos por kilo de peso corporal. Los valores altos en
 * déficit no son capricho: es lo que frena la pérdida de músculo cuando faltan
 * calorías, y a los 44 cuesta más recuperarlo que conservarlo.
 */
export const OBJETIVOS_NUTRI = {
  perder: {
    nombre: "Perder grasa",
    ajuste: -0.18,
    proteina: 2.2,
    grasaMin: 0.8,
    nota: "Déficit moderado. Más agresivo no quema más grasa, quema músculo."
  },
  recomposicion: {
    nombre: "Recomposición",
    ajuste: -0.08,
    proteina: 2.2,
    grasaMin: 0.8,
    nota: "Déficit ligero: pierdes grasa sin comprometer la fuerza. Es lo que estás haciendo."
  },
  mantener: {
    nombre: "Mantenimiento",
    ajuste: 0,
    proteina: 1.8,
    grasaMin: 0.9,
    nota: "Para sostener peso y rendimiento mientras subes cargas."
  },
  ganar: {
    nombre: "Ganar músculo",
    ajuste: 0.1,
    proteina: 2.0,
    grasaMin: 0.9,
    nota: "Superávit contenido. Subir más rápido solo añade grasa."
  }
};

/** Tope de déficit en porcentaje del gasto. */
export const DEFICIT_MAXIMO = 0.2;

/**
 * Piso absoluto de calorías.
 *
 * Nunca por debajo del metabolismo basal: comer menos de lo que cuesta estar
 * vivo no es una estrategia, y menos con cinco días de entrenamiento encima.
 */
export function pisoCalorico(tmbValor) {
  return Math.round(Math.max(1500, tmbValor));
}

/**
 * Calorías objetivo del día.
 *
 * @returns {{objetivo:number, gasto:number, ajuste:number, limitado:string|null}}
 */
export function caloriasObjetivo(gastoTotal, objetivo, tmbValor) {
  const o = OBJETIVOS_NUTRI[objetivo] || OBJETIVOS_NUTRI.mantener;
  const factor = Math.max(-DEFICIT_MAXIMO, o.ajuste);
  const bruto = Math.round(gastoTotal * (1 + factor));
  const piso = pisoCalorico(tmbValor);

  if (bruto < piso) {
    return {
      objetivo: piso,
      gasto: gastoTotal,
      ajuste: piso - gastoTotal,
      limitado: "piso"
    };
  }
  return { objetivo: bruto, gasto: gastoTotal, ajuste: bruto - gastoTotal, limitado: null };
}

/* ---------- macros ---------- */

export const KCAL = { proteina: 4, grasa: 9, carbo: 4 };

/**
 * Reparto de macronutrientes.
 *
 * El orden importa: primero la proteína, que es el macro que protege el
 * músculo; luego un mínimo de grasa, porque por debajo de ~0.8 g/kg se resiente
 * la producción hormonal; los carbohidratos se llevan lo que queda, que es lo
 * que alimenta el entrenamiento.
 *
 * Si las calorías no alcanzan ni para proteína y grasa mínima, se recorta
 * proporcionalmente en vez de devolver un carbohidrato negativo.
 */
export function macros(calorias, peso, objetivo) {
  const o = OBJETIVOS_NUTRI[objetivo] || OBJETIVOS_NUTRI.mantener;
  const p = Number(peso);
  if (!(calorias > 0) || !(p > 0)) return null;

  let gProteina = Math.round(o.proteina * p);
  let gGrasa = Math.round(o.grasaMin * p);
  let kcalFijas = gProteina * KCAL.proteina + gGrasa * KCAL.grasa;

  let recortado = false;
  if (kcalFijas > calorias) {
    // Caso raro pero posible en un peso alto con calorías muy bajas.
    const escala = calorias / kcalFijas;
    gProteina = Math.round(gProteina * escala);
    gGrasa = Math.round(gGrasa * escala);
    kcalFijas = gProteina * KCAL.proteina + gGrasa * KCAL.grasa;
    recortado = true;
  }

  const gCarbo = Math.max(0, Math.round((calorias - kcalFijas) / KCAL.carbo));

  return {
    calorias: Math.round(calorias),
    proteina: gProteina,
    grasa: gGrasa,
    carbo: gCarbo,
    porKgProteina: Math.round((gProteina / p) * 10) / 10,
    recortado,
    reparto: {
      proteina: Math.round(((gProteina * KCAL.proteina) / calorias) * 100),
      grasa: Math.round(((gGrasa * KCAL.grasa) / calorias) * 100),
      carbo: Math.round(((gCarbo * KCAL.carbo) / calorias) * 100)
    }
  };
}

/* ---------- reparto en comidas ---------- */

/**
 * Plantillas de reparto. Los porcentajes de proteína son más parejos que los de
 * calorías a propósito: repartirla en tomas de 30 a 40 g a lo largo del día
 * estimula más síntesis que concentrarla en la cena.
 */
export const PLANTILLAS = {
  3: [
    { nombre: "Desayuno", kcal: 0.3, prot: 0.33 },
    { nombre: "Comida", kcal: 0.4, prot: 0.34 },
    { nombre: "Cena", kcal: 0.3, prot: 0.33 }
  ],
  4: [
    { nombre: "Desayuno", kcal: 0.25, prot: 0.25 },
    { nombre: "Comida", kcal: 0.35, prot: 0.3 },
    { nombre: "Merienda", kcal: 0.15, prot: 0.2 },
    { nombre: "Cena", kcal: 0.25, prot: 0.25 }
  ],
  5: [
    { nombre: "Desayuno", kcal: 0.22, prot: 0.22 },
    { nombre: "Media mañana", kcal: 0.13, prot: 0.15 },
    { nombre: "Comida", kcal: 0.3, prot: 0.25 },
    { nombre: "Post-entreno", kcal: 0.13, prot: 0.18 },
    { nombre: "Cena", kcal: 0.22, prot: 0.2 }
  ]
};

/**
 * Reparte los macros del día entre las comidas.
 * La última comida absorbe el redondeo para que los totales cuadren.
 */
export function repartirComidas(m, cuantas = 4) {
  const plantilla = PLANTILLAS[cuantas] || PLANTILLAS[4];
  if (!m) return [];

  const comidas = plantilla.map((c) => ({
    nombre: c.nombre,
    calorias: Math.round(m.calorias * c.kcal),
    proteina: Math.round(m.proteina * c.prot),
    grasa: Math.round(m.grasa * c.kcal),
    carbo: Math.round(m.carbo * c.kcal)
  }));

  ["calorias", "proteina", "grasa", "carbo"].forEach((k) => {
    const suma = comidas.reduce((a, c) => a + c[k], 0);
    comidas[comidas.length - 1][k] += m[k] - suma;
  });

  return comidas;
}

/* ---------- equivalencias de alimentos ---------- */

/**
 * Cuánto alimento hace falta para cubrir una cantidad de proteína.
 *
 * No es un menú: es la traducción de "40 g de proteína" a algo que se pueda
 * servir en un plato. Los valores son por 100 g de alimento crudo.
 */
export const FUENTES_PROTEINA = [
  { nombre: "Pechuga de pollo", porCien: 31 },
  { nombre: "Carne de res magra", porCien: 26 },
  { nombre: "Pescado blanco", porCien: 20 },
  { nombre: "Atún en agua", porCien: 25 },
  { nombre: "Huevo entero", porCien: 13, unidad: "≈ 2 piezas por 100 g" },
  { nombre: "Claras de huevo", porCien: 11 },
  { nombre: "Queso cottage", porCien: 11 },
  { nombre: "Yogur griego natural", porCien: 10 },
  { nombre: "Lentejas cocidas", porCien: 9 },
  { nombre: "Proteína en polvo", porCien: 80 }
];

/** Gramos de alimento para alcanzar los gramos de proteína pedidos. */
export function porcionPara(gramosProteina, fuente) {
  if (!(gramosProteina > 0) || !fuente?.porCien) return 0;
  return Math.round((gramosProteina / fuente.porCien) * 100);
}

/* ---------- ajuste por tendencia real ---------- */

/**
 * Media móvil del peso.
 *
 * El peso diario oscila kilo y medio por agua, sal y lo que quede en el
 * intestino. Sin suavizar, la tendencia es ruido y las decisiones que salen de
 * ella también.
 */
export function mediaMovil(pesos, ventana = 7) {
  const orden = [...(pesos || [])].sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
  return orden.map((p, i) => {
    const desde = Math.max(0, i - ventana + 1);
    const trozo = orden.slice(desde, i + 1);
    return {
      fecha: p.fecha,
      peso: p.kg,
      media: Math.round((trozo.reduce((a, x) => a + x.kg, 0) / trozo.length) * 100) / 100
    };
  });
}

/**
 * Cambio de peso por semana, calculado sobre la media y no sobre dos básculas
 * sueltas.
 *
 * @returns {{kgPorSemana:number, dias:number, desde:number, hasta:number}|null}
 */
export function tendencia(pesos, minimoDias = 10) {
  const serie = mediaMovil(pesos);
  if (serie.length < 2) return null;

  const primera = serie[0];
  const ultima = serie[serie.length - 1];
  const dias =
    (new Date(ultima.fecha + "T12:00:00Z") - new Date(primera.fecha + "T12:00:00Z")) / 86400000;
  if (dias < minimoDias) return null;

  return {
    kgPorSemana: Math.round(((ultima.media - primera.media) / dias) * 7 * 100) / 100,
    dias: Math.round(dias),
    desde: primera.media,
    hasta: ultima.media
  };
}

/** Cambio de peso semanal que un objetivo debería producir, en kg. */
export function cambioEsperado(calorias, gasto) {
  return Math.round((((calorias - gasto) * 7) / KCAL_POR_KG_GRASA) * 100) / 100;
}

export const AJUSTE_MAXIMO_KCAL = 250;

/**
 * Corrige las calorías comparando la tendencia real con la esperada.
 *
 * Esta es la parte que hace honesto todo lo anterior: las fórmulas estiman, la
 * báscula mide. Si llevas tres semanas sin moverte, el cálculo estaba mal, no
 * tu cuerpo.
 *
 * El ajuste se limita para no dar bandazos, y solo se propone con suficientes
 * días de datos.
 *
 * @returns {{aplicar:boolean, delta:number, motivo:string, real:number, esperado:number}|null}
 */
export function ajustePorTendencia(pesos, calorias, gasto, objetivo) {
  const t = tendencia(pesos);
  if (!t) return null;

  const esperado = cambioEsperado(calorias, gasto);
  const real = t.kgPorSemana;
  const diferencia = real - esperado;

  // Medio kilo por semana de desviación es ruido; más, es que el cálculo falla.
  if (Math.abs(diferencia) < 0.25) {
    return {
      aplicar: false,
      delta: 0,
      real,
      esperado,
      motivo: `Vas a ${formatoKg(real)}/semana, muy cerca de lo previsto (${formatoKg(esperado)}). No toques nada.`
    };
  }

  // Si pierdes de más, hay que SUBIR calorías; si de menos, bajarlas.
  const kcalDiarias = (diferencia * KCAL_POR_KG_GRASA) / 7;
  const delta = Math.round(Math.max(-AJUSTE_MAXIMO_KCAL, Math.min(AJUSTE_MAXIMO_KCAL, -kcalDiarias)) / 10) * 10;

  const o = OBJETIVOS_NUTRI[objetivo] || OBJETIVOS_NUTRI.mantener;
  const perdiendoDemasiado = o.ajuste < 0 && real < esperado;

  return {
    aplicar: true,
    delta,
    real,
    esperado,
    motivo: perdiendoDemasiado
      ? `Estás bajando ${formatoKg(real)}/semana cuando el plan esperaba ${formatoKg(esperado)}. A ese ritmo se va músculo: sube ${Math.abs(delta)} kcal.`
      : `Vas a ${formatoKg(real)}/semana y el plan esperaba ${formatoKg(esperado)}. Ajusta ${delta > 0 ? "+" : ""}${delta} kcal al día y vuelve a medir en dos semanas.`
  };
}

function formatoKg(kg) {
  const n = Math.abs(kg);
  if (kg === 0) return "0 kg";
  return `${kg > 0 ? "+" : "−"}${n.toFixed(2)} kg`;
}

/**
 * Ritmo de pérdida que empieza a costar músculo: más del 1% del peso corporal
 * por semana.
 */
export function perdidaDemasiadoRapida(kgPorSemana, peso) {
  return kgPorSemana < 0 && Math.abs(kgPorSemana) > peso * 0.01;
}
