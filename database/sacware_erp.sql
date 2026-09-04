CREATE DATABASE IF NOT EXISTS sacware_erp
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE sacware_erp;

CREATE TABLE IF NOT EXISTS usuarios (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  rol ENUM('admin_ventas', 'produccion', 'stock_compras') NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS clientes (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  razon_social VARCHAR(180) NOT NULL,
  cuit VARCHAR(13) NOT NULL UNIQUE,
  telefono VARCHAR(40),
  email VARCHAR(255),
  direccion VARCHAR(255),
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS insumos (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sku VARCHAR(60) NOT NULL UNIQUE,
  descripcion VARCHAR(255) NOT NULL,
  categoria ENUM('perfil', 'vidrio_dvh', 'accesorio') NOT NULL,
  unidad_medida ENUM('metro', 'm2', 'unidad') NOT NULL,
  stock_actual DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  stock_minimo DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  precio_unitario DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_insumos_stock_actual CHECK (stock_actual >= 0),
  CONSTRAINT chk_insumos_stock_minimo CHECK (stock_minimo >= 0),
  CONSTRAINT chk_insumos_precio CHECK (precio_unitario >= 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS pedidos (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nro_pedido VARCHAR(40) NOT NULL UNIQUE,
  cliente_id INT UNSIGNED NOT NULL,
  estado ENUM('pendiente', 'en_produccion', 'completado', 'cancelado') NOT NULL DEFAULT 'pendiente',
  total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  fecha_entrega_estimada DATE,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pedidos_cliente FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS detalle_pedidos (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  pedido_id INT UNSIGNED NOT NULL,
  insumo_id INT UNSIGNED NOT NULL,
  tipologia VARCHAR(100) NOT NULL,
  ancho_mm INT UNSIGNED NOT NULL,
  alto_mm INT UNSIGNED NOT NULL,
  cantidad INT UNSIGNED NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  CONSTRAINT fk_detalle_pedido FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_detalle_insumo FOREIGN KEY (insumo_id) REFERENCES insumos(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ordenes_produccion (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nro_op VARCHAR(40) NOT NULL UNIQUE,
  pedido_id INT UNSIGNED NOT NULL,
  responsable_id INT UNSIGNED NULL,
  estado ENUM('pendiente', 'corte', 'armado', 'vidriado', 'finalizado') NOT NULL DEFAULT 'pendiente',
  fecha_inicio DATETIME,
  fecha_fin DATETIME,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_op_pedido FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_op_responsable FOREIGN KEY (responsable_id) REFERENCES usuarios(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES
  ('Administrador Ventas', 'admin@sacware.local', '$2b$10$.mSuEKDAOCUA.gL8Cid0mefm0NWc4Jxf.eSPYHG3LpsNwpwvBABkq', 'admin_ventas'),
  ('Responsable Produccion', 'produccion@sacware.local', '$2b$10$.mSuEKDAOCUA.gL8Cid0mefm0NWc4Jxf.eSPYHG3LpsNwpwvBABkq', 'produccion')
ON DUPLICATE KEY UPDATE nombre = VALUES(nombre);

INSERT INTO clientes (razon_social, cuit, telefono, email, direccion) VALUES
  ('Constructora Delta SRL', '30-71234567-8', '351-4550001', 'compras@delta.local', 'Av. Colon 1234, Cordoba'),
  ('Estudio Norte SA', '30-70987654-1', '351-4550002', 'administracion@norte.local', 'Bv. San Juan 850, Cordoba')
ON DUPLICATE KEY UPDATE razon_social = VALUES(razon_social);

INSERT INTO insumos (sku, descripcion, categoria, unidad_medida, stock_actual, stock_minimo, precio_unitario) VALUES
  ('PERF-AL-6005', 'Perfil aluminio linea pesada 6005', 'perfil', 'metro', 18.00, 25.00, 8500.00),
  ('PERF-AL-MARCO', 'Perfil aluminio marco corredizo', 'perfil', 'metro', 12.00, 20.00, 7200.00),
  ('DVH-4-9-4', 'Vidrio DVH 4/9/4 transparente', 'vidrio_dvh', 'm2', 6.50, 10.00, 42000.00),
  ('SELL-SILICONA', 'Sellador silicona neutra para aberturas', 'accesorio', 'unidad', 8.00, 15.00, 6500.00),
  ('SELL-POLIURETANO', 'Sellador poliuretano exterior', 'accesorio', 'unidad', 5.00, 10.00, 8900.00)
ON DUPLICATE KEY UPDATE descripcion = VALUES(descripcion), stock_minimo = VALUES(stock_minimo);
