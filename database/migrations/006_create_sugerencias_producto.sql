-- 006_create_sugerencias_producto.sql
-- Sugerencias de productos no catalogados. Se agrupan por nombre_normalizado
-- (minúsculas, sin acentos) para que el Admin apruebe o ignore todo el grupo.
-- Un usuario solo puede tener una sugerencia pendiente por nombre.

CREATE TABLE IF NOT EXISTS sugerencias_producto (
    id INT NOT NULL AUTO_INCREMENT,
    nombre_normalizado VARCHAR(150) NOT NULL,
    nombre_original VARCHAR(150) NOT NULL,
    estado ENUM('pendiente', 'aprobada', 'ignorada') NOT NULL DEFAULT 'pendiente',
    usuario_id INT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_sugerencia_pendiente (nombre_normalizado, usuario_id, estado),
    KEY idx_estado (estado),
    KEY idx_nombre_norm (nombre_normalizado),
    CONSTRAINT fk_sugerencias_producto_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
