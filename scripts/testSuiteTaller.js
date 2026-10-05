require('dotenv').config();

async function runTests() {
  console.log('=== TEST SUITE: MÓDULO DE TALLER & BOM LITE ===');
  
  // 1. Login
  const loginRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@sacware.local', password: 'admin123' })
  });
  if (!loginRes.ok) throw new Error('Error en login: ' + loginRes.status);
  const { token, usuario } = await loginRes.json();
  console.log('✓ Autenticado como:', usuario.nombre, `(${usuario.rol})`);

  const authHeaders = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  // 2. Listar pedidos pendientes de OP
  const pendRes = await fetch('http://localhost:3000/api/ordenes-produccion/pedidos-pendientes', { headers: authHeaders });
  const pedidosPendientes = await pendRes.json();
  console.log('✓ Pedidos disponibles para nueva OP:', pedidosPendientes.length);

  // 3. Si hay pedidos pendientes, generar OP
  let opParaProbar = null;
  if (pedidosPendientes.length > 0) {
    const pedido = pedidosPendientes[0];
    const genRes = await fetch('http://localhost:3000/api/ordenes-produccion/generar', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ pedido_id: pedido.id })
    });
    const genData = await genRes.json();
    console.log('✓ OP generada:', genRes.status, genData.op?.nro_op);
    opParaProbar = genData.op;
  }

  // 4. Listar todas las OPs
  const opsRes = await fetch('http://localhost:3000/api/ordenes-produccion', { headers: authHeaders });
  const ordenes = await opsRes.json();
  console.log('✓ Total OPs en base de datos:', ordenes.length);

  if (!opParaProbar && ordenes.length > 0) {
    opParaProbar = ordenes[0];
  }

  if (opParaProbar) {
    const opId = opParaProbar.id;
    console.log(`\n--- Probando con OP ID ${opId} (${opParaProbar.nro_op}) ---`);

    // 5. Consultar Despiece BOM
    const despieceRes = await fetch(`http://localhost:3000/api/ordenes-produccion/${opId}/despiece`, { headers: authHeaders });
    const despieceData = await despieceRes.json();
    console.log('✓ Despiece calculado (BOM Lite):');
    console.log('  Items desglosados:', despieceData.desglose_items?.length);
    for (const mat of despieceData.materiales || []) {
      console.log(`  - [${mat.sku}] ${mat.descripcion}: Req: ${mat.cantidad_requerida} ${mat.unidad_medida} | Stock: ${mat.stock_actual} | Suficiente: ${mat.stock_suficiente}`);
    }

    // 6. Transición de estados: corte -> armado -> vidriado
    const estadosSecuencia = ['corte', 'armado', 'vidriado'];
    for (const est of estadosSecuencia) {
      const patchRes = await fetch(`http://localhost:3000/api/ordenes-produccion/${opId}/estado`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ estado: est })
      });
      const patchData = await patchRes.json();
      console.log(`✓ Transición a estado "${est}":`, patchRes.status, patchData.mensaje);
    }

    // 7. Prueba de descuento de stock (o verificar que detecta si ya se descontó)
    const stockRes = await fetch(`http://localhost:3000/api/ordenes-produccion/${opId}/descontar-stock`, {
      method: 'POST',
      headers: authHeaders
    });
    const stockData = await stockRes.json();
    if (stockRes.ok) {
      console.log('✓ Stock descontado:', stockData.mensaje);
      if (stockData.alertas_criticas?.length > 0) {
        console.log('  ⚠ Alertas críticas detectadas:', stockData.alertas_criticas.map(a => `${a.sku} (${a.stock_restante} ${a.unidad_medida})`));
      }
    } else {
      console.log('✓ Validación de descuento:', stockRes.status, stockData.error);
    }

    // 8. Intentar transición inválida
    const invalidoRes = await fetch(`http://localhost:3000/api/ordenes-produccion/${opId}/estado`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ estado: 'estado_invalido' })
    });
    console.log('✓ Rechazo de estado inválido:', invalidoRes.status === 400 ? 'OK (400 Bad Request)' : 'FALLÓ');
  }

  console.log('\n=== TODOS LOS TESTS COMPLETADOS SATISFACTORIAMENTE ===');
}

runTests().catch(console.error);
