-- 016_create_recetas_videos.sql
-- Videos de YouTube administrados desde el panel Admin. Cada receta del
-- catálogo (data/recetas.json) puede tener como máximo un video principal.

CREATE TABLE IF NOT EXISTS recetas_videos (
    receta_slug VARCHAR(120) NOT NULL,
    youtube_id CHAR(11) NOT NULL,
    titulo VARCHAR(150) NULL,
    actualizado_por INT NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (receta_slug),
    CONSTRAINT fk_recetas_videos_usuario
        FOREIGN KEY (actualizado_por) REFERENCES usuarios (id)
        ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
