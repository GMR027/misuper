-- 017_create_lista_compra_items.sql
-- Lista personal de productos por comprar. Los ítems pueden venir de una
-- receta (con producto del catálogo o nombre libre) o agregarse a mano.

CREATE TABLE IF NOT EXISTS lista_compra_items (
    id INT NOT NULL AUTO_INCREMENT,
    usuario_id INT NOT NULL,
    producto_id INT NULL,
    nombre VARCHAR(150) NOT NULL,
    cantidad DECIMAL(12,3) NOT NULL DEFAULT 1,
    unidad_base ENUM('kg', 'gr', 'L', 'ml', 'pza') NOT NULL DEFAULT 'pza',
    origen VARCHAR(255) NULL,
    estado ENUM('pendiente', 'enviado', 'cargado') NOT NULL DEFAULT 'pendiente',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_lista_usuario_estado (usuario_id, estado),
    CONSTRAINT fk_lista_compra_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
        ON DELETE CASCADE,
    CONSTRAINT fk_lista_compra_producto
        FOREIGN KEY (producto_id) REFERENCES productos (id)
        ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
