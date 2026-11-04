-- 018_create_recetas_y_favoritos.sql
-- Catálogo editable de recetas y favoritos por usuario.
-- Las 100 recetas base se cargan en la migración 019.

CREATE TABLE IF NOT EXISTS recetas (
    id INT NOT NULL AUTO_INCREMENT,
    slug VARCHAR(120) NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    descripcion VARCHAR(500) NOT NULL DEFAULT '',
    tipos JSON NOT NULL,
    porciones_base TINYINT UNSIGNED NOT NULL DEFAULT 4,
    tiempo_min SMALLINT UNSIGNED NOT NULL DEFAULT 30,
    dificultad ENUM('facil', 'media', 'dificil') NOT NULL DEFAULT 'facil',
    ingredientes JSON NOT NULL,
    pasos JSON NOT NULL,
    video_youtube_id CHAR(11) NULL,
    video_titulo VARCHAR(150) NULL,
    estado ENUM('publicada', 'pendiente', 'borrador') NOT NULL DEFAULT 'publicada',
    creada_por INT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_recetas_slug (slug),
    KEY idx_recetas_estado (estado),
    KEY idx_recetas_nombre (nombre),
    CONSTRAINT fk_recetas_creador
        FOREIGN KEY (creada_por) REFERENCES usuarios (id)
        ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS receta_favoritos (
    usuario_id INT NOT NULL,
    receta_id INT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (usuario_id, receta_id),
    KEY idx_favoritos_receta (receta_id),
    CONSTRAINT fk_favoritos_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
        ON DELETE CASCADE,
    CONSTRAINT fk_favoritos_receta
        FOREIGN KEY (receta_id) REFERENCES recetas (id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
