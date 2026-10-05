/**
 * Servicio de Cálculo de Despiece Paramétrico (BOM Lite - Bill of Materials)
 * para aberturas de aluminio (SACWare ERP).
 */

/**
 * SKUs predeterminados asociados a cada componente del despiece básico.
 */
const SKUS_DEFECTO = {
  PERFIL: 'PERF-AL-MARCO',
  PERFIL_PESADO: 'PERF-AL-6005',
  VIDRIO: 'DVH-4-9-4',
  ESCUADRA: 'ACC-ESCUADRA',
  RODAMIENTO: 'ACC-RODAMIENTO'
};

/**
 * Calcula el despiece unitario y total para un renglón/ítem de pedido.
 * Aplica fórmulas paramétricas para Ventana Corrediza 2 Hojas.
 * 
 * @param {Object} item Objeto con dimensiones (ancho_mm, alto_mm), cantidad y tipología.
 * @returns {Object} Desglose detallado de materiales para el ítem.
 */
function calcularBOMItem(item) {
  const anchoMm = Math.max(0, Number(item.ancho_mm) || 0);
  const altoMm = Math.max(0, Number(item.alto_mm) || 0);
  const cantidad = Math.max(1, Number(item.cantidad) || 1);

  // 1. Perfil marco/hoja: ((ancho_mm * 2) + (alto_mm * 2)) / 1000 en metros lineales
  const perfilUnitario = ((anchoMm * 2) + (altoMm * 2)) / 1000;
  const perfilTotal = perfilUnitario * cantidad;

  // 2. Vidrio DVH: ((ancho_mm / 2) * alto_mm) / 1000000 * 2 en m2
  const vidrioUnitario = ((anchoMm / 2) * altoMm / 1000000) * 2;
  const vidrioTotal = vidrioUnitario * cantidad;

  // 3. Accesorios: 4 escuadras por ventana y 2 rodamientos por hoja (4 rodamientos por ventana de 2 hojas)
  const escuadrasUnitarias = 4;
  const escuadrasTotal = escuadrasUnitarias * cantidad;

  const rodamientosUnitarios = 4; // 2 hojas * 2 rodamientos
  const rodamientosTotal = rodamientosUnitarios * cantidad;

  return {
    tipologia: item.tipologia || 'Ventana Corrediza 2 Hojas',
    ancho_mm: anchoMm,
    alto_mm: altoMm,
    cantidad,
    materiales: [
      {
        clave: 'perfil',
        concepto: 'Perfil marco / hoja',
        sku_sugerido: SKUS_DEFECTO.PERFIL,
        categoria: 'perfil',
        unidad_medida: 'metro',
        cantidad_unitaria: Number(perfilUnitario.toFixed(3)),
        cantidad_total: Number(perfilTotal.toFixed(2)),
        formula: `((${anchoMm} * 2) + (${altoMm} * 2)) / 1000 = ${perfilUnitario.toFixed(2)} m`
      },
      {
        clave: 'vidrio',
        concepto: 'Vidrio DVH',
        sku_sugerido: SKUS_DEFECTO.VIDRIO,
        categoria: 'vidrio_dvh',
        unidad_medida: 'm2',
        cantidad_unitaria: Number(vidrioUnitario.toFixed(3)),
        cantidad_total: Number(vidrioTotal.toFixed(2)),
        formula: `((${anchoMm} / 2) * ${altoMm}) / 1000000 * 2 = ${vidrioUnitario.toFixed(2)} m²`
      },
      {
        clave: 'escuadra',
        concepto: 'Escuadras de armado',
        sku_sugerido: SKUS_DEFECTO.ESCUADRA,
        categoria: 'accesorio',
        unidad_medida: 'unidad',
        cantidad_unitaria: escuadrasUnitarias,
        cantidad_total: escuadrasTotal,
        formula: '4 escuadras por abertura'
      },
      {
        clave: 'rodamiento',
        concepto: 'Rodamientos para hojas corredizas',
        sku_sugerido: SKUS_DEFECTO.RODAMIENTO,
        categoria: 'accesorio',
        unidad_medida: 'unidad',
        cantidad_unitaria: rodamientosUnitarios,
        cantidad_total: rodamientosTotal,
        formula: '2 rodamientos x 2 hojas = 4 unidades por abertura'
      }
    ]
  };
}

