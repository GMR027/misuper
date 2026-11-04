-- 021_create_listas_compra.sql
-- Varias listas de compras por usuario. Los ítems existentes se asignan a
-- una lista "Mi lista" para conservar compatibilidad.

CREATE TABLE IF NOT EXISTS listas_compra (
    id INT NOT NULL AUTO_INCREMENT,
    usuario_id INT NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_listas_usuario (usuario_id, created_at),
    CONSTRAINT fk_listas_compra_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

ALTER TABLE lista_compra_items
    ADD COLUMN lista_id INT NULL AFTER usuario_id;

INSERT INTO listas_compra (usuario_id, nombre)
SELECT id, 'Mi lista' FROM usuarios;

UPDATE lista_compra_items li
INNER JOIN listas_compra lc ON lc.usuario_id = li.usuario_id
SET li.lista_id = lc.id;

ALTER TABLE lista_compra_items
    MODIFY lista_id INT NOT NULL;

ALTER TABLE lista_compra_items
    ADD KEY idx_lista_estado (lista_id, estado),
    ADD CONSTRAINT fk_lista_compra_lista
        FOREIGN KEY (lista_id) REFERENCES listas_compra (id)
        ON DELETE CASCADE;
