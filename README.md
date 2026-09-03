# SACWare ERP

API base del modulo GES-01 para la gestion de una fabrica de aberturas de aluminio.

## Requisitos

- Node.js 18 o superior
- MySQL 8

## Instalacion local

1. Crear la base y cargar las semillas ejecutando `database/sacware_erp.sql` en MySQL.
2. Copiar `.env.example` como `.env` y completar las credenciales de MySQL.
3. Instalar dependencias con `npm install`.
4. Validar sintaxis con `npm run check`.
5. Iniciar la API con `npm start` o usar `npm run dev` durante el desarrollo.

## Endpoints

- `GET /api/health`: comprueba la API y la conexion a MySQL.
- `GET /api/insumos`: lista insumos; admite `?categoria=perfil`, `vidrio_dvh` o `accesorio`.
- `GET /api/insumos/criticos`: lista insumos cuyo stock esta en el minimo o por debajo.
- `POST /api/insumos`: crea un insumo. Requiere `sku`, `descripcion`, `categoria` y `unidad_medida`.
- `GET /api/clientes`: lista clientes ordenados por razon social.
- `POST /api/clientes`: crea un cliente. Requiere `razon_social` y `cuit`.

Los endpoints de escritura esperan JSON. Las consultas usan parametros para evitar inyeccion SQL y los duplicados de SKU/CUIT responden con HTTP 409.