/**
 * Consolida el cálculo de despiece de todos los ítems de un pedido u orden,
 * mapeando cantidades con los insumos reales de la base de datos.
 * 
 * @param {Array} items Lista de ítems del pedido (de detalle_pedidos).
 * @param {Array} insumosCatalogo Lista de insumos registrados en la base de datos.
 * @returns {Object} Resumen consolidado con desglose por ítem y lista consolidada de insumos a descontar.
 */
function calcularDespieceOrden(items, insumosCatalogo = []) {
  if (!Array.isArray(items) || items.length === 0) {
    return { items_detalle: [], materiales_consolidados: [], stock_valido: true };
  }

  // Mapa de insumos por SKU e ID para búsqueda rápida
  const insumoPorSku = new Map();
  const insumoPorId = new Map();
  for (const insumo of insumosCatalogo) {
    if (insumo.sku) insumoPorSku.set(insumo.sku.toUpperCase(), insumo);
    if (insumo.id) insumoPorId.set(Number(insumo.id), insumo);
  }

  const itemsDetalle = [];
  const acumuladorPorSku = new Map();

  for (const item of items) {
    const despieceItem = calcularBOMItem(item);
    itemsDetalle.push({
      item_id: item.id || null,
      ...despieceItem
    });

    for (const mat of despieceItem.materiales) {
      let insumoReal = insumoPorSku.get(mat.sku_sugerido.toUpperCase());

      // Si el item del pedido tenía un insumo_id asignado y coincide con la categoría, preferirlo
      if (item.insumo_id && mat.categoria === 'perfil') {
        const insumoItem = insumoPorId.get(Number(item.insumo_id));
        if (insumoItem && insumoItem.categoria === 'perfil') {
          insumoReal = insumoItem;
        }
      }

      const sku = insumoReal ? insumoReal.sku : mat.sku_sugerido;
      const actual = acumuladorPorSku.get(sku) || {
        insumo_id: insumoReal ? insumoReal.id : null,
        sku,
        descripcion: insumoReal ? insumoReal.descripcion : mat.concepto,
        categoria: mat.categoria,
        unidad_medida: mat.unidad_medida,
        cantidad_requerida: 0,
        stock_actual: insumoReal ? Number(insumoReal.stock_actual) : 0,
        stock_minimo: insumoReal ? Number(insumoReal.stock_minimo) : 0
      };

      actual.cantidad_requerida = Number((actual.cantidad_requerida + mat.cantidad_total).toFixed(2));
      acumuladorPorSku.set(sku, actual);
    }
  }

  // Evaluación de suficiencia de stock y criticidad para cada insumo consolidado
  let stockValido = true;
  const materialesConsolidados = Array.from(acumuladorPorSku.values()).map((mat) => {
    const stockActual = Number(mat.stock_actual);
    const stockMinimo = Number(mat.stock_minimo);
    const requerida = Number(mat.cantidad_requerida);
    const disponible = stockActual >= requerida;
    const stockRestante = Number((stockActual - requerida).toFixed(2));
    const quedariaCritico = stockRestante <= stockMinimo;

    if (!disponible) {
      stockValido = false;
    }

    return {
      ...mat,
      stock_suficiente: disponible,
      stock_restante: stockRestante,
      quedaria_critico: quedariaCritico,
      deficit: disponible ? 0 : Number((requerida - stockActual).toFixed(2))
    };
  });

  return {
    items_detalle: itemsDetalle,
    materiales_consolidados: materialesConsolidados,
    stock_valido: stockValido
  };
}

module.exports = {
  SKUS_DEFECTO,
  calcularBOMItem,
  calcularDespieceOrden
};
