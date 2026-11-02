-- 005_create_compra_items.sql
-- Ítems de una compra. Cada ítem referencia un producto del catálogo o un
-- nombre libre, nunca ambos. El borrado de la compra arrastra sus ítems.

CREATE TABLE IF NOT EXISTS compra_items (
    id INT NOT NULL AUTO_INCREMENT,
    compra_id INT NOT NULL,
    producto_id INT NULL,
    nombre_libre VARCHAR(150) NULL,
    cantidad DECIMAL(12,3) NOT NULL,
    precio_total DECIMAL(12,2) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_compra (compra_id),
    KEY idx_producto (producto_id),
    CONSTRAINT fk_compra_items_compra
        FOREIGN KEY (compra_id) REFERENCES compras (id)
        ON DELETE CASCADE,
    CONSTRAINT fk_compra_items_producto
        FOREIGN KEY (producto_id) REFERENCES productos (id)
        ON DELETE RESTRICT,
    CONSTRAINT chk_compra_items_producto_xor
        CHECK ((producto_id IS NOT NULL) XOR (nombre_libre IS NOT NULL)),
    CONSTRAINT chk_compra_items_cantidad
        CHECK (cantidad > 0),
    CONSTRAINT chk_compra_items_precio
        CHECK (precio_total >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
