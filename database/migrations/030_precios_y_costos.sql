-- 030_precios_y_costos.sql
-- Guarda la unidad real y el comercio de cada compra, y permite fijar un
-- precio manual por usuario para productos que casi nunca se compran.

ALTER TABLE compras
    ADD COLUMN comercio VARCHAR(120) NULL AFTER fecha;

ALTER TABLE compra_items
    ADD COLUMN unidad_base ENUM('kg', 'gr', 'L', 'ml', 'pza') NULL AFTER nombre_libre,
    ADD COLUMN comercio VARCHAR(120) NULL AFTER unidad_base,
    ADD KEY idx_compra_items_producto (producto_id, compra_id);

UPDATE compra_items ci
INNER JOIN productos p ON p.id = ci.producto_id
SET ci.unidad_base = p.unidad_base
WHERE ci.unidad_base IS NULL;

CREATE TABLE IF NOT EXISTS precios_manuales (
    id INT NOT NULL AUTO_INCREMENT,
    usuario_id INT NOT NULL,
    producto_id INT NOT NULL,
    precio_unidad DECIMAL(12,4) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_precio_manual_usuario_producto (usuario_id, producto_id),
    KEY idx_precios_manuales_producto (producto_id),
    CONSTRAINT fk_precios_manuales_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
        ON DELETE CASCADE,
    CONSTRAINT fk_precios_manuales_producto
        FOREIGN KEY (producto_id) REFERENCES productos (id)
        ON DELETE CASCADE,
    CONSTRAINT chk_precios_manuales_precio
        CHECK (precio_unidad >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
