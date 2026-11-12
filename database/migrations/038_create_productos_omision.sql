-- 038_create_productos_omision.sql
-- Ingredientes que cada usuario decide no contar al comparar recetas con sus
-- compras: sal, aceite, especias, etc. Se guarda el nombre normalizado para
-- evitar duplicados por acentos o mayúsculas.

CREATE TABLE IF NOT EXISTS productos_omision (
    id INT NOT NULL AUTO_INCREMENT,
    usuario_id INT NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    nombre_normalizado VARCHAR(100) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_productos_omision_usuario_nombre (usuario_id, nombre_normalizado),
    KEY idx_productos_omision_usuario (usuario_id),
    CONSTRAINT fk_productos_omision_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
