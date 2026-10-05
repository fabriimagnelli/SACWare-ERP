require('dotenv').config();
const http = require('http');

async function login() {
  const data = JSON.stringify({ email: 'admin@sacware.local', password: 'admin123' });
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve(JSON.parse(body)));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function request(method, path, token, payload = null) {
  const data = payload ? JSON.stringify(payload) : null;
  return new Promise((resolve, reject) => {
    const headers = {
      'Authorization': `Bearer ${token}`
    };
    if (data) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(data);
    }
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path,
      method,
      headers
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, text: body });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function run() {
  console.log('1. Iniciando sesión...');
  const { token } = await login();
  console.log('Token obtenido');

  console.log('2. Consultando pedidos pendientes de OP...');
  const pedidosPendientes = await request('GET', '/api/ordenes-produccion/pedidos-pendientes', token);
  console.log('Pedidos sin OP:', pedidosPendientes.data?.length);

  if (pedidosPendientes.data?.length > 0) {
    const pedido = pedidosPendientes.data[0];
    console.log(`3. Generando OP para pedido ${pedido.nro_pedido} (ID ${pedido.id})...`);
    const gen = await request('POST', '/api/ordenes-produccion/generar', token, { pedido_id: pedido.id });
    console.log('Resultado generar OP:', gen.status, gen.data);
  }

  console.log('4. Listando OPs en sistema...');
  const listaOps = await request('GET', '/api/ordenes-produccion', token);
  console.log('Total OPs:', listaOps.data?.length);
  if (listaOps.data?.length > 0) {
    const primeraOp = listaOps.data[0];
    console.log('Probando con OP:', primeraOp.nro_op, 'ID:', primeraOp.id);

    console.log('5. Obteniendo Despiece (BOM) de OP...');
    const despiece = await request('GET', `/api/ordenes-produccion/${primeraOp.id}/despiece`, token);
    console.log('Status despiece:', despiece.status);
    console.log('Materiales calculados:', despiece.data?.materiales?.map(m => ({
      sku: m.sku,
      concepto: m.descripcion,
      req: m.cantidad_requerida,
      stock: m.stock_actual,
      suficiente: m.stock_suficiente,
      quedaria_critico: m.quedaria_critico
    })));

    console.log('6. Actualizando estado a "corte"...');
    const estado = await request('PATCH', `/api/ordenes-produccion/${primeraOp.id}/estado`, token, { estado: 'corte' });
    console.log('Estado actualizado:', estado.status, estado.data?.op?.estado_nuevo);

    if (!primeraOp.stock_descontado) {
      console.log('7. Probando descuento de stock...');
      const desc = await request('POST', `/api/ordenes-produccion/${primeraOp.id}/descontar-stock`, token);
      console.log('Descuento de stock status:', desc.status, desc.data?.mensaje || desc.data?.error);
      if (desc.data?.alertas_criticas?.length > 0) {
        console.log('Alertas criticas generadas:', desc.data.alertas_criticas.map(a => a.sku));
      }
    }
  }
}

run().catch(console.error);
