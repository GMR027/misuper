-- 029_create_lotes_recetas.sql
-- Lotes de importación desde libros. Las recetas se guardan como pendientes y
-- el lote se puede publicar o deshacer completo.

CREATE TABLE IF NOT EXISTS lotes_recetas (
    id CHAR(32) NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    autor VARCHAR(150) NULL,
    archivo VARCHAR(500) NULL,
    total SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    estado ENUM('borrador', 'publicado', 'descartado') NOT NULL DEFAULT 'borrador',
    creado_por INT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_lotes_estado (estado, created_at),
    CONSTRAINT fk_lotes_creador
        FOREIGN KEY (creado_por) REFERENCES usuarios (id)
        ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

ALTER TABLE recetas
    ADD COLUMN lote_id CHAR(32) NULL AFTER creada_por,
    ADD COLUMN origen VARCHAR(255) NULL AFTER lote_id,
    ADD COLUMN pasos_reescritos TINYINT(1) NOT NULL DEFAULT 0 AFTER origen,
    ADD KEY idx_recetas_lote (lote_id),
    ADD CONSTRAINT fk_recetas_lote
        FOREIGN KEY (lote_id) REFERENCES lotes_recetas (id)
        ON DELETE SET NULL;
