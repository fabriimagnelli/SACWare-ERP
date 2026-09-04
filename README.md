# SACWare ERP

API base del modulo GES-01 para la gestion de una fabrica de aberturas de aluminio.

## Requisitos

- Node.js 18 o superior
- MySQL 8

## Instalacion local

1. Crear la base y cargar las semillas ejecutando `database/sacware_erp.sql` en MySQL.
2. Copiar `.env.example` como `.env` y completar las credenciales de MySQL y `JWT_SECRET`.
3. Instalar dependencias con `npm install`.
4. Validar sintaxis con `npm run check`.
5. Iniciar la API con `npm start` o usar `npm run dev` durante el desarrollo.

## Usuarios de Prueba

| Email | Rol | Contraseña |
| --- | --- | --- |
| `admin@sacware.local` | `admin_ventas` | `admin123` |
| `produccion@sacware.local` | `produccion` | `admin123` |

Para restablecer ambas contraseñas en la base local, ejecutar `npm run reset:usuarios`.

## Endpoints

- `GET /api/health`: comprueba la API y la conexion a MySQL.
- `GET /api/insumos`: lista insumos; admite `?categoria=perfil`, `vidrio_dvh` o `accesorio`.
- `GET /api/insumos/criticos`: lista insumos cuyo stock esta en el minimo o por debajo.
- `POST /api/insumos`: crea un insumo. Requiere `sku`, `descripcion`, `categoria` y `unidad_medida`.
- `GET /api/clientes`: lista clientes ordenados por razon social.
- `POST /api/clientes`: crea un cliente. Requiere `razon_social` y `cuit`.
- `POST /api/auth/login`: autentica un usuario con `email` y `password` y devuelve un JWT.
- `POST /api/pedidos`: crea un pedido y descuenta el stock dentro de una transaccion. Requiere `cliente_id` y `detalles`.

Los endpoints de insumos requieren el rol `stock_compras`; los de clientes y pedidos requieren `admin_ventas`.
Enviar el token en `Authorization: Bearer <token>`. Los endpoints esperan JSON, usan consultas parametrizadas y los duplicados de SKU/CUIT/nro_pedido responden con HTTP 409.
